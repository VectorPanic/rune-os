const path = require("node:path");

const DEFAULTS = Object.freeze({
    baseUrl: "http://localhost:8888/rune-cloud/v1/",
    timeoutMs: 15000,
    maxFiles: 10000,
    maxManifestSizeBytes: 2097152,
    maxFileSizeBytes: 268435456,
    maxTotalSizeBytes: 536870912
});

/** Resolves a configured API prefix without losing deployment subdirectories. */
function settings(options) {
    const result = {...DEFAULTS};
    for (const key of Object.keys(DEFAULTS)) if (options[key] !== undefined) result[key] = options[key];
    const url = new URL(result.baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error("Invalid sync API base URL.");
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    result.baseUrl = url.href;
    for (const key of Object.keys(DEFAULTS).filter(key => key !== "baseUrl")) {
        if (!Number.isSafeInteger(result[key]) || result[key] <= 0) throw Error("Invalid sync limit: " + key);
    }
    return Object.freeze(result);
}

/** Rejects relative paths that could escape a snapshot or change URL meaning. */
function relativePath(value) {
    if (typeof value !== "string" || !value || value.length > 1024 || /[\\\x00-\x1f:?#]/.test(value) || /%(?:2e|2f|5c|00)/i.test(value)) throw Error("Unsafe sync path.");
    const parts = value.split("/");
    if (parts.some(part => !part || part === "." || part === "..")) throw Error("Unsafe sync path segment.");
    return parts;
}

/** Revisions are opaque identifiers, never ordered or interpreted as versions. */
function revision(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw Error("Invalid sync revision.");
    return value;
}

/** Validates the complete published file inventory before any downloads begin. */
function validate(document, limits) {
    if (!document || document.schemaVersion !== 1 || !Array.isArray(document.files)) throw Error("Unsupported sync manifest.");
    revision(document.revision);
    if (document.files.length > limits.maxFiles) throw Error("Sync file-count limit exceeded.");
    const names = new Set();
    let total = 0;
    const files = document.files.map(entry => {
        if (!entry || typeof entry !== "object") throw Error("Invalid sync file entry.");
        const parts = relativePath(entry.path);
        if (!["categories.json", "tags.json"].includes(entry.path) &&
            (!(parts[0] === "games" || parts[0] === "screensaver") || parts.length < 3 || parts[1].startsWith("."))) throw Error("Unsupported sync target: " + entry.path);
        const key = entry.path.normalize("NFC").toLowerCase();
        if (names.has(key)) throw Error("Duplicate sync path: " + entry.path);
        names.add(key);
        if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > limits.maxFileSizeBytes) throw Error("Invalid sync file size.");
        if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw Error("Invalid sync checksum.");
        total += entry.size;
        if (!Number.isSafeInteger(total) || total > limits.maxTotalSizeBytes) throw Error("Sync total-size limit exceeded.");
        return {path: entry.path, size: entry.size, sha256: entry.sha256};
    });
    for (const name of ["categories.json", "tags.json"]) if (!names.has(name)) throw Error("Missing shared catalog file: " + name);
    for (const entry of files) {
        const parts = entry.path.split("/");
        for (let i = 1; i < parts.length; i++) if (names.has(parts.slice(0, i).join("/").normalize("NFC").toLowerCase())) throw Error("Sync file/directory collision.");
    }
    return {schemaVersion: 1, revision: document.revision, files};
}

/** Encodes identifiers and individual segments, preserving the configured prefix. */
function fileUrl(baseUrl, version, filename) {
    return new URL("library/releases/" + encodeURIComponent(version) + "/" + relativePath(filename).map(encodeURIComponent).join("/"), baseUrl).href;
}

/** Keeps every managed path inside its explicitly supplied local root. */
function destination(root, filename) {
    relativePath(filename);
    const target = path.resolve(root, filename);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith(".." + path.sep) || relative === ".." || path.isAbsolute(relative)) throw Error("Sync destination is outside its root.");
    return target;
}

module.exports = {DEFAULTS, settings, relativePath, revision, validate, fileUrl, destination};
