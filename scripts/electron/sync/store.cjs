const fs = require("node:fs/promises");
const path = require("node:path");
const {randomUUID} = require("node:crypto");
const {pathToFileURL} = require("node:url");
const manifestRules = require("./manifest.cjs");
const transport = require("./transport.cjs");
const catalog = require("./catalog.cjs");

/** Owns immutable snapshots and the durable local pointer, never the user library. */
class SyncStore {
    constructor(directory, limits) {
        this.directory = path.resolve(directory);
        this.limits = limits;
        this.current = null;
        this.previous = null;
        this.allowedRoots = new Set();
        this.prepared = null;
    }

    async open() {
        await fs.mkdir(this.directory, {recursive: true});
        this.directory = await fs.realpath(this.directory);
        for (const name of [".staging", "releases"]) await this.createDirectory(name);
        // Never remove a stage still owned by another running OS process.
        for (const entry of await fs.readdir(path.join(this.directory, ".staging"), {withFileTypes: true})) {
            if (/^[0-9a-f-]{36}$/.test(entry.name) && entry.isDirectory() &&
                await this.abandonedStage(path.join(this.directory, ".staging", entry.name))) {
                await fs.rm(path.join(this.directory, ".staging", entry.name), {recursive: true, force: true});
            }
        }
        let pointer;
        try { pointer = await this.readPointer("current.json"); }
        catch (error) { if (error.code !== "ENOENT") console.warn("Sync pointer recovery: " + error.message); }
        const candidates = [pointer?.current, pointer?.previous];
        try { candidates.push((await this.readPointer("previous.json")).current); }
        catch (error) { if (error.code !== "ENOENT") console.warn("Sync backup recovery: " + error.message); }
        const checked = new Set();
        for (const candidate of candidates.filter(Boolean)) {
            if (checked.has(candidate.root)) continue;
            checked.add(candidate.root);
            if (this.current && this.previous) break;
            try {
                const snapshot = await this.loadSnapshot(candidate);
                if (!this.current) this.current = snapshot;
                else if (snapshot.root !== this.current.root && !this.previous) this.previous = snapshot;
                this.allowedRoots.add(snapshot.root);
            } catch (error) { console.warn("Sync snapshot recovery: " + error.message); }
        }
        if (this.current && this.current.root !== pointer?.current?.root) await this.writePointer("current.json", this.pointer());
        if (this.current) await this.prune();
        return this.info();
    }

