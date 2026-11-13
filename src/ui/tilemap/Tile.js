//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Tile instance.
 *
 * @constructor
 * @extends runeos.display.DisplayObjectContainer
 *
 * @param {Object} [options] Configuration for this instance.
 *
 * @class
 * @classdesc
 *
 * A selectable application card with shared metadata, scrolling labels and an
 * asynchronously loaded icon atlas. Priority requests a size; Tilemap determines
 * the actual variant.
 */
runeos.ui.tilemap.Tile = function(options) {

    options = options || {};
    var resolved = runeos.ui.tilemap.TilemapOptions.resolve(options, "tiles");

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    /**
     * Extends runeos.display.DisplayObjectContainer.
     */
    runeos.display.DisplayObjectContainer.call(this);

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Application identifier.
     *
     * @type {string}
     */
    this.id = options.id || "";

    /**
     * URL of the executable application bundle. Empty tiles cannot be launched.
     *
     * @type {string}
     */
    this.source = options.source || "";

    /**
     * Application label.
     *
     * @type {string}
     */
    this.name = options.name || "";

    /**
     * Ready-to-display secondary line above the title.
     *
     * @type {string}
     */
    this.subtitle = options.subtitle || "";

    /**
     * Ready-to-display metadata line below the title.
     *
     * @type {string}
     */
    this.metadataText = options.metadataText || "";

    /**
     * Ready-to-display badge; an empty string hides it.
     *
     * @type {string}
     */
    this.badgeText = options.badgeText || "";

    /**
     * Opaque application payload retained for launching; never interpreted by labels.
     *
     * @type {*}
     */
    this.data = options.data || null;

    /**
     * Registry game identifier.
     *
     * @type {string}
     */
    this.gameId = this.id;

    /**
     * Category-specific relevance, independent of size priority.
     *
     * @type {number}
     */
    this.relevance = 0;

    /**
     * Short explanation supplied by the category presentation layer.
     *
     * @type {string}
     */
    this.matchReason = options.matchReason || "";

    /**
     * Preferred variant: 0 normal, 1 wide, 2 large.
     *
     * @type {number}
     */
    this.priority = options.priority === undefined ? 0 : options.priority;

    /**
     * Actual variant assigned by the containing Tilemap.
     *
     * @type {number}
     */
    this.variant = 0;

    /**
     * Whether the tile is selected.
     *
     * @type {boolean}
     */
    this.selected = false;

    /**
     * Normal icon to use from the bottom atlas row: zero for left, one for
     * right.
     *
     * @type {number}
     */
    this.normalIcon = options.normalIcon === undefined ? 0 : options.normalIcon;

    //--------------------------------------------------------------------------
    // Internal properties
    //--------------------------------------------------------------------------

    /**
     * Destination scale cached by TilemapTransitions; null after cancellation.
     *
     * @type {?number}
     * @package
     */
    this.m_selectionScale = 1;

    /**
     * Owning Tilemap.
     *
     * @type {runeos.ui.tilemap.Tilemap}
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
     * Phase of the selected tile's breathing cycle, in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_breathingTime = 0;

    /**
     * Additive visual scale offset, independent of the selection tween.
     *
     * @type {number}
     * @private
     */
    this.m_breathingOffset = 0;

    /**
     * Owned label presentation, without an intermediate Tile-sized canvas.
     *
     * @type {runeos.ui.tilemap.TileLabels}
     * @private
     */
    this.m_labels = null;

    /**
     * Independent atlas loading, source-region drawing and fade ownership.
     *
     * @type {runeos.ui.tilemap.TileAtlas}
     * @private
     */
    this.m_atlas = null;

    /**
     * Whether asynchronous loading must be ignored after disposal.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Constructs the objects owned by this instance.
     */
    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.ui.tilemap.Tile.prototype = Object.create(runeos.display.DisplayObjectContainer.prototype);
runeos.ui.tilemap.Tile.prototype.constructor = runeos.ui.tilemap.Tile;

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Default background for games without an explicit color.
 *
 * @constant {string}
 */
runeos.ui.tilemap.Tile.DEFAULT_BACKGROUND_COLOR = runeos.ui.tilemap.TilemapOptions.DEFAULTS.tiles.backgroundColor;

/**
 * Logical size of one grid cell, excluding spacing between cells.
 *
 * @type {number}
 * @const
 */
runeos.ui.tilemap.Tile.SIZE = runeos.ui.tilemap.TilemapOptions.DEFAULTS.tiles.sizePx;

/**
 * Length of a slow breathing cycle in milliseconds.
 *
 * @type {number}
 * @const
 */
runeos.ui.tilemap.Tile.BREATHING_DURATION = runeos.ui.tilemap.TilemapOptions.DEFAULTS.tiles.breathingPeriodMs;

/**
 * Default extra scale applied above the configured selection scale.
 *
 * @type {number}
 * @const
 */
runeos.ui.tilemap.Tile.BREATHING_AMOUNT = runeos.ui.tilemap.TilemapOptions.DEFAULTS.tiles.breathingAmount;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Application-name field, including its font and scrolling settings.
 *
 * @member {runeos.text.TextField} nameField
 * @memberof runeos.ui.tilemap.Tile
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tile.prototype, "nameField", {
    /**
     * @this runeos.ui.tilemap.Tile
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_labels["nameField"];
    }
});

/**
 * Release year and player count for the selected game.
 *
 * @member {runeos.text.TextField} metadataField
 * @memberof runeos.ui.tilemap.Tile
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tile.prototype, "metadataField", {
    /**
     * @this runeos.ui.tilemap.Tile
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_labels["metadataField"];
    }
});

/**
 * Secondary label supplied by the presentation layer.
 *
 * @member {runeos.text.TextField} studioField
 * @memberof runeos.ui.tilemap.Tile
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tile.prototype, "studioField", {
    /**
     * @this runeos.ui.tilemap.Tile
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_labels["studioField"];
    }
});

/**
 * Text field presenting the current category match explanation.
 *
 * @member {runeos.text.TextField} reasonField
 * @memberof runeos.ui.tilemap.Tile
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tile.prototype, "reasonField", {
    /**
     * @this runeos.ui.tilemap.Tile
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_labels["reasonField"];
    }
});

/**
 * Owned text presentation and fields.
 *
 * @member {runeos.ui.tilemap.TileLabels} labels
 * @memberof runeos.ui.tilemap.Tile
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tile.prototype, "labels", {
    /**
     * @this runeos.ui.tilemap.Tile
     * @returns {runeos.ui.tilemap.TileLabels}
     * @ignore
     */
    get : function() {
        return this.m_labels;
    }
});

