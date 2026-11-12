const migrateFolders = require("./migrate-folders.cjs");

/** Imports the legacy screensaver manifest into independent saver directories. */
module.exports = directory => migrateFolders(directory, {
    manifest: "screensavers.json", marker: ".screensaver-folders-migrated",
    collection: "screensavers", directory: "screensaver"
});
