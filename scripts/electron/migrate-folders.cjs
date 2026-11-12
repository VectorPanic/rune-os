const fs = require("fs");
const path = require("path");

/** Imports a legacy manifest once, preserving existing metadata and source files. */
module.exports = function migrateFolders(directory, options) {
    const manifest = path.join(directory, options.manifest);
    const marker = path.join(directory, options.marker);
    if (fs.existsSync(marker) || !fs.existsSync(manifest)) return;
    let document;
    try { document = JSON.parse(fs.readFileSync(manifest, "utf8")); }
    catch (error) { console.warn("Legacy catalog could not be migrated: " + error.message); return; }
    const items = document && document[options.collection];
    if (!Array.isArray(items)) return;
    const root = fs.realpathSync(directory);
    const destinationRoot = path.join(root, options.directory);
    if (fs.existsSync(destinationRoot) && fs.lstatSync(destinationRoot).isSymbolicLink()) return;
    function localFile(value) {
        if (typeof value !== "string" || path.isAbsolute(value)) return null;
        const candidate = path.resolve(root, value);
        const relative = path.relative(root, candidate);
        if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative) || !fs.existsSync(candidate)) return null;
        const real = fs.realpathSync(candidate);
        if (!real.startsWith(root + path.sep) || !fs.statSync(real).isFile()) return null;
        return real;
    }
    function copy(source, destination, target) {
        if (source === target || destination === path.join(target, path.basename(target) + ".json") || fs.lstatSync(source).isSymbolicLink()) return;
        if (fs.statSync(source).isDirectory()) {
            fs.mkdirSync(destination, {recursive: true});
            for (const name of fs.readdirSync(source)) copy(path.join(source, name), path.join(destination, name), target);
        } else if (!fs.existsSync(destination)) {
            fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
        }
    }
    for (const item of items) {
        if (!item || (options.directory === "games" && item.type === "screensaver")) continue;
        const binary = localFile(item.binary);
        if (!binary) continue;
        const source = path.dirname(binary);
        if (options.directory === "games" && path.dirname(source) !== path.join(root, "games")) continue;
        const sharedSource = source === root || (path.dirname(source) === root && ["screensaver", "screensavers"].includes(path.basename(source)));
        const name = sharedSource ? path.basename(binary, path.extname(binary)) : path.basename(source);
        if (name.startsWith(".")) continue;
        const folder = path.join(root, options.directory, name);
        if (fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink()) continue;
        const target = path.join(folder, name + ".json");
        if (fs.existsSync(target)) continue;
        fs.mkdirSync(folder, {recursive: true});
        // Savers may move to a new root; keep their relative resources intact.
        if (!options.image && !sharedSource && source !== folder) copy(source, folder, folder);
        const executable = path.join(folder, name + ".js");
        if (!fs.existsSync(executable)) fs.copyFileSync(binary, executable, fs.constants.COPYFILE_EXCL);
        if (options.image) {
            const image = localFile(item.image);
            const icon = path.join(folder, name + ".png");
            if (image && !fs.existsSync(icon)) fs.copyFileSync(image, icon, fs.constants.COPYFILE_EXCL);
        }
        if (!options.image && sharedSource) {
            for (const file of Array.isArray(item.requiredFiles) ? item.requiredFiles : []) {
                const input = typeof file === "string" ? localFile(path.relative(root, path.resolve(source, file))) : null;
                if (!input) continue;
                const destination = path.resolve(folder, file);
                if (!destination.startsWith(folder + path.sep)) continue;
                fs.mkdirSync(path.dirname(destination), {recursive: true});
                copy(input, destination, folder);
            }
        }
        const metadata = {...item};
        for (const key of ["id", "version", "binary", "image"]) delete metadata[key];
        // Resource copying must never publish metadata before the bundle is ready.
        if (fs.existsSync(target)) continue;
        fs.writeFileSync(target + ".initializing", JSON.stringify(metadata, null, 2) + "\n");
        fs.renameSync(target + ".initializing", target);
    }
    fs.writeFileSync(marker, "1\n", {flag: "wx"});
};
