//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new TilemapOptions instance.
 *
 * @constructor
 *
 * @param {Object} [options] Partial tiles, tilemaps, text and advanced groups.
 * @param {runeos.ui.tilemap.TilemapOptions} [parent] Immutable inherited settings.
 *
 * @class
 * @classdesc
 *
 * Resolves component configuration at its boundary. Unchanged child settings
 * reuse the same snapshot; overrides create validated immutable derived groups.
 * Data, display resources and callbacks are not retained in this snapshot.
 */
runeos.ui.tilemap.TilemapOptions = function(options, parent) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) {
        throw new TypeError("Expected TilemapOptions groups.");
    }
    if (parent !== undefined && !(parent instanceof runeos.ui.tilemap.TilemapOptions)) {
        throw new TypeError("Expected TilemapOptions parent.");
    }

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Card geometry and appearance.
     *
     * @type {Object}
     */
    this.tiles = runeos.ui.tilemap.TilemapOptions.m_group("tiles", options.tiles, parent);

    /**
     * Viewport spacing and transitions.
     *
     * @type {Object}
     */
    this.tilemaps = runeos.ui.tilemap.TilemapOptions.m_group("tilemaps", options.tilemaps, parent);

    /**
     * Typography and reading behavior.
     *
     * @type {Object}
     */
    this.text = runeos.ui.tilemap.TilemapOptions.m_group("text", options.text, parent);

    /**
     * Bounded layout search limits.
     *
     * @type {Object}
     */
    this.advanced = runeos.ui.tilemap.TilemapOptions.m_group("advanced", options.advanced, parent);

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Freezes the completed configuration snapshot.
     */
    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Original OS defaults used by legacy component constants.
 *
 * @constant {Object}
 */
runeos.ui.tilemap.TilemapOptions.DEFAULTS = Object.freeze({
    tiles: runeos.system.Config.DEFAULTS.tiles,
    tilemaps: runeos.system.Config.DEFAULTS.tilemaps,
    text: runeos.system.Config.DEFAULTS.text,
    advanced: runeos.system.Config.DEFAULTS.advanced
});

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Resolves component constructor options, preserving legacy config/textConfig/
 * tileConfig/advancedConfig inputs. Explicit settings override inherited settings.
 *
 * @param {Object} [options] Component constructor options.
 * @param {string} [group="tiles"] Meaning of the legacy config property.
 * @param {runeos.ui.tilemap.TilemapOptions} [parent] Inherited component settings.
 *
 * @returns {runeos.ui.tilemap.TilemapOptions} Immutable settings snapshot.
 */
runeos.ui.tilemap.TilemapOptions.resolve = function(options, group, parent) {
    options = options || {};
    if (group !== undefined && group !== "tiles" && group !== "tilemaps") {
        throw new Error("Unknown component configuration group: " + group);
    }
    var base = options.settings === undefined ? parent : options.settings;
    if (base !== undefined && !(base instanceof runeos.ui.tilemap.TilemapOptions)) {
        throw new TypeError("Expected TilemapOptions settings.");
    }
    var groups = {
        tiles: options.tileConfig,
        tilemaps: undefined,
        text: options.textConfig,
        advanced: options.advancedConfig
    };
    if (options.config !== undefined) groups[group || "tiles"] = options.config;
    if (base && (groups.tiles === undefined || groups.tiles === base.tiles) &&
        (groups.tilemaps === undefined || groups.tilemaps === base.tilemaps) &&
        (groups.text === undefined || groups.text === base.text) &&
        (groups.advanced === undefined || groups.advanced === base.advanced)) return base;
    return new runeos.ui.tilemap.TilemapOptions(groups, base);
};

