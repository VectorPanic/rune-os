const path = require("node:path");
const {fileURLToPath, pathToFileURL} = require("node:url");
const {randomUUID} = require("node:crypto");
const rules = require("./manifest.cjs");
const transport = require("./transport.cjs");
const SyncStore = require("./store.cjs");

/** Owns the native side of one window's restricted sync protocol. */
class NativeSyncService {
    constructor(options) {
        this.originalRootUrl = options.rootUrl;
        this.storeDirectory = options.directory;
        this.store = null;
        this.limits = null;
        this.initialization = null;
        this.active = null;
        this.update = null;
        this.disposed = false;
        this.ready = false;
        this.publishing = null;
    }

    /** Reuses initialization while returning the current local root after renderer reloads. */
    async configure(options) {
        if (!this.initialization) this.initialization = this.initialize(options);
        await this.initialization;
        return this.info();
    }

    async initialize(options) {
        if (!options || typeof options.apiEnabled !== "boolean") throw Error("Invalid API sync configuration.");
        if (!options.apiEnabled) return this.info();
        this.limits = rules.settings(options);
        this.store = new SyncStore(this.storeDirectory, this.limits);
        await this.store.open();
        this.ready = true;
        return this.info();
    }

    info() {
        const value = this.store?.info();
        return {revision: value?.revision || null, rootUrl: value?.rootUrl || this.originalRootUrl};
    }

    assertReady() {
        if (this.disposed || !this.ready) throw Error("API sync is not available.");
    }

    /** Registers cancellation before any native network or staging work starts. */
    async run(id, work) {
        this.assertReady();
        if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id) || this.active) throw Error("Invalid or overlapping sync operation.");
        const operation = {id, controller: new AbortController(), promise: null};
        this.active = operation;
        operation.promise = Promise.resolve().then(() => work(operation.controller.signal));
        try { return await operation.promise; }
        finally { if (this.active === operation) this.active = null; }
    }

    check(id) {
        return this.run(id, async signal => {
            const value = await transport.json(new URL("library", this.limits.baseUrl).href, signal, this.limits);
            const manifest = rules.validate(value, this.limits);
            transport.assertActive(signal);
            if (manifest.revision === this.store.current?.revision) return null;
            const token = randomUUID();
            this.update = {token, manifest};
            return {token, revision: manifest.revision};
        });
    }

    stage(id, update) {
        return this.run(id, async signal => {
            if (!this.update || this.update.token !== update?.token) throw Error("Unknown sync update.");
            const manifest = this.update.manifest;
            return this.store.stage(manifest, signal, (entry, target) =>
                transport.download(rules.fileUrl(this.limits.baseUrl, manifest.revision, entry.path), target, entry, signal, this.limits));
        });
    }

    async publish(prepared) {
        this.assertReady();
        if (this.active) throw Error("Cannot publish while native sync work is active.");
        if (this.publishing) throw Error("Sync publication is already in progress.");
        this.publishing = this.store.publish(prepared);
        try {
            const result = await this.publishing;
            this.update = null;
            return result;
        } finally { this.publishing = null; }
    }

    async discard(prepared) {
        if (this.store) await this.store.discard(prepared);
    }

    cancel(id) {
        if (this.active?.id === id) this.active.controller.abort();
    }

    roots() {
        return [this.originalRootUrl, ...[...(this.store?.allowedRoots || [])].map(root =>
            pathToFileURL(path.join(this.store.directory, root) + path.sep).href)];
    }

    /** Folder enumeration can only name a local root already known to this window. */
    root(requested) {
        const selected = requested || this.originalRootUrl;
        const normalized = path.resolve(fileURLToPath(selected));
        const allowed = this.roots().find(root => path.resolve(fileURLToPath(root)) === normalized);
        if (!allowed) throw Error("Unknown library content root.");
        return allowed;
    }

    /** Current and previous committed paths remain readable across a library switch. */
    rootFor(resourceUrl) {
        const resource = path.resolve(fileURLToPath(resourceUrl));
        for (const root of this.roots()) {
            const relative = path.relative(fileURLToPath(root), resource);
            if (relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)) return root;
        }
        throw Error("Resource is outside the assigned libraries.");
    }

    async dispose() {
        this.disposed = true;
        const operation = this.active;
        if (operation) {
            operation.controller.abort();
            try { await operation.promise; } catch (error) { /* Cancellation owns no active content. */ }
        }
        if (this.publishing) { try { await this.publishing; } catch (error) { /* Unpublished staging is released below. */ } }
        if (this.store?.prepared && !this.store.prepared.published) await this.store.discard(this.store.prepared);
    }
}

module.exports = NativeSyncService;
