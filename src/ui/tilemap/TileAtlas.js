//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new TileAtlas instance.
 *
 * @constructor
 *
 * @param {Object} [options] Atlas URL and immutable Tile artwork settings.
 *
 * @class
 * @classdesc
 *
 * Owns one icon atlas, its asynchronous load and fade. Source regions and target
 * bounds are independent of a Tile or canvas allocation. Draws directly into a
 * caller-owned context and releases stale load callbacks on replacement/disposal.
 */
runeos.ui.tilemap.TileAtlas = function(options) {
    options = options || {};
    var resolved = runeos.ui.tilemap.TilemapOptions.resolve(options, "tiles");

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Destination left edge in logical pixels.
     *
     * @type {number}
     */
    this.x = 0;

    /**
     * Destination top edge in logical pixels.
     *
     * @type {number}
     */
    this.y = 0;

    /**
     * Destination width in logical pixels.
     *
     * @type {number}
     */
    this.width = 0;

    /**
     * Destination height in logical pixels.
     *
     * @type {number}
     */
    this.height = 0;

    /**
     * Atlas variant: zero normal, one wide, two large.
     *
     * @type {number}
     */
    this.variant = 0;

    /**
     * Normal icon index: zero left, one right.
     *
     * @type {number}
     */
    this.normalIcon = 0;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable artwork settings, including iconFadeMs.
     *
     * @type {Object}
     * @private
     */
    this.m_config = resolved.tiles;

    /**
     * Current source URL.
     *
     * @type {string}
     * @private
     */
    this.m_url = "";

    /**
     * Loading or decoded image, owned by this atlas.
     *
     * @type {HTMLImageElement}
     * @private
     */
    this.m_image = null;

    /**
     * Current state: empty, loading, ready or error.
     *
     * @type {string}
     * @private
     */
    this.m_status = "empty";

    /**
     * Stable fade target reused across source replacements.
     *
     * @type {Object}
     * @private
     */
    this.m_fadeState = {alpha: 0};

    /**
     * Fade animation owned only by this component.
     *
     * @type {runeos.tween.Tween}
     * @private
     */
    this.m_fadeTween = null;

    /**
     * Reusable source rectangle, independent of destination dimensions.
     *
     * @type {Object}
     * @private
     */
    this.m_region = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };

    /**
     * Permanent resource-release flag.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Starts an optional source through the normal URL setter.
     */
    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Source URL. A changed URL replaces pending loading and restarts fading.
 * An empty string clears the image; assigning the same URL preserves its state.
 *
 * @member {string} url
 * @memberof runeos.ui.tilemap.TileAtlas
 * @instance
 */
Object.defineProperty(runeos.ui.tilemap.TileAtlas.prototype, "url", {
    /**
     * @this runeos.ui.tilemap.TileAtlas
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_url;
    },
    /**
     * @this runeos.ui.tilemap.TileAtlas
     * @ignore
     */
    set : function(value) {
        if (typeof value !== "string") throw new TypeError("Image URL must be a string.");
        if (this.m_disposed || value === this.m_url) return;
        this.m_load(value);
    }
});

