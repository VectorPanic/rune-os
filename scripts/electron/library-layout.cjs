const fs = require("node:fs");
const path = require("node:path");
const prepareLibrary = require("./library.cjs");

const SHARED = new Set(["config.json", "log", "local", "remote", ".DS_Store"]);

/** Prepares shared settings and independent local/remote content directories. */
module.exports = function prepareLayout(directory, seed, previousRemote) {
    if (!fs.existsSync(directory)) prepareLibrary(directory, seed);
    const local = path.join(directory, "local");
    const remote = path.join(directory, "remote");
    for (const folder of [local, remote]) {
        if (exists(folder) && fs.lstatSync(folder).isSymbolicLink()) throw Error("Library content roots must not be symbolic links.");
    }
    fs.mkdirSync(local, {recursive: true});
    for (const entry of fs.readdirSync(directory)) {
        if (!SHARED.has(entry)) move(path.join(directory, entry), path.join(local, entry));
    }
    prepareLibrary(directory, seed);
    if (previousRemote && fs.existsSync(previousRemote)) {
        if (fs.lstatSync(previousRemote).isSymbolicLink()) throw Error("Legacy remote library must not be a symbolic link.");
        if (fs.existsSync(remote)) {
            if (fs.readdirSync(remote).length) throw Error("Both legacy and new remote libraries exist; preserve and resolve them before startup.");
            fs.rmdirSync(remote);
        }
        fs.renameSync(previousRemote, remote);
    }
    fs.mkdirSync(remote, {recursive: true});
    return {directory, local, remote};
};

/** Resumes interrupted moves without overwriting a single destination file. */
function move(source, target) {
    const entry = fs.lstatSync(source);
    if (entry.isSymbolicLink()) throw Error("Library migration cannot move a symbolic link: " + source);
    if (!exists(target)) {
        fs.renameSync(source, target);
        return;
    }
    const destination = fs.lstatSync(target);
    if (!entry.isDirectory() || !destination.isDirectory() || destination.isSymbolicLink()) {
        throw Error("Library migration would overwrite existing content: " + target);
    }
    for (const name of fs.readdirSync(source)) move(path.join(source, name), path.join(target, name));
    fs.rmdirSync(source);
}

/** Includes dangling links in collision checks. */
function exists(filename) {
    try { fs.lstatSync(filename); return true; }
    catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
