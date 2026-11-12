//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new TilemapTransitions instance.
 *
 * @constructor
 *
 * @param {Object} options Shared tween handler and optional tileConfig settings.
 *
 * @class
 * @classdesc
 *
 * Applies map position/opacity and Tile focus transitions. Borrows the caller's
 * tween handler without owning its clock or lifetime. Receives desired states
 * without depending on navigation, viewport layout, input or scenes.
 */
runeos.ui.tilemap.TilemapTransitions = function(options) {
    options = options || {};
    var resolved = runeos.ui.tilemap.TilemapOptions.resolve(options);

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Borrowed scene-owned tween handler.
     *
     * @type {runeos.tween.Tweens}
     * @private
     */
    this.m_tweens = options.tweens;

    /**
     * Immutable selection animation settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = resolved.tiles;

    /**
     * Bound selection easing shared by this controller's tweens.
     *
     * @type {Function}
     * @private
     */
    this.m_selectionTransition = this.m_easeSelection.bind(this);

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Validates the borrowed animation interface.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Moves and fades a map from its current state. Immediate changes cancel its
 * running transition before assigning the destination values.
 *
 * @param {Object} map Target exposing x, y and alpha.
 * @param {Object} position Destination x, y and alpha values.
 * @param {number} duration Transition duration in milliseconds.
 * @param {boolean} animate Whether to interpolate.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TilemapTransitions.prototype.showMap = function(map, position, duration, animate) {
    if (animate && duration > 0) {
        this.m_tweens.replace({
            target: map,
            args: position,
            duration: duration,
            transition: runeos.tween.Quad.easeOut
        });
    } else {
        this.cancel(map);
        map.x = position.x;
        map.y = position.y;
        map.alpha = position.alpha;
    }
};

/**
 * Applies supplied selection state and active-map opacity. Retargets scale only
 * when its destination changes, preserving ongoing animation on repeated calls.
 * The Tile stores its destination without a separate controller-owned registry.
 *
 * @param {runeos.ui.tilemap.Tile} tile Target Tile.
 * @param {boolean} selected Whether this Tile is selected.
 * @param {boolean} active Whether its map is active.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TilemapTransitions.prototype.selectTile = function(tile, selected, active) {
    tile.selected = selected;
    tile.alpha = active && !selected ? this.m_config.inactiveOpacity : 1;
    var scale = selected ? this.m_config.selectedScale : 1;
    if (tile.m_selectionScale === scale) return;
    this.m_tweens.replace({
        target: tile,
        args: {scale: scale},
        duration: this.m_config.selectionTransitionMs,
        transition: this.m_selectionTransition
    });
    tile.m_selectionScale = scale;
};

/**
 * Cancels transitions for a target before its display resources are released.
 * Clears a Tile's cached destination so a later selection can restart it.
 * Other targets in the borrowed handler are unaffected.
 *
 * @param {Object} target Map or Tile to stop.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TilemapTransitions.prototype.cancel = function(target) {
    this.m_tweens.removeFrom(target);
    if (target.m_selectionScale !== undefined) target.m_selectionScale = null;
};

/**
 * Calculates the extra margin on each side of selected content, including peak
 * spring scale, breathing and configured focus padding. Layout can reserve this
 * envelope without knowing how the selection animation is implemented.
 *
 * @returns {number} Margin as a fraction of the Tile's unscaled size.
 */
runeos.ui.tilemap.TilemapTransitions.prototype.getSelectionMargin = function() {
    var config = this.m_config;
    var spring = config.selectionOvershoot;
    var overshoot = 4 * spring * spring * spring / (27 * (spring + 1) * (spring + 1));
    var pulse = config.breathingEnabled ? config.breathingAmount : 0;
    var peak = Math.max(config.selectedScale + pulse, 1 + (config.selectedScale - 1) * (1 + overshoot));
    return Math.max(0, (peak + config.focusScalePadding - 1) / 2);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Checks the shared handler without depending on a concrete scene.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TilemapTransitions.prototype.m_construct = function() {
    if (!this.m_tweens || typeof this.m_tweens.replace !== "function" ||
        typeof this.m_tweens.removeFrom !== "function") {
        throw new TypeError("TilemapTransitions requires a tween handler.");
    }
};

/**
 * Adds spring overshoot when growing; shrinking settles without a dip.
 *
 * @param {number} t Elapsed time in milliseconds.
 * @param {number} b Starting scale.
 * @param {number} c Change in scale.
 * @param {number} d Duration in milliseconds.
 *
 * @returns {number} Interpolated scale.
 * @private
 */
runeos.ui.tilemap.TilemapTransitions.prototype.m_easeSelection = function(t, b, c, d) {
    if (c <= 0) return runeos.tween.Quad.easeOut(t, b, c, d);
    var progress = t / d - 1;
    var spring = this.m_config.selectionOvershoot;
    return b + c * (progress * progress * ((spring + 1) * progress + spring) + 1);
};
