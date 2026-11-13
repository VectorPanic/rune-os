//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Tilemaps instance.
 *
 * @constructor
 * @extends runeos.display.DisplayObjectContainer
 *
 * @param {Object} [options] Configuration for this instance.
 *
 * @class
 * @classdesc
 *
 * A screen-sized viewport coordinating selection, scrolling and opacity between
 * tilemaps.
 */
runeos.ui.tilemap.Tilemaps = function(options) {
    options = options || {};
    var resolved = runeos.ui.tilemap.TilemapOptions.resolve(options, "tilemaps");
    var viewport = resolved.viewport(options);

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    /**
     * Extends runeos.display.DisplayObjectContainer.
     */
    runeos.display.DisplayObjectContainer.call(this, 0, 0, viewport.width, viewport.height);

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Horizontal distance between tilemaps.
     *
     * @type {number}
     */
    this.gap = viewport.gap;

    /**
     * Transition duration in milliseconds.
     *
     * @type {number}
     */
    this.duration = viewport.duration;

    /**
     * Top layout boundary reserved for fixed UI, without clipping rendered
     * tiles.
     *
     * @type {number}
     * @default 0
     */
    this.contentTop = viewport.contentTop;

    /**
     * Called after a committed selection change with map, Tile, previous snapshot
     * and reason. Navigation changes use "navigation"; other refreshes are silent
     * presentation updates. Null disables notifications.
     *
     * @type {?Function}
     */
    this.onSelectionChange = viewport.onSelectionChange;

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
     * Whether this viewport has permanently released its resources.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    /**
     * Immutable tilemaps settings for this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = resolved.tilemaps;

    /**
     * Immutable tiles settings for this component.
     *
     * @type {Object}
     * @private
     */
    this.m_tileConfig = resolved.tiles;

    /**
     * Map and selection transition controller.
     *
     * @type {runeos.ui.tilemap.TilemapTransitions}
     * @private
     */
    this.m_transitions = null;

    /**
     * Ordered tilemaps.
     *
     * @type {Array.<runeos.ui.tilemap.Tilemap>}
     * @private
     */
    this.m_maps = [];

    /**
     * Index of the active map.
     *
     * @type {number}
     * @private
     */
    this.m_index = -1;

    /**
     * Immutable current selection snapshot, reused while identities are unchanged.
     *
     * @type {Object}
     * @private
     */
    this.m_selection = Object.freeze({
        tilemap: null,
        tile: null
    });

    /**
     * Last notified identities, independent of read-only selection access.
     *
     * @type {Object}
     * @private
     */
    this.m_notifiedSelection = this.m_selection;

    /**
     * Reusable visible interval for vertical scrolling.
     *
     * @type {Object}
     * @private
     */
    this.m_scrollViewport = {
        start: 0,
        end: 0
    };

    /**
     * Reusable selected interval including animation margins.
     *
     * @type {Object}
     * @private
     */
    this.m_scrollBounds = {
        start: 0,
        end: 0
    };

    /**
     * Reusable scaled bounds for the selected Tile's hard shadow.
     *
     * @type {Object}
     * @private
     */
    this.m_shadowBounds = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };

    /**
     * Reused group renderer preserving selected Tile order and shadow styling.
     *
     * @type {Function}
     * @private
     */
    this.m_tilemapRenderer = this.m_renderTilemapContents.bind(this);

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Constructs the transition controller using normalized settings.
     */
    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.ui.tilemap.Tilemaps.prototype = Object.create(runeos.display.DisplayObjectContainer.prototype);
runeos.ui.tilemap.Tilemaps.prototype.constructor = runeos.ui.tilemap.Tilemaps;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Lazily allocated viewport buffer, or null after permanent disposal.
 * Clear retains this buffer; disposed viewports never allocate a replacement.
 *
 * @member {?runeos.display.Canvas} canvas
 * @memberof runeos.ui.tilemap.Tilemaps
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemaps.prototype, "canvas", {
    /**
     * @this runeos.ui.tilemap.Tilemaps
     * @returns {?runeos.display.Canvas}
     * @ignore
     */
    get : function() {
        if (this.m_disposed) return null;
        return Object.getOwnPropertyDescriptor(runeos.display.DisplayObject.prototype, "canvas").get.call(this);
    }
});

