const fs = require("node:fs");
const path = require("node:path");

/** Tracks library changes without reading game bundles or notifying a running game. */
module.exports = function watchLibrary(directory) {
    let revision = 0;
    let changedAt = 0;
    let closed = false;
    let failure = null;
    let watcher = null;
    try {
        watcher = fs.watch(directory, {recursive: true}, function(event, filename) {
            const parts = filename ? String(filename).split(path.sep) : [];
            if (parts.some(part => part.startsWith("."))) return;
            if (parts.length && !["games", "screensaver", "categories.json", "tags.json"].includes(parts[0])) return;
            revision++;
            changedAt = Date.now();
        });
        watcher.on("error", function(error) { failure = error; });
    } catch (error) {
        failure = error;
    }
    return {
        /** Waits for copying to settle, but never blocks indefinitely. */
        async read() {
            const started = Date.now();
            while (!closed && !failure && Date.now() - changedAt < 750) {
                if (Date.now() - started >= 5000) throw Error("Library files are still changing.");
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (closed) throw Error("Library watcher is closed.");
            if (failure) throw failure;
            return revision;
        },
        close() {
            if (closed) return;
            closed = true;
            if (watcher) watcher.close();
        }
    };
};
