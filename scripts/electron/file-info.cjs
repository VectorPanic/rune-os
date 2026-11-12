const {constants, promises: fs} = require("fs");
const path = require("path");
const {fileURLToPath} = require("url");

// Metadata only, confined to the installed library even when symlinks are used.
module.exports = async function fileInfo(rootUrl, resourceUrl) {
    const root = await fs.realpath(fileURLToPath(rootUrl));
    const resource = await fs.realpath(fileURLToPath(resourceUrl));
    const relative = path.relative(root, resource);
    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
        throw Error("Resource is outside the game library.");
    }
    const info = await fs.stat(resource);
    if (!info.isFile()) throw Error("Resource is not a file.");
    await fs.access(resource, constants.R_OK);
    return {size: info.size};
};