/**
 * Owned artwork component, independent of card layout and labels.
 *
 * @member {runeos.ui.tilemap.TileAtlas} atlas
 * @memberof runeos.ui.tilemap.Tile
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tile.prototype, "atlas", {
    /**
     * @this runeos.ui.tilemap.Tile
     * @returns {runeos.ui.tilemap.TileAtlas}
     * @ignore
     */
    get : function() {
        return this.m_atlas;
    }
});

/**
 * Image atlas URL. Changing the URL replaces any pending load and restarts
 * fading.
 * Assign an empty string to remove the image.
 *
 * @member {string} imageUrl
 * @memberof runeos.ui.tilemap.Tile
 * @instance
 */
Object.defineProperty(runeos.ui.tilemap.Tile.prototype, "imageUrl", {
    /**
     * @this runeos.ui.tilemap.Tile
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_atlas.url;
    },

    /**
     * @this runeos.ui.tilemap.Tile
     * @ignore
     */
    set : function(value) {
        this.m_atlas.url = value;
    }
});

/**
 * Atlas loading state: empty, loading, ready or error.
 *
 * @member {string} imageStatus
 * @memberof runeos.ui.tilemap.Tile
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.Tile.prototype, "imageStatus", {
    /**
     * @this runeos.ui.tilemap.Tile
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_atlas["status"];
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Copies ready-to-display label values without retaining the source object.
 * Missing values clear the corresponding line. Application data is unchanged.
 *
 * @param {Object} values Title, subtitle, metadataText, badgeText and description.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.Tile.prototype.setLabels = function(values) {
    this.name = values.title || "";
    this.subtitle = values.subtitle || "";
    this.metadataText = values.metadataText || "";
    this.badgeText = values.badgeText || "";
    this.matchReason = values.description || "";
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Renders child content, a label and the selection outline.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.tilemap.Tile.prototype.render = function() {
    this.m_syncLabels();
    runeos.display.DisplayObject.prototype.render.call(this);
    this.m_renderAtlas();
    this.m_labels.render(this["canvas"]);
    this.m_renderChildren();
    var context = this["canvas"].context;
    context.save();
    try {
        if (this.selected && this.m_config.borderWidthPx > 0) {
            var width = this.m_config.borderWidthPx;
            context.strokeStyle = this.m_config.borderColor;
            context.lineWidth = width;
            context.strokeRect(width / 2, width / 2, this.width - width, this.height - width);
        }
    } finally {
        context.restore();
    }
};

/**
 * Updates the name field and child animations.
 *
 * @param {number} step Current time step in milliseconds.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.tilemap.Tile.prototype.update = function(step) {
    this.m_syncLabels();
    this.m_labels.update(step);
    this.m_updateBreathing(step);
    this.m_atlas.update(step);
    runeos.display.DisplayObjectContainer.prototype.update.call(this, step);
};

/**
 * Adds breathing to the visual scale while leaving the selection tween
 * untouched.
 *
 * @returns {number} Centered display scale.
 * @ignore
 */
