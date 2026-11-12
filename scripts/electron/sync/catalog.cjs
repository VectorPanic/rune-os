const fs = require("node:fs/promises");
const sourceFs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {pathToFileURL} = require("node:url");
const {relativePath, destination} = require("./manifest.cjs");

// The same schema validators are shipped for native staging and renderer loading.
const SOURCES = ["scope/Manifest", "util/Validation", "catalog/TagRegistry", "catalog/GameRegistry", "catalog/ScreensaverRegistry", "catalog/CategoryValidation", "catalog/CategoryRegistry"];
let catalog;
function validators() {
    if (catalog) return catalog;
    const context = vm.createContext({console});
    for (const name of SOURCES) vm.runInContext(sourceFs.readFileSync(path.resolve(__dirname, "../../..", "src", name + ".js"), "utf8"), context);
    catalog = context.runeos.catalog;
    return catalog;
}

async function readJson(root, filename, entries) {
    const entry = entries.get(filename);
    if (!entry || entry.size > 2097152) throw Error("Missing or oversized sync metadata: " + filename);
    const bytes = await fs.readFile(destination(root, filename));
    return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
}

function assertValid(errors) {
    if (errors.length) throw Error("Invalid sync metadata: " + errors.join("; "));
}

/** Loads and validates the shared tag vocabulary before dependent metadata. */
async function loadTags(root, entries, types) {
    const tags = new types.TagRegistry();
    assertValid(tags.replace(await readJson(root, "tags.json", entries)));
    return tags;
}

/** Validates category rules against the snapshot's tag vocabulary. */
async function validateCategories(root, entries, tags, types) {
    const categories = new types.CategoryRegistry(tags.ids, tags.baseIds);
    assertValid(categories.replace(await readJson(root, "categories.json", entries)));
}

function contentFolders(entries, kind) {
    const files = [...entries.keys()].filter(filename => filename.startsWith(kind + "/"));
    return [...new Set(files.map(filename => filename.split("/")[1]))];
}

function validateExecutable(entries, filename) {
    if (!entries.has(filename) || entries.get(filename).size === 0) throw Error("Missing sync executable: " + filename);
}

/** Requires every declared dependency to belong to this verified snapshot. */
function validateDependencies(metadata, entries, prefix) {
    const required = metadata.requiredFiles === undefined ? [] : metadata.requiredFiles;
    if (!Array.isArray(required) || new Set(required).size !== required.length) throw Error("Invalid sync requiredFiles.");
    for (const file of required) {
        relativePath(file);
        if (!entries.has(prefix + file)) throw Error("Missing sync dependency: " + prefix + file);
    }
}

/** Reads content only after checking its executable and declared dependencies. */
async function readContent(root, entries, kind, folder) {
    const prefix = kind + "/" + folder + "/";
    const binary = prefix + folder + ".js";
    validateExecutable(entries, binary);
    const metadata = await readJson(root, prefix + folder + ".json", entries);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw Error("Invalid content metadata object.");
    validateDependencies(metadata, entries, prefix);
    const item = {...metadata, id: (kind === "games" ? "game:" : "screensaver:") + folder, binary: pathToFileURL(destination(root, binary)).href};
    if (kind === "games") item.image = pathToFileURL(destination(root, prefix + folder + ".png")).href;
    return item;
}

function validateGame(item, tags, types) {
    const games = new types.GameRegistry(tags.ids, tags.baseIds);
    assertValid(games.replace({games: [item]}));
}

function validateScreensaver(item, types) {
    const savers = new types.ScreensaverRegistry();
    assertValid(savers.replace({screensavers: [item]}));
}

/** Validates metadata and dependency closure against the exact verified snapshot. */
async function validate(root, manifest) {
    const types = validators();
    const entries = new Map(manifest.files.map(entry => [entry.path, entry]));
    const tags = await loadTags(root, entries, types);
    await validateCategories(root, entries, tags, types);
    for (const kind of ["games", "screensaver"]) {
        for (const folder of contentFolders(entries, kind)) {
            const item = await readContent(root, entries, kind, folder);
            if (kind === "games") validateGame(item, tags, types);
            else validateScreensaver(item, types);
        }
    }
}

module.exports = {SOURCES, validate};