/**
 * Validates mutable grid geometry before layout or reconciliation.
 *
 * @param {number} columns Positive integer number of columns.
 * @param {number} padding Nonnegative spacing in pixels.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TilemapOptions.validateGrid = function(columns, padding) {
    if (typeof columns !== "number" || !isFinite(columns) || columns < 1 ||
        Math.floor(columns) !== columns) throw new RangeError("Invalid columns.");
    if (typeof padding !== "number" || !isFinite(padding) || padding < 0) {
        throw new RangeError("Invalid tile padding.");
    }
};

//------------------------------------------------------------------------------
// Private static methods
//------------------------------------------------------------------------------

/**
 * Reuses inherited groups or merges and validates a supplied override.
 *
 * @param {string} name Configuration group.
 * @param {Object} overrides Partial group settings.
 * @param {runeos.ui.tilemap.TilemapOptions} [parent] Inherited settings.
 *
 * @returns {Object} Immutable configuration group.
 * @private
 */
runeos.ui.tilemap.TilemapOptions.m_group = function(name, overrides, parent) {
    if (!parent) return runeos.system.Config.getGroup(name, overrides);
    if (overrides === undefined || overrides === parent[name]) return parent[name];
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
        throw new TypeError("Expected configuration group: " + name);
    }
    var merged = {};
    Object.keys(parent[name]).forEach(function(key) { merged[key] = parent[name][key]; });
    Object.keys(overrides).forEach(function(key) { merged[key] = overrides[key]; });
    return runeos.system.Config.getGroup(name, merged);
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Copies child constructor options and supplies inherited normalized settings.
 * Removes legacy configuration inputs after resolving them to avoid revalidation.
 *
 * @param {Object} [options] Child data and optional configuration overrides.
 * @param {string} [group="tiles"] Meaning of the legacy config property.
 *
 * @returns {Object} Independent child options; caller data is never changed.
 */
runeos.ui.tilemap.TilemapOptions.prototype.configure = function(options, group) {
    var result = {};
    Object.keys(options || {}).forEach(function(key) {
        if (["config", "tileConfig", "textConfig", "advancedConfig", "settings"].indexOf(key) < 0) {
            result[key] = options[key];
        }
    });
    result.settings = runeos.ui.tilemap.TilemapOptions.resolve(options, group, this);
    return result;
};

/**
 * Resolves and validates viewport geometry independently of its display object.
 *
 * @param {Object} options Viewport constructor options.
 *
 * @returns {Object} Width, height, gap, duration, contentTop and selection callback.
 */
runeos.ui.tilemap.TilemapOptions.prototype.viewport = function(options) {
    var result = {
        width: options.width === undefined ? runeos.display.Screen.DEFAULT_WIDTH : options.width,
        height: options.height === undefined ? runeos.display.Screen.DEFAULT_HEIGHT : options.height,
        gap: options.gap === undefined ? this.tilemaps.gapPx : options.gap,
        duration: options.duration === undefined ? this.tilemaps.transitionMs : options.duration,
        contentTop: options.contentTop === undefined ? 0 : options.contentTop,
        onSelectionChange: options.onSelectionChange === undefined ? null : options.onSelectionChange
    };
    var values = [result.width, result.height, result.gap, result.duration, result.contentTop];
    for (var i = 0; i < values.length; i++) {
        if (typeof values[i] !== "number" || !isFinite(values[i]) || values[i] < 0) {
            throw new TypeError("Invalid Tilemaps options.");
        }
    }
    if (result.width === 0 || result.height === 0 || result.contentTop >= result.height ||
        (result.onSelectionChange !== null && typeof result.onSelectionChange !== "function")) {
        throw new TypeError("Invalid Tilemaps options.");
    }
    return result;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Validates group names and prevents mutation after construction.
 *
 * @param {!Object} options Supplied configuration groups.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TilemapOptions.prototype.m_construct = function(options) {
    Object.keys(options).forEach(function(key) {
        if (["tiles", "tilemaps", "text", "advanced"].indexOf(key) < 0) {
            throw new Error("Unknown TilemapOptions group: " + key);
        }
    });
    Object.freeze(this);
};
