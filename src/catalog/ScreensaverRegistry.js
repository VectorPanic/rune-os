//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ScreensaverRegistry instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Validates screensavers independently of game DNA, players and development
 * stages. Only a name and executable are required; author/year are optional.
 */
runeos.catalog.ScreensaverRegistry = function() {

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Accepted screensaver definitions.
     *
     * @type {Array.<runeos.catalog.ScreensaverRegistry.Definition>}
     */
    this.items = [];

    /**
     * Diagnostics for rejected definitions.
     *
     * @type {Array.<string>}
     */
    this.errors = [];

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Definitions indexed by content identifier.
     *
     * @type {!Object<string, runeos.catalog.ScreensaverRegistry.Definition>}
     * @private
     */
    this.m_ids = Object.create(null);
};

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Independent screensaver metadata with resolved executable paths.
 *
 * @typedef {{
 *     id: (string|undefined),
 *     name: string,
 *     binary: string,
 *     author: (string|undefined),
 *     year: (number|undefined),
 *     requiredFiles: (Array<string>|undefined),
 *     installed: (boolean|undefined),
 *     enabled: (boolean|undefined)
 * }}
 */
runeos.catalog.ScreensaverRegistry.Definition;

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Identifies screensavers without adding IDs to their JSON metadata.
 *
 * @param {Object} item Screensaver definition.
 *
 * @returns {string} Internal identifier.
 */
runeos.catalog.ScreensaverRegistry.getId = function(item) {
    return item.id || "screensaver:" + item.binary;
};

/**
 * Finds enabled, installed screensavers without applying game-stage filters.
 *
 * @param {Array.<runeos.catalog.ScreensaverRegistry.Definition>} items Screensaver definitions.
 *
 * @returns {Array.<runeos.catalog.ScreensaverRegistry.Definition>} Eligible definitions.
 */
runeos.catalog.ScreensaverRegistry.getAvailable = function(items) {
    return items.filter(function(item) { return item.enabled !== false && item.installed !== false; });
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Replaces definitions with validated records from screensaver metadata.
 *
 * @param {Object} document Screensavers document.
 *
 * @returns {Array.<string>} Rejected-record diagnostics.
 */
runeos.catalog.ScreensaverRegistry.prototype.replace = function(document) {
    var registry = this;
    var result = runeos.util.Validation.validateRecords(document, "screensavers", function(item) {
        registry.m_validateScreensaver(item);
    }, runeos.catalog.ScreensaverRegistry.getId);
    this.items = result.items;
    this.errors = result.errors;
    this.m_ids = result.ids;
    return this.errors;
};

/**
 * Returns a registered definition by its internal identifier.
 *
 * @param {string} id Internal identifier.
 *
 * @returns {?runeos.catalog.ScreensaverRegistry.Definition} Definition or null.
 */
runeos.catalog.ScreensaverRegistry.prototype.get = function(id) {
    return this.m_ids[id] || null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Validates executable and display metadata without applying game rules.
 *
 * @param {runeos.catalog.ScreensaverRegistry.Definition} item Screensaver definition.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.ScreensaverRegistry.prototype.m_validateScreensaver = function(item) {
    var rules = runeos.util.Validation;
    rules.validateText(item.name, "name");
    if (item.id !== undefined) rules.validateText(item.id, "id");
    rules.validatePath(item.binary, "binary");
    if (item.author !== undefined) rules.validateText(item.author, "author");
    if (item.year !== undefined && !rules.isInteger(item.year, 0)) throw Error("Invalid year");
    if (item.enabled !== undefined && typeof item.enabled !== "boolean") throw Error("Invalid enabled");
    rules.validateRequiredFiles(item.requiredFiles);
};
