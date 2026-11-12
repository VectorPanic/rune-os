const migrateFolders = require("./migrate-folders.cjs");

/** Imports legacy games without overwriting independently maintained metadata. */
module.exports = directory => migrateFolders(directory, {
    manifest: "games.json", marker: ".game-folders-migrated",
    collection: "games", directory: "games", image: true
});