/**
 * Loading state: empty, loading, ready or error.
 *
 * @member {string} status
 * @memberof runeos.ui.tilemap.TileAtlas
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.TileAtlas.prototype, "status", {
    /**
     * @this runeos.ui.tilemap.TileAtlas
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_status;
    }
});

/**
 * Visible decoded-image opacity, or zero while unavailable.
 *
 * @member {number} opacity
 * @memberof runeos.ui.tilemap.TileAtlas
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.TileAtlas.prototype, "opacity", {
    /**
     * @this runeos.ui.tilemap.TileAtlas
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_status === "ready" ? this.m_fadeState.alpha : 0;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Advances the owned fade independently of selection and label animations.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TileAtlas.prototype.update = function(step) {
    if (this.m_disposed) return;
    if (this.m_fadeTween && this.m_fadeTween.update(step)) {
        this.m_fadeTween.dispose();
        this.m_fadeTween = null;
    }
};

/**
 * Draws the selected source region into the configured target bounds.
 * No canvas, decoded-image copy or per-frame rectangle is allocated.
 *
 * @param {CanvasRenderingContext2D} context Caller-owned drawing context.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TileAtlas.prototype.render = function(context) {
    if (this["opacity"] <= 0 || this.width <= 0 || this.height <= 0) return;
    this.m_updateRegion();
    var region = this.m_region;
    context.save();
    try {
        context.globalAlpha *= this["opacity"];
        context.drawImage(this.m_image, region.x, region.y, region.width, region.height,
            this.x, this.y, this.width, this.height);
    } finally {
        context.restore();
    }
};

/**
 * Releases pending callbacks, fading and decoded-image references permanently.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TileAtlas.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_clear();
    this.m_url = "";
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Initializes optional loading after all owned state exists.
 *
 * @param {Object} options Constructor options.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileAtlas.prototype.m_construct = function(options) {
    if (options.url !== undefined) this.url = options.url;
};

/**
 * Starts a fresh native image load after releasing the previous source.
 *
 * @param {string} url New URL, or empty to clear.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileAtlas.prototype.m_load = function(url) {
    this.m_clear();
    this.m_url = url;
    if (!url) return;
    var atlas = this;
    var image = new Image();
    this.m_image = image;
    this.m_status = "loading";
    image.onload = function() { atlas.m_accept(image); };
    image.onerror = function() { atlas.m_reject(image); };
    try {
        image.src = runeos.util.Paths.resolve(url);
    } catch (error) {
        this.m_reject(image);
    }
};

/**
 * Accepts one current image with an even width and twice that width in height.
 *
 * @param {HTMLImageElement} image Completed source image.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileAtlas.prototype.m_accept = function(image) {
    if (!this.m_isPending(image)) return;
    this.m_detach(image);
    var width = image.naturalWidth;
    if (width <= 0 || width % 2 !== 0 || image.naturalHeight !== width * 2) {
        this.m_status = "error";
        return;
    }
    this.m_status = "ready";
    this.m_startFade();
};

/**
 * Records failure without allowing an old source to replace current state.
 *
 * @param {HTMLImageElement} image Failed source image.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileAtlas.prototype.m_reject = function(image) {
    if (!this.m_isPending(image)) return;
    this.m_detach(image);
    this.m_status = "error";
};

/**
 * Checks ownership and loading phase before accepting a native callback.
 *
 * @param {HTMLImageElement} image Callback source.
 *
 * @returns {boolean}
 * @private
 */
runeos.ui.tilemap.TileAtlas.prototype.m_isPending = function(image) {
    return !this.m_disposed && this.m_image === image && this.m_status === "loading";
};

/**
 * Starts the same icon fade used before artwork was extracted from Tile.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileAtlas.prototype.m_startFade = function() {
    this.m_fadeTween = new runeos.tween.Tween({
        target: this.m_fadeState,
        args: {alpha: 1},
        duration: this.m_config.iconFadeMs,
        transition: runeos.tween.Quad.easeOut
    });
    this.m_fadeTween.init();
};

/**
 * Calculates atlas coordinates without involving destination padding or scale.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileAtlas.prototype.m_updateRegion = function() {
    var size = this.m_image.naturalWidth;
    var half = size / 2;
    var region = this.m_region;
    region.y = 0;
    region.x = 0;
    region.height = size;
    region.width = size;
    if (this.variant === 1) {
        region.y = size;
        region.height = half;
    } else if (this.variant === 0) {
        region.x = this.normalIcon === 1 ? half : 0;
        region.y = size + half;
        region.height = half;
        region.width = half;
    }
};

/**
 * Detaches native callbacks without taking ownership of browser-wide caches.
 *
 * @param {HTMLImageElement} image Source image, if present.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileAtlas.prototype.m_detach = function(image) {
    if (image) {
        image.onerror = null;
        image.onload = null;
    }
};

/**
 * Releases current loading/fading state while keeping this component reusable.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileAtlas.prototype.m_clear = function() {
    this.m_detach(this.m_image);
    if (this.m_fadeTween) this.m_fadeTween.dispose();
    this.m_fadeTween = null;
    this.m_image = null;
    this.m_fadeState.alpha = 0;
    this.m_status = "empty";
};
