const fs = require("fs/promises");
const path = require("path");
const {fileURLToPath} = require("url");

/** Lists published content directories without reading application bundles. */
module.exports = async function contentFolders(rootUrl, kind) {
    if (kind !== "games" && kind !== "screensaver") throw Error("Invalid content directory.");
    const root = await fs.realpath(fileURLToPath(rootUrl));
    let directory;
    try { directory = await fs.realpath(path.join(root, kind)); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
    const relative = path.relative(root, directory);
    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
        throw Error("Content directory is outside the library.");
    }
    const entries = await fs.readdir(directory, {withFileTypes: true});
    return entries.filter(entry => entry.isDirectory() && !entry.name.startsWith(".")).map(entry => entry.name).sort();
};
