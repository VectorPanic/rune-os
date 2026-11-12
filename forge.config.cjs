const path = require("node:path");
const catalog = require("./scripts/electron/sync/catalog.cjs");

//------------------------------------------------------------------------------
// Files included in the packaged application
//------------------------------------------------------------------------------

const runtimeDirectories = [
    "bin",
    "dist/source",
    "asset",
    "library",
    "scripts/electron"
];

// Catalog validation also runs in Electron and needs these source files.
const validationFiles = catalog.SOURCES.map(name => "src/" + name + ".js");
const runtimePaths = runtimeDirectories.concat(validationFiles);
const runtimeFiles = ["package.json", "LICENSE", "LICENSE.txt", "LICENSE.md"];

// Local logs and downloaded libraries must not become bundled starter content.
const localDirectories = ["library/log", "library/remote"];
const temporaryFiles = [".DS_Store", ".gitkeep"];

//------------------------------------------------------------------------------
// Packaging rules
//------------------------------------------------------------------------------

/**
 * Converts Electron Packager paths to project-relative paths with forward slashes.
 * @param {string} file Path supplied by Electron Packager.
 * @returns {string} Normalized project-relative path.
 */
function relativePath(file) {
    return file.replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * Checks whether a path is a directory itself or one of its children.
 * @param {string} file Project-relative path.
 * @param {string} directory Project-relative directory.
 * @returns {boolean} Whether the path belongs to the directory.
 */
function isWithin(file, directory) {
    return file === directory || file.startsWith(directory + "/");
}

/**
 * Identifies temporary files and local library data excluded from every package.
 * @param {string} file Normalized project-relative path.
 * @returns {boolean} Whether the path must be excluded.
 */
function isLocalFile(file) {
    const name = file.split("/").pop();

    return temporaryFiles.includes(name)
        || file === "library/README.md"
        || localDirectories.some(directory => isWithin(file, directory));
}

/**
 * Keeps runtime paths and the parent directories needed to reach them.
 * @param {string} file Normalized project-relative path.
 * @returns {boolean} Whether the path is needed by the application.
 */
function isRuntimeFile(file) {
    if (runtimeFiles.includes(file)) {
        return true;
    }

    return runtimePaths.some(runtime => isWithin(file, runtime) || runtime.startsWith(file + "/"));
}

/**
 * Decides which paths Electron Packager should skip while copying the application.
 * @param {string} file Root-relative path supplied by Electron Packager.
 * @returns {boolean} Whether to exclude the path.
 */
function ignore(file) {
    const relative = relativePath(file);

    if (relative === "") {
        return false;
    }
    if (isLocalFile(relative)) {
        return true;
    }

    return !isRuntimeFile(relative);
}

//------------------------------------------------------------------------------
// Electron Forge configuration
//------------------------------------------------------------------------------

module.exports = {
    outDir: "dist/build",
    packagerConfig: {
        name: "Rune OS",
        icon: path.join(__dirname, "dist/build/runeos.icns"),
        appBundleId: "com.vectorpanic.runeos",
        appCategoryType: "public.app-category.games",
        asar: true,
        prune: true,
        ignore
    }
};
