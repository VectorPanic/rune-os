const fs = require("fs");
const path = require("path");
const migrateScreensavers = require("./migrate-screensavers.cjs");
const migrateGames = require("./migrate-games.cjs");

/** Prepares a writable library once, preserving all existing user content. */
module.exports = function prepareLibrary(directory, seed) {
    if (fs.existsSync(directory)) {
        initializeConfig(directory, seed);
        const content = fs.existsSync(path.join(directory, "local")) ? path.join(directory, "local") : directory;
        const seedContent = fs.existsSync(path.join(seed, "local")) ? path.join(seed, "local") : seed;
        initializeTags(content, seedContent);
        initializeScreensavers(content);
        migrateGames(content);
        migrateScreensavers(content);
        return directory;
    }
    const staging = directory + ".initializing";
    fs.mkdirSync(path.dirname(directory), {recursive: true});
    if (fs.existsSync(staging)) {
        if (fs.rmSync) fs.rmSync(staging, {recursive: true, force: true});
        else fs.rmdirSync(staging, {recursive: true});
    }
    function copy(source, destination) {
        fs.mkdirSync(destination, {recursive: true});
        for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
            if (source === seed && ["log", "remote"].includes(entry.name)) continue;
            const input = path.join(source, entry.name);
            const output = path.join(destination, entry.name);
            if (entry.isDirectory()) copy(input, output);
            else if (entry.isFile()) fs.copyFileSync(input, output);
        }
    }
    copy(seed, staging);
    fs.renameSync(staging, directory);
    return directory;
};

/** Adds the independent vocabulary once when upgrading an older local library. */
function initializeTags(directory, seed) {
    const target = path.join(directory, "tags.json");
    if (fs.existsSync(target)) return;
    const staging = target + ".initializing";
    const vocabulary = JSON.parse(fs.readFileSync(path.join(seed, "tags.json"), "utf8"));
    const known = new Set(vocabulary.tags.map(tag => tag.id));
    // Older libraries inferred tag IDs from metadata. Preserve that vocabulary
    // only during this one-time migration; normal catalog loading never infers tags.
    for (const [file, collection, field] of [["categories.json", "categories", "weights"], ["games.json", "games", "tags"]]) {
        if (!fs.existsSync(path.join(directory, file))) continue;
        const records = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))[collection];
        for (const record of records || []) {
            for (const id of Object.keys(record[field] || {})) {
                if (!known.has(id) && /^[a-z][a-z0-9-]*$/.test(id)) {
                    vocabulary.tags.push({id, name: id, description: "Imported from the existing library."});
                    known.add(id);
                }
            }
        }
    }
    fs.writeFileSync(staging, JSON.stringify(vocabulary, null, 2) + "\n");
    if (fs.existsSync(target)) fs.unlinkSync(staging);
    else fs.renameSync(staging, target);
}

/** Adds an independent screensaver document once without rewriting user game data. */
function initializeScreensavers(directory) {
    const target = path.join(directory, "screensavers.json");
    if (fs.existsSync(target) || fs.existsSync(path.join(directory, ".screensaver-folders-migrated")) ||
        !fs.existsSync(path.join(directory, "games.json"))) return;
    let document;
    try { document = JSON.parse(fs.readFileSync(path.join(directory, "games.json"), "utf8")); }
    catch (error) { document = {}; }
    const screensavers = (Array.isArray(document.games) ? document.games : []).filter(item => item && item.type === "screensaver").map(item => {
        const copy = {};
        for (const key of ["name", "binary", "author", "year", "enabled", "requiredFiles"]) {
            if (item[key] !== undefined) copy[key] = item[key];
        }
        if (copy.author === undefined && item.developer) copy.author = item.developer;
        return copy;
    });
    const staging = target + ".initializing";
    fs.writeFileSync(staging, JSON.stringify({screensavers}, null, 2) + "\n");
    fs.renameSync(staging, target);
}

/** Seeds user settings on upgrade without replacing an existing configuration. */
function initializeConfig(directory, seed) {
    const target = path.join(directory, "config.json");
    const source = path.join(seed, "config.json");
    if (fs.existsSync(target) || !fs.existsSync(source)) return;
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
}
