const fs = require("node:fs/promises");
const path = require("node:path");
const {fileURLToPath} = require("node:url");
const {randomUUID} = require("node:crypto");

const MAX_LOG_FILES = 50;
const LOG_FILENAME = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}_[a-z0-9-]+_[0-9a-f-]{36}\.log$/;

/** Serializes incident writes and retention for one window's assigned library. */
module.exports = function createApplicationLog(rootUrl) {
    let pending = Promise.resolve();
    return function writeApplicationLog(report) {
        const operation = pending.then(() => writeReport(rootUrl, report));
        pending = operation.catch(() => {});
        return operation;
    };
};

/** Restricts storage to a real log directory inside the assigned library. */
async function getLogDirectory(rootUrl) {
    const root = await fs.realpath(fileURLToPath(rootUrl));
    const directory = path.join(root, "log");
    try { await fs.mkdir(directory); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    const info = await fs.lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error("Library log must be a directory, not a link.");
    return directory;
}

/** Accepts bounded text only; reports never supply filesystem paths to write. */
function readText(report, key, maximum) {
    if (typeof report[key] !== "string") throw Error("Invalid application log field: " + key);
    return report[key].slice(0, maximum);
}

/** Normalizes renderer data before creating any filesystem entries. */
function readReport(report) {
    if (!report || typeof report !== "object" || Array.isArray(report)) throw Error("Invalid application log report.");
    const phase = readText(report, "phase", 32);
    if (!["preparation", "startup", "runtime"].includes(phase)) throw Error("Invalid application log phase.");
    return {
        name: readText(report, "name", 256),
        id: readText(report, "id", 512),
        source: readText(report, "source", 2048),
        phase,
        errorName: readText(report, "errorName", 128),
        message: readText(report, "message", 16384),
        stack: readText(report, "stack", 65536)
    };
}

/** Creates one unique incident file, then removes only this logger's oldest files. */
async function writeReport(rootUrl, value) {
    const report = readReport(value);
    const directory = await getLogDirectory(rootUrl);
    const time = new Date().toISOString();
    const stamp = time.replace("T", "_").replace(/[:.]/g, "-").replace("Z", "");
    const slug = (report.name || report.id || "application").normalize("NFKD")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "application";
    const filename = stamp + "_" + slug + "_" + randomUUID() + ".log";
    const text = [
        "Time (UTC): " + time,
        "Application: " + report.name,
        "ID: " + report.id,
        "Source: " + report.source,
        "Phase: " + report.phase,
        "Error: " + report.errorName,
        "",
        report.message,
        "",
        "Stack trace:",
        report.stack || "Not available.",
        ""
    ].join("\n");
    await fs.writeFile(path.join(directory, filename), text, {flag: "wx", mode: 0o600});
    await pruneLogs(directory);
}

/** Preserves unrelated files and never follows symbolic links during retention. */
async function pruneLogs(directory) {
    const entries = await fs.readdir(directory, {withFileTypes: true});
    const files = entries.filter(entry => entry.isFile() && LOG_FILENAME.test(entry.name))
        .map(entry => entry.name).sort().reverse();
    for (const name of files.slice(MAX_LOG_FILES)) await fs.unlink(path.join(directory, name));
}
