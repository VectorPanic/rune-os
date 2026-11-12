const fs = require("node:fs/promises");
const {constants} = require("node:fs");
const {createHash} = require("node:crypto");
const path = require("node:path");

function assertActive(signal) {
    if (signal.aborted) throw Error("Sync operation was cancelled.");
}

/** Owns request timeout and cancellation until the decoded response is consumed. */
async function get(url, signal, timeoutMs, consume) {
    assertActive(signal);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, {once: true});
    const timer = setTimeout(abort, timeoutMs);
    try {
        const response = await fetch(url, {method: "GET", redirect: "error", cache: "no-store", headers: {Accept: "application/json, */*"}, signal: controller.signal});
        if (response.status !== 200) {
            await response.body?.cancel();
            throw Error("Sync HTTP " + response.status + ": " + url);
        }
        return await consume(response.body);
    } finally {
        controller.abort();
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
    }
}

/** Reads bounded manifest bytes; catalog files are parsed only after verification. */
async function json(url, signal, limits) {
    return get(url, signal, limits.timeoutMs, async body => {
        const chunks = [];
        let size = 0;
        for await (const chunk of body) {
            assertActive(signal);
            size += chunk.length;
            if (size > limits.maxManifestSizeBytes) throw Error("Sync manifest-size limit exceeded.");
            chunks.push(chunk);
        }
        return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(Buffer.concat(chunks)));
    });
}

/** Streams raw decoded bytes into a private file, hashing without retaining a bundle. */
async function download(url, target, entry, signal, limits) {
    await fs.mkdir(path.dirname(target), {recursive: true});
    const handle = await fs.open(target, "wx", 0o600);
    try {
        await get(url, signal, limits.timeoutMs, async body => {
            const hash = createHash("sha256");
            let size = 0;
            for await (const chunk of body) {
                assertActive(signal);
                size += chunk.length;
                if (size > entry.size) throw Error("Sync file exceeds declared size: " + entry.path);
                hash.update(chunk);
                let offset = 0;
                while (offset < chunk.length) {
                    const written = await handle.write(chunk, offset, chunk.length - offset);
                    if (!written.bytesWritten) throw Error("Sync file write made no progress.");
                    offset += written.bytesWritten;
                }
            }
            if (size !== entry.size || hash.digest("hex") !== entry.sha256) throw Error("Sync file integrity failure: " + entry.path);
        });
        assertActive(signal);
        await handle.sync();
    } finally { await handle.close(); }
}

/** Verifies installed bytes without executing code or following symbolic links. */
async function verify(filename, entry, signal) {
    assertActive(signal);
    const handle = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
        const info = await handle.stat();
        if (!info.isFile() || info.size !== entry.size) throw Error("Installed sync file size mismatch.");
        const hash = createHash("sha256");
        const buffer = Buffer.alloc(65536);
        let position = 0;
        while (true) {
            assertActive(signal);
            const read = await handle.read(buffer, 0, buffer.length, position);
            if (!read.bytesRead) break;
            position += read.bytesRead;
            hash.update(buffer.subarray(0, read.bytesRead));
        }
        if (position !== entry.size || hash.digest("hex") !== entry.sha256) throw Error("Installed sync file checksum mismatch.");
    } finally { await handle.close(); }
}

module.exports = {assertActive, json, download, verify};
