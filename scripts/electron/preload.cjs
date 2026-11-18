const {contextBridge, ipcRenderer} = require("electron");
const prefix = "--runeos-library=";
const argument = process.argv.find(value => value.startsWith(prefix));
const settingsPrefix = "--runeos-settings=";
const settings = process.argv.find(value => value.startsWith(settingsPrefix));

// Exposes scoped library operations without arbitrary filesystem access.
if (argument) {
    contextBridge.exposeInMainWorld("runeosEnvironment", {
        libraryRootUrl: argument.slice(prefix.length),
        settingsRootUrl: settings ? settings.slice(settingsPrefix.length) : argument.slice(prefix.length),
        libraryRevision() {
            return ipcRenderer.invoke("runeos:library-revision");
        },
        listGameFolders(rootUrl) {
            return ipcRenderer.invoke("runeos:game-folders", rootUrl);
        },
        listScreensaverFolders(rootUrl) {
            return ipcRenderer.invoke("runeos:screensaver-folders", rootUrl);
        },
        configureSync(options) { return ipcRenderer.invoke("runeos:sync-configure", options); },
        checkSync(id) { return ipcRenderer.invoke("runeos:sync-check", id); },
        stageSync(id, update) { return ipcRenderer.invoke("runeos:sync-stage", id, update); },
        publishSync(prepared) { return ipcRenderer.invoke("runeos:sync-publish", prepared); },
        discardSync(prepared) { return ipcRenderer.invoke("runeos:sync-discard", prepared); },
        cancelSync(id) { return ipcRenderer.invoke("runeos:sync-cancel", id); },
        configureHighscores(options) { return ipcRenderer.invoke("runeos:highscores-configure", options); },
        syncHighscores(id, tables) { return ipcRenderer.invoke("runeos:highscores-sync", id, tables); },
        writeApplicationLog(report) {
            return ipcRenderer.invoke("runeos:application-log", report);
        },
        fileInfo(resourceUrl) {
            return ipcRenderer.invoke("runeos:file-info", resourceUrl);
        }
    });
}
