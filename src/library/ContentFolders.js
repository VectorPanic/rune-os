//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a folder catalog reader with a borrowed JSON transport.
 *
 * @constructor
 * @param {Function} listFolders Lists published directory names.
 * @param {Function} readJson Reads one JSON document.
 * @param {string} rootUrl Library root URL.
 * @param {Object} options Directory, identity prefix and optional atlas flag.
 *
 * @class
 * @classdesc
 * Reads independent content metadata and derives resources from directory names.
 */
runeos.library.ContentFolders = function(listFolders, readJson, rootUrl, options) {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Borrowed published-directory provider.
     *
     * @type {Function}
     * @private
     */
    this.m_listFolders = listFolders;

    /**
     * Borrowed JSON document transport.
     *
     * @type {Function}
     * @private
     */
    this.m_readJson = readJson;

    /**
     * Library root used to resolve conventional resource names.
     *
     * @type {string}
     * @private
     */
    this.m_rootUrl = rootUrl;

    /**
     * Directory, identity prefix and optional atlas convention.
     *
     * @type {Object}
     * @private
     */
    this.m_options = options;
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Reads a catalog sequentially, isolating malformed metadata per directory.
 *
 * @param {Function} assertCurrent Rejects cancelled work before further reads.
 *
 * @returns {Promise.<Object>} Items and discovery diagnostics.
 */
runeos.library.ContentFolders.prototype.load = function(assertCurrent) {
    var reader = this;
    var document = {
        items: [],
        errors: []
    };
    return Promise.resolve().then(function() {
        assertCurrent();
        return reader.m_listFolders();
    }).then(function(names) {
        assertCurrent();
        if (!Array.isArray(names)) throw Error("Invalid content directory listing.");
        return names.reduce(function(pending, name) {
            return pending.then(function() {
                assertCurrent();
                return reader.m_readItem(name).then(function(item) {
                    assertCurrent();
                    document.items.push(item);
                }, function(error) {
                    assertCurrent();
                    document.errors.push(String(name) + ": " + error.message);
                });
            });
        }, Promise.resolve());
    }).then(function() {
        assertCurrent();
        return document;
    });
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Resolves a single directory's metadata and conventional resource names.
 *
 * @param {string} name Published directory name.
 *
 * @returns {Promise.<Object>} Copied content definition.
 * @private
 */
runeos.library.ContentFolders.prototype.m_readItem = function(name) {
    var reader = this;
    return Promise.resolve().then(function() {
        if (typeof name !== "string" || !name || name.charAt(0) === "." || /[\\/]/.test(name)) {
            throw Error("Invalid content directory name.");
        }
        var filename = encodeURIComponent(name);
        var base = runeos.util.Paths.resolve(reader.m_options.directory + "/" + filename + "/" + filename, reader.m_rootUrl);
        return reader.m_readJson(base + ".json").then(function(metadata) {
            if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw Error("Expected a content metadata object.");
            var item = {};
            Object.keys(metadata).forEach(function(key) { item[key] = metadata[key]; });
            item.id = reader.m_options.prefix + ":" + name;
            item.binary = base + ".js";
            if (reader.m_options.image) item.image = base + ".png";
            return item;
        });
    });
};