    async abandonedStage(directory) {
        try {
            const owner = JSON.parse(await fs.readFile(path.join(directory, ".owner.json"), "utf8"));
            if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) return false;
            try { process.kill(owner.pid, 0); return false; }
            catch (error) { return error.code === "ESRCH"; }
        } catch (error) {
            // A crash before the owner write leaves an unclaimed stage. Give new
            // stages ample time so another process cannot lose its startup work.
            return Date.now() - (await fs.stat(directory)).mtimeMs > 86400000;
        }
    }

    async createDirectory(name) {
        const directory = manifestRules.destination(this.directory, name);
        await fs.mkdir(directory, {recursive: true});
        if ((await fs.lstat(directory)).isSymbolicLink() || await fs.realpath(directory) !== directory) throw Error("Sync directory must not be a link.");
        return directory;
    }

    pointer() {
        const identity = snapshot => snapshot ? {revision: snapshot.revision, root: snapshot.root} : null;
        return {schemaVersion: 1, current: identity(this.current), previous: identity(this.previous)};
    }

    info() {
        return this.current ? {revision: this.current.revision, rootUrl: pathToFileURL(this.current.directory + path.sep).href} : {revision: null, rootUrl: null};
    }

    async readPointer(filename) {
        const file = path.join(this.directory, filename);
        const info = await fs.lstat(file);
        if (!info.isFile() || info.size > 65536) throw Error("Invalid sync pointer file.");
        const value = JSON.parse(await fs.readFile(file, "utf8"));
        if (value?.schemaVersion !== 1) throw Error("Invalid sync pointer schema.");
        return value;
    }

    async assertPlainFile(root, filename) {
        let current = root;
        for (const segment of manifestRules.relativePath(filename)) {
            current = path.join(current, segment);
            if ((await fs.lstat(current)).isSymbolicLink()) throw Error("Snapshot paths must not be links.");
        }
    }

    async loadSnapshot(identity) {
        manifestRules.revision(identity.revision);
        const parts = manifestRules.relativePath(identity.root);
        if (parts.length !== 3 || parts[0] !== "releases" || parts[1] !== identity.revision || !/^[0-9a-f-]{36}$/.test(parts[2])) throw Error("Invalid sync snapshot root.");
        const directory = manifestRules.destination(this.directory, identity.root);
        if (await fs.realpath(directory) !== directory) throw Error("Snapshot root must not be a link.");
        const file = path.join(directory, ".manifest.json");
        const info = await fs.lstat(file);
        if (!info.isFile() || info.size > this.limits.maxManifestSizeBytes) throw Error("Invalid stored sync manifest.");
        const manifest = manifestRules.validate(JSON.parse(await fs.readFile(file, "utf8")), this.limits);
        if (manifest.revision !== identity.revision) throw Error("Stored sync revision mismatch.");
        const signal = new AbortController().signal;
        for (const entry of manifest.files) {
            const target = manifestRules.destination(directory, entry.path);
            await this.assertPlainFile(directory, entry.path);
            await transport.verify(target, entry, signal);
        }
        await catalog.validate(directory, manifest);
        return {root: identity.root, revision: manifest.revision, directory, manifest};
    }

    async stage(manifest, signal, download) {
        if (this.prepared) throw Error("A sync transaction is already prepared.");
        const id = randomUUID();
        const directory = await this.createDirectory(".staging/" + id);
        try {
            await this.writeStageOwner(directory);
            await this.prepareFiles(directory, manifest.files, signal, download);
            transport.assertActive(signal);
            await catalog.validate(directory, manifest);
            transport.assertActive(signal);
            await this.writeManifest(directory, manifest);
            await this.flushDirectories(directory, manifest.files);
            transport.assertActive(signal);
            this.prepared = {id, directory, manifest, published: false};
            return {id, revision: manifest.revision};
        } catch (error) {
            await fs.rm(directory, {recursive: true, force: true});
            throw error;
        }
    }

    /** Records the process owning a stage before preparing any content. */
    async writeStageOwner(directory) {
        await fs.writeFile(path.join(directory, ".owner.json"), JSON.stringify({pid: process.pid}), {flag: "wx", mode: 0o600});
    }

    /** Prepares each declared file, reusing only verified installed bytes. */
    async prepareFiles(directory, files, signal, download) {
        const previous = new Map((this.current?.manifest.files || []).map(entry => [entry.path, entry]));
        for (const entry of files) {
            await this.prepareFile(directory, entry, previous.get(entry.path), signal, download);
        }
    }

    /** Falls back to downloading when an installed file cannot be reused. */
    async prepareFile(directory, entry, previous, signal, download) {
        transport.assertActive(signal);
        const target = manifestRules.destination(directory, entry.path);
        await fs.mkdir(path.dirname(target), {recursive: true});
        if (!await this.reuseFile(entry, previous, target, signal)) {
            await download(entry, target);
        }
    }

    /** Verifies and flushes a copied file; cancellation never becomes a retry. */
    async reuseFile(entry, previous, target, signal) {
        if (!previous || previous.size !== entry.size || previous.sha256 !== entry.sha256) return false;
        try {
            const source = manifestRules.destination(this.current.directory, entry.path);
            await this.assertPlainFile(this.current.directory, entry.path);
            await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
            await transport.verify(target, entry, signal);
            await this.flushFile(target);
            return true;
        } catch (error) {
            await fs.rm(target, {force: true});
            transport.assertActive(signal);
            return false;
        }
    }

    /** Flushes reused bytes before a stage can become publishable. */
    async flushFile(filename) {
        const handle = await fs.open(filename, "r");
        try { await handle.sync(); }
        finally { await handle.close(); }
    }

    /** Writes and flushes the verified stage manifest without replacing an existing file. */
    async writeManifest(directory, manifest) {
        const handle = await fs.open(path.join(directory, ".manifest.json"), "wx", 0o600);
        try { await handle.writeFile(JSON.stringify(manifest)); await handle.sync(); }
        finally { await handle.close(); }
    }

    /** Flushes nested content directories before their parents. */
    async flushDirectories(directory, files) {
        const directories = this.contentDirectories(directory, files);
        for (const name of directories) await this.syncDirectory(name);
    }

    /** Collects each stage directory once, ordered from deepest child to stage root. */
    contentDirectories(directory, files) {
        const directories = new Set([directory]);
        for (const entry of files) {
            let parent = path.dirname(manifestRules.destination(directory, entry.path));
            while (parent !== directory) {
                directories.add(parent);
                parent = path.dirname(parent);
            }
        }
        return [...directories].sort((a, b) => b.length - a.length);
    }

    async publish(transaction) {
        const prepared = this.prepared;
        if (!prepared || prepared.id !== transaction?.id) throw Error("Unknown prepared sync transaction.");
        if (prepared.published) return this.info();
        const parent = await this.createDirectory("releases/" + prepared.manifest.revision);
        const directory = path.join(parent, prepared.id);
        await fs.rename(prepared.directory, directory);
        prepared.directory = directory;
        await this.syncDirectory(parent);
        await this.syncDirectory(path.join(this.directory, "releases"));
        const next = {root: "releases/" + prepared.manifest.revision + "/" + prepared.id,
            directory, revision: prepared.manifest.revision, manifest: prepared.manifest};
        if (this.current) await this.writePointer("previous.json", this.pointer());
        const pointer = {schemaVersion: 1, current: {root: next.root, revision: next.revision},
            previous: this.current ? {root: this.current.root, revision: this.current.revision} : null};
        await this.writePointer("current.json", pointer);
        this.previous = this.current;
        this.current = next;
        this.allowedRoots.add(next.root);
        prepared.published = true;
        this.prepared = null;
        await this.prune();
        return this.info();
    }

    /** Keeps two recoverable snapshots; cleanup never invalidates a committed update. */
    async prune() {
        try {
            // The backup must not refer to a third snapshot that cleanup will remove.
            const current = this.pointer();
            const durable = await this.readPointer("current.json");
            if (durable.current?.root !== current.current?.root) return;
            await this.writePointer("previous.json", {schemaVersion: 1, current: current.previous, previous: null});
            const retained = new Set([this.current?.root, this.previous?.root].filter(Boolean));
            this.allowedRoots = new Set(retained);
            await this.pruneReleases(retained);
        } catch (error) {
            console.warn("Sync snapshot cleanup: " + error.message);
        }
    }

    /** Inspects revision folders without following links or unknown names. */
    async pruneReleases(retained) {
        const releases = path.join(this.directory, "releases");
        for (const revision of await fs.readdir(releases, {withFileTypes: true})) {
            if (!revision.isDirectory() || revision.isSymbolicLink()) continue;
            try { manifestRules.revision(revision.name); } catch (error) { continue; }
            await this.pruneRevision(revision.name, retained);
        }
    }

    /** Removes obsolete snapshots and then an empty revision folder. */
    async pruneRevision(revision, retained) {
        const parent = path.join(this.directory, "releases", revision);
        for (const entry of await fs.readdir(parent, {withFileTypes: true})) {
            const root = "releases/" + revision + "/" + entry.name;
            if (retained.has(root) || !entry.isDirectory() || !/^[0-9a-f-]{36}$/.test(entry.name)) continue;
            await this.removeSnapshot(path.join(parent, entry.name));
        }
        // Only remove an empty revision folder, never unknown files.
        try { await fs.rmdir(parent); }
        catch (error) { if (!["ENOTEMPTY", "EEXIST"].includes(error.code)) throw error; }
    }

    /** Deletes only a plain managed snapshot not owned by another live process. */
    async removeSnapshot(directory) {
        if (await fs.realpath(directory) !== directory) return;
        const manifest = await fs.lstat(path.join(directory, ".manifest.json")).catch(error => {
            if (error.code !== "ENOENT") throw error;
            return null;
        });
        if (!manifest?.isFile() || manifest.isSymbolicLink()) return;
        if (await this.ownedByOtherProcess(directory)) return;
        await fs.rm(directory, {recursive: true, force: true});
    }

    /** Another live OS process may still be reading its committed snapshot. */
    async ownedByOtherProcess(directory) {
        try {
            const owner = JSON.parse(await fs.readFile(path.join(directory, ".owner.json"), "utf8"));
            if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) return true;
            if (owner.pid === process.pid) return false;
            try { process.kill(owner.pid, 0); return true; }
            catch (error) { return error.code !== "ESRCH"; }
        } catch (error) {
            return error.code !== "ENOENT";
        }
    }

    async discard(transaction) {
        const prepared = this.prepared;
        if (!prepared || prepared.id !== transaction?.id || prepared.published) return;
        this.prepared = null;
        await fs.rm(prepared.directory, {recursive: true, force: true});
    }

    async writePointer(filename, pointer) {
        const temporary = path.join(this.directory, ".pointer-" + randomUUID() + ".json");
        try {
            const handle = await fs.open(temporary, "wx", 0o600);
            try { await handle.writeFile(JSON.stringify(pointer)); await handle.sync(); }
            finally { await handle.close(); }
            await fs.rename(temporary, path.join(this.directory, filename));
            // A completed rename is committed even if the final directory sync fails.
            try { await this.syncDirectory(this.directory); }
            catch (error) { console.warn("Sync pointer directory flush: " + error.message); }
        } finally { await fs.rm(temporary, {force: true}); }
    }

    async syncDirectory(directory) {
        const handle = await fs.open(directory, "r");
        try { await handle.sync(); }
        catch (error) { if (!["EINVAL", "ENOTSUP", "EPERM"].includes(error.code)) throw error; }
        finally { await handle.close(); }
    }
}

module.exports = SyncStore;