/**
 * Immutable component settings available to presentation adapters.
 *
 * @member {runeos.ui.tilemap.TilemapOptions} settings
 * @memberof runeos.ui.tilemap.Tilemaps
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemaps.prototype, "settings", {
    /**
     * @this runeos.ui.tilemap.Tilemaps
     * @returns {runeos.ui.tilemap.TilemapOptions}
     * @ignore
     */
    get : function() {
        return this.m_options;
    }
});

/**
 * Snapshot of registered maps.
 *
 * @member {Array.<runeos.ui.tilemap.Tilemap>} tilemaps
 * @memberof runeos.ui.tilemap.Tilemaps
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemaps.prototype, "tilemaps", {
    /**
     * @this runeos.ui.tilemap.Tilemaps
     * @returns {Array.<runeos.ui.tilemap.Tilemap>}
     * @ignore
     */
    get : function() {
        return this.m_maps.slice();
    }
});

/**
 * Active tilemap.
 *
 * @member {runeos.ui.tilemap.Tilemap} selected
 * @memberof runeos.ui.tilemap.Tilemaps
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemaps.prototype, "selected", {
    /**
     * @this runeos.ui.tilemap.Tilemaps
     * @returns {runeos.ui.tilemap.Tilemap}
     * @ignore
     */
    get : function() {
        return this.m_maps[this.m_index] || null;
    }
});

/**
 * Current Tilemap and Tile as an immutable snapshot. Both fields are null when
 * no map is active. Repeated reads reuse the snapshot until either identity
 * changes. The referenced display objects remain owned by this component.
 *
 * @member {Object} selection
 * @memberof runeos.ui.tilemap.Tilemaps
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemaps.prototype, "selection", {
    /**
     * @this runeos.ui.tilemap.Tilemaps
     * @returns {Object}
     * @ignore
     */
    get : function() {
        return this.m_refreshSelection();
    }
});

/**
 * Number of registered tilemaps without allocating a collection snapshot.
 *
 * @member {number} length
 * @memberof runeos.ui.tilemap.Tilemaps
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemaps.prototype, "length", {
    /**
     * @this runeos.ui.tilemap.Tilemaps
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_maps.length;
    }
});

/**
 * Zero-based active tilemap index, or -1 when empty.
 *
 * @member {number} selectedIndex
 * @memberof runeos.ui.tilemap.Tilemaps
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemaps.prototype, "selectedIndex", {
    /**
     * @this runeos.ui.tilemap.Tilemaps
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_index;
    }
});

/**
 * Number of nonempty maps available to horizontal navigation.
 *
 * @member {number} navigableCount
 * @memberof runeos.ui.tilemap.Tilemaps
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemaps.prototype, "navigableCount", {
    /**
     * @this runeos.ui.tilemap.Tilemaps
     * @returns {number}
     * @ignore
     */
    get : function() {
        var count = 0;
        for (var i = 0; i < this.m_maps.length; i++) {
            if (this.m_maps[i]["length"] > 0) count++;
        }
        return count;
    }
});

