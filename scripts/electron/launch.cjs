const {app, BrowserWindow, ipcMain} = require("electron");
const path = require("path");
const {pathToFileURL} = require("url");
const prepareLayout = require("./library-layout.cjs");
const contentFolders = require("./content-folders.cjs");
const fileInfo = require("./file-info.cjs");
const watchLibrary = require("./library-watch.cjs");
const createApplicationLog = require("./application-log.cjs");
const registerSync = require("./sync/bridge.cjs");

/** Creates the shared debug/distribution window and owns native fullscreen input. */
module.exports = function launch(page, options) {
    options = options || {};
    const libraryRoots = new WeakMap();
    const libraryWatchers = new WeakMap();
    const libraryLogs = new WeakMap();
    const librarySync = registerSync(ipcMain, getLibraryRoot);
    ipcMain.handle("runeos:application-log", function(event, report) {
        getLibraryRoot(event.sender);
        return libraryLogs.get(event.sender)(report);
    });
    ipcMain.handle("runeos:library-revision", function(event) {
        getLibraryRoot(event.sender);
        return libraryWatchers.get(event.sender).read();
    });
    ipcMain.handle("runeos:file-info", function(event, resourceUrl) {
        return fileInfo(librarySync.rootFor(event.sender, resourceUrl), resourceUrl);
    });
    ipcMain.handle("runeos:game-folders", function(event, rootUrl) {
        return contentFolders(librarySync.root(event.sender, rootUrl), "games");
    });
    ipcMain.handle("runeos:screensaver-folders", function(event, rootUrl) {
        return contentFolders(librarySync.root(event.sender, rootUrl), "screensaver");
    });

    /** Returns only the library assigned to a registered window. */
    function getLibraryRoot(sender) {
        const root = libraryRoots.get(sender);
        if (!root) throw Error("Unknown library window.");
        return root;
    }

    function createWindow() {
        const directory = options.libraryDirectory || path.join(app.getPath("userData"), "library");
        const previousRemote = options.libraryDirectory ? null : path.join(app.getPath("userData"), "api-library");
        const layout = prepareLayout(directory, path.resolve(__dirname, "../../library"), previousRemote);
        const libraryRootUrl = pathToFileURL(layout.local + path.sep).href;
        const settingsRootUrl = pathToFileURL(directory + path.sep).href;
        const window = new BrowserWindow({
            width: 1280,
            height: 720,
            useContentSize: true,
            resizable: false,
            fullscreenable: true,
            fullscreen: !process.argv.includes("--windowed"),
            backgroundColor: "#000000",
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "preload.cjs"),
                additionalArguments: ["--runeos-library=" + libraryRootUrl, "--runeos-settings=" + settingsRootUrl]
            }
        });

        const contents = window.webContents;
        libraryRoots.set(contents, libraryRootUrl);
        librarySync.attach(contents, {rootUrl: libraryRootUrl, directory: layout.remote});
        libraryLogs.set(contents, createApplicationLog(settingsRootUrl));
        const watcher = watchLibrary(layout.local);
        libraryWatchers.set(contents, watcher);
        contents.on("destroyed", function() {
            watcher.close();
            librarySync.dispose(contents).catch(function(error) { console.warn("Sync disposal: " + error.message); });
        });

        // Native handling also works while a game owns the renderer keyboard.
        contents.on("before-input-event", function(event, input) {
            if (input.type === "keyDown" && input.key === "F11") {
                event.preventDefault();
                if (!input.isAutoRepeat) window.setFullScreen(!window.isFullScreen());
            }
        });
        window.loadFile(page);
    }

    app.whenReady().then(createWindow);
    app.on("activate", function() {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    app.on("window-all-closed", function() {
        if (process.platform !== "darwin") app.quit();
    });
};
