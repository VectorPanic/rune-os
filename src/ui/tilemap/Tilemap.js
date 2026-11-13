//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Tilemap instance.
 *
 * @constructor
 * @extends runeos.display.DisplayGroup
 *
 * @param {Object} [options] Configuration for this instance.
 *
 * @class
 * @classdesc
 *
 * A three-column tile container with first-fit packing and directional
 * navigation.
 */
runeos.ui.tilemap.Tilemap = function(options) {
    options = options || {};
    var resolved = runeos.ui.tilemap.TilemapOptions.resolve(options, "tiles");
    var settings = resolved.tiles;

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    /**
     * Extends runeos.display.DisplayGroup.
     */
    runeos.display.DisplayGroup.call(this);

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Group identifier.
     *
     * @type {string}
     */
    this.id = options.id || "";

    /**
     * Group label.
     *
     * @type {string}
     */
    this.name = options.name || "";

    /**
     * Category description displayed below the CategoryHeader title.
     *
     * @type {string}
     */
    this.description = options.description || "";

    /**
     * Space between grid cells in pixels.
     *
     * @type {number}
     */
    this.padding = options.padding === undefined ? settings.paddingPx : options.padding;

    /**
     * Number of grid columns.
     *
     * @type {number}
     */
    this.columns = options.columns === undefined ? settings.columns : options.columns;

    //--------------------------------------------------------------------------
    // Internal properties
    //--------------------------------------------------------------------------

    /**
     * Whether this map has been active and should retain its selected Tile.
     *
     * @type {boolean}
     * @package
     */
    this.m_hasBeenActive = false;

    /**
     * Owning navigation manager.
     *
     * @type {runeos.ui.tilemap.Tilemaps}
     * @package
     */
    this.m_owner = null;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Normalized component settings shared with owned children.
     *
     * @type {runeos.ui.tilemap.TilemapOptions}
     * @private
     */
    this.m_options = resolved;

    /**
     * Immutable tiles settings for this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = resolved.tiles;

    /**
     * Tiles in insertion order.
     *
     * @type {Array.<runeos.ui.tilemap.Tile>}
     * @private
     */
    this.m_tiles = [];

    /**
     * Selected tile.
     *
     * @type {runeos.ui.tilemap.Tile}
     * @private
     */
    this.m_selected = null;

    /**
     * Configuration and priorities used by the last completed layout.
     *
     * @type {Object}
     * @private
     */
    this.m_layoutState = {
        columns: this.columns,
        padding: this.padding,
        priorities: []
    };

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Validates options and initializes the layout dimensions.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.ui.tilemap.Tilemap.prototype = Object.create(runeos.display.DisplayGroup.prototype);
runeos.ui.tilemap.Tilemap.prototype.constructor = runeos.ui.tilemap.Tilemap;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Snapshot of the tile list.
 *
 * @member {Array.<runeos.ui.tilemap.Tile>} tiles
 * @memberof runeos.ui.tilemap.Tilemap
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemap.prototype, "tiles", {
    /**
     * @this runeos.ui.tilemap.Tilemap
     * @returns {Array.<runeos.ui.tilemap.Tile>}
     * @ignore
     */
    get : function() {
        return this.m_tiles.slice();
    }
});