/**
 * Zero-based position among nonempty maps, or -1 without a selection.
 *
 * @member {number} navigableIndex
 * @memberof runeos.ui.tilemap.Tilemaps
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tilemaps.prototype, "navigableIndex", {
    /**
     * @this runeos.ui.tilemap.Tilemaps
     * @returns {number}
     * @ignore
     */
    get : function() {
        var active = this["selected"];
        if (!active || active.length === 0) return -1;
        var index = 0;
        for (var i = 0; i < this.m_index; i++) {
            if (this.m_maps[i]["length"] > 0) index++;
        }
        return index;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Creates and registers a tilemap.
 *
 * @param {Object} [options] Tilemap configuration.
 *
 * @returns {runeos.ui.tilemap.Tilemap}
 */
runeos.ui.tilemap.Tilemaps.prototype.createTilemap = function(options) {
    this.m_assertActive();
    return this.addTilemap(new runeos.ui.tilemap.Tilemap(this.m_options.configure(options)));
};

/**
 * Registers a tilemap with this manager.
 *
 * @param {runeos.ui.tilemap.Tilemap} tilemap Map to register.
 *
 * @returns {runeos.ui.tilemap.Tilemap}
 */
runeos.ui.tilemap.Tilemaps.prototype.addTilemap = function(tilemap) {
    this.m_assertActive();
    if (!(tilemap instanceof runeos.ui.tilemap.Tilemap)) throw new TypeError("Expected a Tilemap.");
    if (tilemap.m_owner && tilemap.m_owner !== this) throw new Error("Tilemap already has an owner.");
    if (this.m_maps.indexOf(tilemap) === -1) {
        this.m_maps.push(tilemap);
        runeos.display.DisplayObjectContainer.prototype.addChild.call(this, tilemap);
        tilemap.m_owner = this;
        tilemap.y = this.contentTop;
    }
    if (this.m_index < 0) this.m_index = 0;
    this.refresh(false);
    return tilemap;
};

/**
 * Reconciles registered maps without replacing retained map buffers or Tiles.
 * Removed maps and their transitions are released; the active map is retained
 * whenever it remains in the collection.
 *
 * @param {Array.<runeos.ui.tilemap.Tilemap>} maps Ordered map collection.
 *
 * @returns {boolean} Whether map membership or order changed.
 */
runeos.ui.tilemap.Tilemaps.prototype.setTilemaps = function(maps) {
    this.m_assertActive();
    if (!Array.isArray(maps)) throw new TypeError("Expected Tilemaps.");
    var changed = maps.length !== this.m_maps.length;
    for (var i = 0; i < maps.length; i++) {
        var map = maps[i];
        if (!(map instanceof runeos.ui.tilemap.Tilemap)) throw new TypeError("Expected a Tilemap.");
        if (map.m_owner && map.m_owner !== this) throw new Error("Tilemap already has an owner.");
        if (maps.indexOf(map) !== i) throw new Error("Duplicate Tilemap.");
        if (this.m_maps[i] !== map) changed = true;
    }
    if (!changed) return false;
    var active = this["selected"];
    var previous = this.m_maps;
    for (var old = 0; old < previous.length; old++) {
        if (maps.indexOf(previous[old]) === -1) this.m_disposeTilemap(previous[old]);
        else this.removeChild(previous[old]);
    }
    this.m_maps = maps.slice();
    for (var added = 0; added < maps.length; added++) {
        if (!maps[added].m_owner) maps[added].y = this.contentTop;
        maps[added].m_owner = this;
        runeos.display.DisplayObjectContainer.prototype.addChild.call(this, maps[added]);
    }
    this.m_index = maps.indexOf(active);
    if (this.m_index < 0) this.m_index = maps.length ? 0 : -1;
    this.refresh(false);
    return true;
};

/**
 * Cancels a map or Tile transition before its display resources are removed.
 *
 * @param {runeos.display.DisplayObject} target Transition target.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.Tilemaps.prototype.cancelTransition = function(target) {
    if (this.m_transitions) this.m_transitions.cancel(target);
};

/**
 * Makes a registered map active and centers it.
 *
 * @param {runeos.ui.tilemap.Tilemap} tilemap Map to select.
 * @param {boolean} [animate=true] Whether to animate the transition.
 * @param {string} [reason] Notification reason, normally supplied by navigation.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.Tilemaps.prototype.select = function(tilemap, animate, reason) {
    this.m_assertActive();
    var index = this.m_maps.indexOf(tilemap);
    if (index < 0) throw new RangeError("Unknown Tilemap.");
    this.m_index = index;
    this.refresh(animate !== false, reason);
};

/**
 * Moves within a map or crosses its horizontal edge to the nearest nonempty
 * map. Previously active maps retain their selection; first visits enter at
 * the nearest edge Tile.
 *
 * @param {string} direction LEFT, RIGHT, UP or DOWN.
 *
 * @returns {boolean}
 */
runeos.ui.tilemap.Tilemaps.prototype.navigate = function(direction) {
    if (this.m_disposed) return false;
    if (!runeos.util.DirectionalNavigation.isDirection(direction)) return false;
    var map = this["selected"];
    if (!map) return false;
    var next = map.neighbor(direction);
    if (next) {
        map.select(next, false);
        this.refresh(true, "navigation");
        return true;
    }
    if (direction !== "LEFT" && direction !== "RIGHT") return false;
    var sign = direction === "RIGHT" ? 1 : -1;
    var index = this.m_index + sign;
    while (index >= 0 && index < this.m_maps.length && this.m_maps[index]["length"] === 0) index += sign;
    if (index < 0 || index >= this.m_maps.length) return false;
    var destination = this.m_maps[index];
    if (!destination.m_hasBeenActive || !destination["selected"]) {
        var entry = destination.findEntry(direction, map.selected);
        if (!entry) return false;
        destination.select(entry, false);
    }
    this.select(destination, true, "navigation");
    return true;
};

/**
 * Repositions maps and keeps the active tile visible vertically.
 *
 * @param {boolean} animate Whether to animate the new positions.
 * @param {string} [reason] Notification reason; defaults to "refresh".
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.Tilemaps.prototype.refresh = function(animate, reason) {
    if (this.m_disposed) return;
    this.m_selectAvailableMap();
    var active = this["selected"];
    if (!active) {
        this.m_updateSelection(reason);
        return;
    }
    active.m_hasBeenActive = true;
    var positions = this.m_getMapPositions(active);
    this.m_showMaps(positions, animate);
    this.m_updateSelection(reason);
};

/**
 * Compatibility alias for createTilemap().
 *
 * @param {Object} [options] Tilemap configuration.
 *
 * @returns {runeos.ui.tilemap.Tilemap}
 */
runeos.ui.tilemap.Tilemaps.prototype.create = runeos.ui.tilemap.Tilemaps.prototype.createTilemap;

/**
 * Compatibility alias for addTilemap().
 *
 * @param {runeos.ui.tilemap.Tilemap} tilemap Map to register.
 *
 * @returns {runeos.ui.tilemap.Tilemap}
 */
runeos.ui.tilemap.Tilemaps.prototype.add = runeos.ui.tilemap.Tilemaps.prototype.addTilemap;

/**
 * Releases contents and their transitions while keeping this viewport reusable.
 * Retains the pixel buffer, configuration, callback and borrowed tween handler.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.Tilemaps.prototype.clear = function() {
    if (this.m_disposed) return;
    if (this.m_canvas) this.m_canvas.clear();
    this.m_clearContent();
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Renders maps directly into the viewport so enlarged tiles are not clipped by
 * individual map buffers. The active map and its selected tile render last.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.tilemap.Tilemaps.prototype.render = function() {
    if (this.m_disposed) return;
    runeos.display.DisplayObject.prototype.render.call(this);
    var active = this["selected"];
    for (var i = 0; i < this.m_maps.length; i++) {
        if (this.m_maps[i] !== active) this.m_renderTilemap(this.m_maps[i]);
    }
    if (active) this.m_renderTilemap(active);
};

/**
 * Permanently releases contents, callbacks and the viewport pixel buffer.
 * Repeated calls are harmless. The borrowed scene tween handler remains alive.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.tilemap.Tilemaps.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.onSelectionChange = null;
    this.cancelTransition(this);
    this.m_clearContent();
    runeos.display.DisplayObjectContainer.prototype.dispose.call(this);
    this.m_transitions = null;
    this.m_tilemapRenderer = null;
    this.visible = false;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Runs the initialization steps owned by this instance.
 *
 * @param {Object} options Constructor settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_construct = function(options) {
    this.m_transitions = new runeos.ui.tilemap.TilemapTransitions({
        tweens: options.tweens,
        settings: this.m_options
    });
};

/**
 * Prevents registration and explicit selection after permanent disposal.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_assertActive = function() {
    if (this.m_disposed) throw new Error("Tilemaps is disposed.");
};

/**
 * Detaches and disposes contents before reporting an empty selection. Notification
 * runs last, allowing clear listeners to populate the reusable viewport safely.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_clearContent = function() {
    var maps = this.m_maps;
    this.m_maps = [];
    this.m_index = -1;
    for (var i = 0; i < maps.length; i++) this.m_disposeTilemap(maps[i]);
    // Release any additional children registered through the inherited API.
    while (this.m_children.length) {
        var child = this.m_children[0];
        this.cancelTransition(child);
        this.removeChild(child);
        child.dispose();
    }
    this.m_notifySelection();
};

/**
 * Captures current selection identities without allocating on unchanged reads.
 * Also runs after reconciliation so the cache releases removed display objects.
 *
 * @returns {Object} Immutable Tilemap/Tile selection snapshot.
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_refreshSelection = function() {
    var map = this["selected"];
    var tile = map ? map.selected : null;
    if (this.m_selection.tilemap !== map || this.m_selection.tile !== tile) {
        this.m_selection = Object.freeze({
            tilemap: map,
            tile: tile
        });
    }
    return this.m_selection;
};

/**
 * Notifies only after layout, active-map state and Tile transitions are updated.
 * Records the selection before invoking user code so reentrant refreshes cannot
 * repeat the same notification. Reading selection alone never invokes callbacks.
 *
 * @param {string} [reason] Selection-change reason.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_notifySelection = function(reason) {
    var current = this.m_refreshSelection();
    var previous = this.m_notifiedSelection;
    if (previous.tilemap === current.tilemap && previous.tile === current.tile) return;
    this.m_notifiedSelection = current;
    if (typeof this.onSelectionChange === "function") {
        this.onSelectionChange(current.tilemap, current.tile, previous, reason || "refresh");
    }
};

/**
 * Retains a populated selection or chooses the next available map, then the previous.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_selectAvailableMap = function() {
    var active = this["selected"];
    if (active && active.length > 0) return;
    var start = Math.max(0, this.m_index);
    for (var next = start; next < this.m_maps.length; next++) {
        if (this.m_maps[next]["length"] > 0) {
            this.m_index = next;
            return;
        }
    }
    for (var previous = start - 1; previous >= 0; previous--) {
        if (this.m_maps[previous]["length"] > 0) {
            this.m_index = previous;
            return;
        }
    }
    this.m_index = -1;
};

/**
 * Draws map contents with inherited opacity and parent-local translation.
 * Selected tiles render above neighboring tiles throughout their transition.
 *
 * @param {runeos.ui.tilemap.Tilemap} map Map to render.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_renderTilemap = function(map) {
    map.renderTo(this["canvas"], 0, 0, this.m_tilemapRenderer);
};

/**
 * Draws map contents in the group state supplied by DisplayGroup.
 *
 * @param {runeos.ui.tilemap.Tilemap} map Map being rendered.
 * @param {runeos.display.Canvas} canvas Destination pixel buffer.
 * @param {number} x Group horizontal translation.
 * @param {number} y Group vertical translation.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_renderTilemapContents = function(map, canvas, x, y) {
    var tile = map["selected"];
    for (var i = 0; i < map["length"]; i++) {
        var child = map.getTileAt(i);
        if (child !== tile) canvas.renderDisplayObject(child, x, y);
    }
    if (!tile) return;
    if (tile.selected && tile.visible && tile.alpha > 0) {
        var bounds = tile.getRenderBounds(this.m_shadowBounds, x, y);
        var context = canvas["context"];
        context.save();
        try {
            context.globalAlpha *= tile.alpha * this.m_tileConfig.shadowOpacity;
            context.fillStyle = "#000000";
            context.fillRect(bounds.x + this.m_tileConfig.shadowOffsetXPx, bounds.y + this.m_tileConfig.shadowOffsetYPx, bounds.width, bounds.height);
        } finally {
            context.restore();
        }
    }
    canvas.renderDisplayObject(tile, x, y);
};

/**
 * Calculates map destinations without moving maps or starting transitions.
 * Empty maps occupy no horizontal space.
 *
 * @param {runeos.ui.tilemap.Tilemap} active Map to center in the viewport.
 *
 * @returns {Array.<?Object>} Destinations by map index, with null for empty maps.
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_getMapPositions = function(active) {
    var center = (this.width - active.width) / 2;
    var offsets = [];
    offsets[this.m_index] = center;
    var cursor = center;
    for (var left = this.m_index - 1; left >= 0; left--) {
        if (this.m_maps[left]["length"] === 0) continue;
        cursor -= this.gap + this.m_maps[left].width;
        offsets[left] = cursor;
    }
    cursor = center + active.width;
    for (var right = this.m_index + 1; right < this.m_maps.length; right++) {
        if (this.m_maps[right]["length"] === 0) continue;
        offsets[right] = cursor + this.gap;
        cursor = offsets[right] + this.m_maps[right].width;
    }
    return this.m_maps.map(function(map, index) {
        if (map["length"] === 0) return null;
        return {
            x: offsets[index],
            y: this.m_getMapY(map),
            alpha: map === active ? 1 : this.m_config.inactiveOpacity
        };
    }, this);
};

/**
 * Applies calculated destinations through the shared transition handler.
 *
 * @param {Array.<?Object>} positions Destinations by map index.
 * @param {boolean} animate Whether to animate the new positions.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_showMaps = function(positions, animate) {
    for (var i = 0; i < this.m_maps.length; i++) {
        if (!positions[i]) continue;
        this.m_transitions.showMap(this.m_maps[i], positions[i], this.duration, animate);
    }
};

/**
 * Calculates scroll position while reserving room for selection overshoot.
 *
 * @param {runeos.ui.tilemap.Tilemap} map Map to position.
 *
 * @returns {number}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_getMapY = function(map) {
    var y = Math.min(this.contentTop, map.y);
    if (map !== this["selected"]) return y;
    var tile = map["selected"];
    if (!tile) return y;
    this.m_scrollViewport.start = this.contentTop;
    this.m_scrollViewport.end = this.height;
    return runeos.util.ViewportScroll.reveal(this.m_scrollViewport, this.m_getScrollBounds(tile), y);
};

/**
 * Reserves the selected Tile's peak scale, including spring and breathing.
 *
 * @param {runeos.ui.tilemap.Tile} tile Selected Tile.
 *
 * @returns {Object} Reused content interval for immediate consumption.
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_getScrollBounds = function(tile) {
    var margin = this.m_transitions.getSelectionMargin();
    this.m_scrollBounds.start = tile.y - tile.height * margin;
    this.m_scrollBounds.end = tile.y + tile.height * (1 + margin);
    return this.m_scrollBounds;
};

/**
 * Supplies active-map and selection state before notifying selection listeners.
 *
 * @param {string} [reason] Selection-change reason.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_updateSelection = function(reason) {
    for (var m = 0; m < this.m_maps.length; m++) {
        var map = this.m_maps[m];
        var active = m === this.m_index;
        var selectedTile = map["selected"];
        for (var t = 0; t < map["length"]; t++) {
            var child = map.getTileAt(t);
            var selected = active && child === selectedTile;
            this.m_transitions.selectTile(child, selected, active);
        }
    }
    this.m_notifySelection(reason);
};

/**
 * Releases a removed map, its owned Tile transitions and image resources.
 *
 * @param {runeos.ui.tilemap.Tilemap} map Map no longer registered in this viewport.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tilemaps.prototype.m_disposeTilemap = function(map) {
    this.cancelTransition(map);
    for (var i = 0; i < map["length"]; i++) this.cancelTransition(map.getTileAt(i));
    this.removeChild(map);
    map.m_owner = null;
    map.dispose();
};
