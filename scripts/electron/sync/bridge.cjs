const NativeSyncService = require("./service.cjs");

/** Exposes only scoped sync operations; callers never supply native destination paths. */
module.exports = function registerSync(ipcMain, getOriginalRoot) {
    const sessions = new WeakMap();
    function session(sender) {
        getOriginalRoot(sender);
        const value = sessions.get(sender);
        if (!value) throw Error("Unknown sync window.");
        return value;
    }
    ipcMain.handle("runeos:sync-configure", (event, options) => session(event.sender).configure(options));
    ipcMain.handle("runeos:sync-check", (event, id) => session(event.sender).check(id));
    ipcMain.handle("runeos:sync-stage", (event, id, update) => session(event.sender).stage(id, update));
    ipcMain.handle("runeos:sync-publish", (event, prepared) => session(event.sender).publish(prepared));
    ipcMain.handle("runeos:sync-discard", (event, prepared) => session(event.sender).discard(prepared));
    ipcMain.handle("runeos:sync-cancel", (event, id) => session(event.sender).cancel(id));
    return {
        attach(sender, options) { sessions.set(sender, new NativeSyncService(options)); },
        root(sender, requested) { return session(sender).root(requested); },
        rootFor(sender, resourceUrl) { return session(sender).rootFor(resourceUrl); },
        async dispose(sender) { await session(sender).dispose(); }
    };
};