/**
 * Number of tiles without allocating a collection snapshot.
 *
 * @member {number} length
 * @memberof runeos.ui.tilemap.Tilemap
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemap.prototype, "length", {
    /**
     * @this runeos.ui.tilemap.Tilemap
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_tiles.length;
    }
});

/**
 * Currently selected tile.
 *
 * @member {runeos.ui.tilemap.Tile} selected
 * @memberof runeos.ui.tilemap.Tilemap
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemap.prototype, "selected", {
    /**
     * @this runeos.ui.tilemap.Tilemap
     * @returns {runeos.ui.tilemap.Tile}
     * @ignore
     */
    get : function() {
        return this.m_selected;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Returns a Tile by insertion-order index without exposing the collection or
 * allocating a snapshot. Invalid or out-of-range indices return null.
 *
 * @param {number} index Zero-based integer index.
 *
 * @returns {?runeos.ui.tilemap.Tile} Original Tile or null.
 */
runeos.ui.tilemap.Tilemap.prototype.getTileAt = function(index) {
    if (typeof index !== "number" || index < 0 || index >= this.m_tiles.length ||
        Math.floor(index) !== index) return null;
    return this.m_tiles[index] || null;
};

/**
 * Creates and adds a tile. Priority can be supplied in the options.
 *
 * @param {Object} [options] Tile configuration.
 *
 * @returns {runeos.ui.tilemap.Tile}
 */
runeos.ui.tilemap.Tilemap.prototype.createTile = function(options) {
    return this.addTile(new runeos.ui.tilemap.Tile(this.m_options.configure(options)));
};

/**
 * Adds a tile, optionally overriding its preferred variant.
 *
 * @param {runeos.ui.tilemap.Tile} tile Tile to add.
 * @param {number} [priority] Preferred variant, from zero to two.
 *
 * @returns {runeos.ui.tilemap.Tile}
 */
runeos.ui.tilemap.Tilemap.prototype.addTile = function(tile, priority) {
    this.m_validateTile(tile, priority);
    if (priority !== undefined) tile.priority = priority;
    this.addTiles([tile]);
    return tile;
};

/**
 * Creates a batch and performs one layout. Invalid input releases the new Tiles
 * without changing this map; existing metadata and ownership remain untouched.
 *
 * @param {Array.<Object>} options Tile configurations in display order.
 *
 * @returns {Array.<runeos.ui.tilemap.Tile>} Created Tiles.
 */
runeos.ui.tilemap.Tilemap.prototype.createTiles = function(options) {
    if (!Array.isArray(options)) throw new TypeError("Expected Tile configurations.");
    var tiles = [];
    try {
        for (var i = 0; i < options.length; i++) tiles.push(new runeos.ui.tilemap.Tile(this.m_options.configure(options[i])));
        this.addTiles(tiles);
    } catch (error) {
        for (var t = 0; t < tiles.length; t++) {
            if (!tiles[t].m_owner) tiles[t].dispose();
        }
        throw error;
    }
    return tiles;
};

/**
 * Validates the whole batch before registering any children, then packs it
 * once.
 *
 * @param {Array.<runeos.ui.tilemap.Tile>} tiles Tiles to register.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.Tilemap.prototype.addTiles = function(tiles) {
    if (!Array.isArray(tiles)) throw new TypeError("Expected Tiles.");
    for (var i = 0; i < tiles.length; i++) {
        this.m_validateTile(tiles[i]);
    }
    for (var t = 0; t < tiles.length; t++) {
        var child = tiles[t];
        if (this.m_tiles.indexOf(child) === -1) {
            this.m_tiles.push(child);
            runeos.display.DisplayGroup.prototype.addChild.call(this, child);
            child.m_owner = this;
        }
    }
    if (!this.m_selected && this.m_tiles.length) this.select(this.m_tiles[0], false);
    if (tiles.length) this.layout();
};

/**
 * Reconciles an ordered Tile list, preserving retained instances and selection.
 * Removed Tiles are disposed after their owned transitions have been cancelled.
 * Only changed order, priorities or grid settings require a new layout.
 *
 * @param {Array.<runeos.ui.tilemap.Tile>} tiles Ordered Tiles to retain or register.
 *
 * @returns {boolean} Whether layout geometry changed.
 */
runeos.ui.tilemap.Tilemap.prototype.setTiles = function(tiles) {
    this.m_validateTiles(tiles);
    var changes = this.m_analyzeTiles(tiles);
    this.m_removeMissingTiles(tiles);
    if (changes.orderChanged) this.m_setTileOrder(tiles);
    var changed = changes.orderChanged || changes.layoutChanged;
    if (changed) this.layout();
    return changed;
};

/**
 * Selects a tile belonging to this map.
 *
 * @param {runeos.ui.tilemap.Tile} tile Tile to select.
 * @param {boolean} [refresh=true] Refresh the owner; internal batches defer until layout.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.Tilemap.prototype.select = function(tile, refresh) {
    if (this.m_tiles.indexOf(tile) === -1) throw new RangeError("Tile is not in this map.");
    if (this.m_selected) this.m_selected.selected = false;
    this.m_selected = tile;
    tile["selected"] = !this.m_owner || this.m_owner["selected"] === this;
    if (this.m_owner && refresh !== false) this.m_owner.refresh(true);
};

/**
 * Packs requested sizes without holes. Incomplete layouts fall back to normal
 * tiles.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.Tilemap.prototype.layout = function() {
    this.m_validateLayout();
    var tiles = this.m_tiles;
    var result = this.m_packTiles();
    var size = this.m_config.sizePx;
    this.width = this.columns * size + (this.columns - 1) * this.padding;
    var pitch = size + this.padding;
    var bottom = 0;
    for (var i = 0; i < tiles.length; i++) {
        var placement = result ? result[i] : {
            slot: i,
            variant: 0
        };
        var tile = tiles[i];
        tile.variant = placement.variant;
        tile.x = (placement.slot % this.columns) * pitch;
        tile.y = Math.floor(placement.slot / this.columns) * pitch;
        tile.width = tile.variant === 0 ? size : 2 * size + this.padding;
        tile.height = tile.variant === 2 ? 2 * size + this.padding : size;
        bottom = Math.max(bottom, tile.y + tile.height);
    }
    this.height = bottom;
    this.m_layoutState.columns = this.columns;
    this.m_layoutState.padding = this.padding;
    this.m_layoutState.priorities = tiles.map(function(tile) {
        return tile.priority;
    });
    if (this.m_owner) this.m_owner.refresh(false);
};

/**
 * Finds the nearest tile in a cardinal direction, favoring aligned rectangles.
 *
 * @param {string} direction LEFT, RIGHT, UP or DOWN.
 *
 * @returns {runeos.ui.tilemap.Tile}
 */
runeos.ui.tilemap.Tilemap.prototype.neighbor = function(direction) {
    return runeos.util.DirectionalNavigation.find(this.m_tiles, this.m_selected, direction);
};

/**
 * Finds the entry-edge Tile nearest the source when entering this map.
 * Source and Tiles use compatible cross-axis coordinates. Missing source uses
 * the navigation helper's origin fallback; an empty map returns null.
 *
 * @param {string} direction LEFT, RIGHT, UP or DOWN.
 * @param {?Object} [source] Source rectangle, usually the previous map's Tile.
 *
 * @returns {?runeos.ui.tilemap.Tile} Entry Tile or null.
 */
runeos.ui.tilemap.Tilemap.prototype.findEntry = function(direction, source) {
    return runeos.util.DirectionalNavigation.findEntry(this.m_tiles, source, direction);
};

/**
 * Compatibility alias for createTile().
 *
 * @param {Object} [options] Tile configuration, including priority.
 *
 * @returns {runeos.ui.tilemap.Tile}
 */
runeos.ui.tilemap.Tilemap.prototype.create = runeos.ui.tilemap.Tilemap.prototype.createTile;

/**
 * Compatibility alias for addTile().
 *
 * @param {runeos.ui.tilemap.Tile} tile Tile to add.
 * @param {number} [priority] Preferred variant, from zero to two.
 *
 * @returns {runeos.ui.tilemap.Tile}
 */
runeos.ui.tilemap.Tilemap.prototype.add = runeos.ui.tilemap.Tilemap.prototype.addTile;

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Releases tile ownership and display resources.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.tilemap.Tilemap.prototype.dispose = function() {
    for (var i = 0; i < this.m_tiles.length; i++) {
        this.m_tiles[i].m_owner = null;
    }
    this.m_tiles.length = 0;
    this.m_selected = null;
    this.m_owner = null;
    runeos.display.DisplayGroup.prototype.dispose.call(this);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Validates layout settings and initializes the inherited display dimensions.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemap.prototype.m_construct = function() {
    this.m_validateLayout();
    this.width = this.columns * this.m_config.sizePx + (this.columns - 1) * this.padding;
    this.height = 0;
};

/**
 * Validates the complete replacement before changing any owned objects.
 *
 * @param {Array.<runeos.ui.tilemap.Tile>} tiles Ordered tiles to retain or register.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemap.prototype.m_validateTiles = function(tiles) {
    if (!Array.isArray(tiles)) throw new TypeError("Expected Tiles.");
    this.m_validateLayout();
    for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        this.m_validateTile(tile);
        if (tiles.indexOf(tile) !== i) throw new Error("Duplicate Tile.");
    }
};

/**
 * Compares order and geometry inputs without modifying tiles or display children.
 *
 * @param {Array.<runeos.ui.tilemap.Tile>} tiles Ordered tiles to retain or register.
 *
 * @returns {{orderChanged:boolean, layoutChanged:boolean}}
 * @private
 */
runeos.ui.tilemap.Tilemap.prototype.m_analyzeTiles = function(tiles) {
    var previous = this.m_tiles;
    var orderChanged = previous.length !== tiles.length;
    var state = this.m_layoutState;
    var layoutChanged = state.columns !== this.columns || state.padding !== this.padding;
    for (var t = 0; t < tiles.length; t++) {
        if (previous[t] !== tiles[t]) orderChanged = true;
        if (state.priorities[t] !== tiles[t].priority) layoutChanged = true;
    }
    return {orderChanged: orderChanged, layoutChanged: layoutChanged};
};

/**
 * Cancels transitions and releases tiles omitted from the replacement.
 *
 * @param {Array.<runeos.ui.tilemap.Tile>} tiles Ordered tiles to retain or register.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemap.prototype.m_removeMissingTiles = function(tiles) {
    var previous = this.m_tiles;
    for (var old = 0; old < previous.length; old++) {
        var removed = previous[old];
        if (tiles.indexOf(removed) !== -1) continue;
        if (this.m_owner) this.m_owner.cancelTransition(removed);
        this.removeChild(removed);
        removed.m_owner = null;
        removed.selected = false;
        removed.dispose();
    }
};

/**
 * Reorders display children and preserves selection when the selected tile remains.
 *
 * @param {Array.<runeos.ui.tilemap.Tile>} tiles Ordered tiles to retain or register.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemap.prototype.m_setTileOrder = function(tiles) {
    var previous = this.m_tiles;
    for (var child = 0; child < previous.length; child++) this.removeChild(previous[child]);
    this.m_tiles = tiles.slice();
    for (var added = 0; added < tiles.length; added++) {
        runeos.display.DisplayGroup.prototype.addChild.call(this, tiles[added]);
        tiles[added].m_owner = this;
    }
    if (tiles.indexOf(this.m_selected) === -1) {
        this.m_selected = null;
        if (tiles.length) this.select(tiles[0], false);
    }
};

/**
 * Passes child size preferences to the independent grid-layout library.
 *
 * @returns {?Array.<Object>} Ordered placements or the normal-grid fallback signal.
 * @private
 */
runeos.ui.tilemap.Tilemap.prototype.m_packTiles = function() {
    var priorities = [];
    for (var i = 0; i < this.m_tiles.length; i++) priorities.push(this.m_tiles[i].priority);
    return runeos.ui.tilemap.TileLayout.pack(priorities, this.columns, this.m_options);
};

/**
 * Validates grid settings before layout or reconciliation changes any children.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemap.prototype.m_validateLayout = function() {
    runeos.ui.tilemap.TilemapOptions.validateGrid(this.columns, this.padding);
};

/**
 * Validates shared registration requirements without changing the Tile. An
 * explicit priority is checked before replacing the Tile's current preference.
 *
 * @param {runeos.ui.tilemap.Tile} tile Candidate Tile.
 * @param {number} [priority] Optional replacement priority.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemap.prototype.m_validateTile = function(tile, priority) {
    if (!(tile instanceof runeos.ui.tilemap.Tile)) throw new TypeError("Expected a Tile.");
    if (tile.m_owner && tile.m_owner !== this) throw new Error("Tile already has an owner.");
    var value = priority === undefined ? tile.priority : priority;
    if (value !== 0 && value !== 1 && value !== 2) throw new RangeError("Invalid priority.");
};