runeos.ui.tilemap.Tile.prototype.getRenderScale = function() {
    return this.scale + this.m_breathingOffset;
};

/**
 * Detaches pending image callbacks and releases fade and display resources.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.tilemap.Tile.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_atlas.dispose();
    this.m_labels.dispose();
    runeos.display.DisplayObjectContainer.prototype.dispose.call(this);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Applies card dimensions and constructs independent labels and optional artwork.
 *
 * @param {Object} options Configuration supplied to the constructor.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tile.prototype.m_construct = function(options) {
    if (this.priority !== 0 && this.priority !== 1 && this.priority !== 2) {
        throw new RangeError("Tile priority must be 0, 1 or 2.");
    }
    if (this.normalIcon !== 0 && this.normalIcon !== 1) {
        throw new RangeError("Normal icon must be 0 or 1.");
    }

    this.width = this.m_config.sizePx;
    this.height = this.m_config.sizePx;
    this.backgroundColor = options.backgroundColor || this.m_config.backgroundColor;

    this.m_atlas = new runeos.ui.tilemap.TileAtlas({settings: this.m_options});
    this.m_labels = new runeos.ui.tilemap.TileLabels({settings: this.m_options});
    this.m_syncLabels();
    this.m_labels.refresh();
    if (options.imageUrl) this.imageUrl = options.imageUrl;
};

/**
 * Supplies presentation values without passing this Tile as an owner dependency.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tile.prototype.m_syncLabels = function() {
    var labels = this.m_labels;
    labels.title = this.name;
    labels.subtitle = this.subtitle;
    labels.metadataText = this.metadataText;
    labels.badgeText = this.badgeText;
    labels.description = this.matchReason;
    labels.selected = this.selected;
    labels.width = this.width;
    labels.height = this.height;
    labels.backgroundColor = this.backgroundColor;
    labels.imageOpacity = this.m_atlas["opacity"];
};

/**
 * Supplies logical bounds and the selected atlas variant to the artwork owner.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tile.prototype.m_renderAtlas = function() {
    var atlas = this.m_atlas;
    atlas.y = 0;
    atlas.x = 0;
    atlas.width = this.width;
    atlas.height = this.height;
    atlas.variant = this.variant;
    atlas.normalIcon = this.normalIcon;
    atlas.render(this["canvas"].context);
};

/**
 * Starts a smooth breathing cycle after selection scaling settles. When focus
 * leaves the tile, the small residual offset eases away instead of snapping.
 * No timers or repeating tween instances are allocated.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.Tile.prototype.m_updateBreathing = function(step) {
    if (typeof step !== "number" || !isFinite(step) || step <= 0) return;
    if (this.m_config.breathingEnabled && this.selected && Math.abs(this.scale - this.m_config.selectedScale) < 0.0001) {
        this.m_breathingTime = (this.m_breathingTime + step) % this.m_config.breathingPeriodMs;
        var pulse = runeos.util.Math.pulse(this.m_breathingTime, this.m_config.breathingPeriodMs);
        this.m_breathingOffset = this.m_config.breathingAmount * pulse;
    } else {
        this.m_breathingTime = 0;
        if (this.m_breathingOffset > 0) {
            this.m_breathingOffset *= Math.exp(-step / this.m_config.breathingSettleMs);
            if (this.m_breathingOffset < 0.00001) this.m_breathingOffset = 0;
        }
    }
};
