//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Library instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Shared asynchronous content-source contract. Providers return catalog
 * documents
 * and launcher-ready URLs; scenes never need to know how content is stored.
 */
runeos.library.Library = function() {

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Last successfully loaded catalog, or null.
     *
     * @type {Object}
     */
    this.catalog = null;

    /**
     * Independently loaded and inspected screensaver definitions.
     *
     * @type {Array.<Object>}
     */
    this.screensavers = [];

    /**
     * Validation diagnostics for the current catalog.
     *
     * @type {Array.<string>}
     */
    this.errors = [];

};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Loads catalog documents through the active content provider.
 *
 * @param {boolean} [force=false] Whether to refresh cached catalog data.
 * @param {boolean} [strict=false] Whether incomplete updates must preserve the active list.
 *
 * @returns {Promise.<Object>} Object containing games, categories and tags documents.
 */
runeos.library.Library.prototype.loadCatalog = function(force, strict) {
    return Promise.reject(new Error("Library.loadCatalog must be implemented."));
};

/**
 * Reloads catalog files and preserves the active catalog when a candidate is
 * invalid or incomplete. Used when updating content in a running OS.
 *
 * @returns {Promise.<Object>} Refreshed catalog.
 */
runeos.library.Library.prototype.refreshCatalog = function() {
    return this.loadCatalog(true, true);
};

/**
 * Prepares a registered game and resolves its executable bundle URL.
 *
 * @param {string} gameId Registered game ID.
 *
 * @returns {Promise.<string>} Ready-to-execute bundle URL for Application.
 */
runeos.library.Library.prototype.prepareGame = function(gameId) {
    return Promise.reject(new Error("Library.prepareGame must be implemented."));
};

/**
 * Loads the independent screensaver document without game/category rules.
 *
 * @param {boolean} [force=false] Whether to refresh cached definitions.
 * @param {boolean} [strict=false] Whether incomplete updates must preserve the active list.
 *
 * @returns {Promise.<Array.<Object>>} Installed-content screensaver definitions.
 */
runeos.library.Library.prototype.loadScreensavers = function(force, strict) {
    return Promise.resolve(this.screensavers);
};

/**
 * Reloads screensaver files and preserves the active definitions when a
 * candidate is invalid or incomplete.
 *
 * @returns {Promise.<Array.<Object>>} Refreshed screensaver definitions.
 */
runeos.library.Library.prototype.refreshScreensavers = function() {
    return this.loadScreensavers(true, true);
};

/**
 * Rechecks an independently registered screensaver before execution.
 *
 * @param {string} screensaverId Internal screensaver identifier.
 *
 * @returns {Promise.<string>} Executable bundle URL.
 */
runeos.library.Library.prototype.prepareScreensaver = function(screensaverId) {
    return Promise.reject(Error("Library.prepareScreensaver must be implemented."));
};

/**
 * Releases provider resources.
 *
 * @returns {undefined}
 */
runeos.library.Library.prototype.dispose = function() {
    this.screensavers = [];
    this.catalog = null;
    this.errors = [];
};
