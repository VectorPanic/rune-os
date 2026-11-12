//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a centered startup logo with its own image loading and visual lifecycle.
 *
 * @constructor
 * @extends runeos.display.DisplayObject
 * @param {Object} config Logo and loading settings.
 * @param {Object} bounds Available width and height.
 *
 * @class
 * @classdesc
 * Owns the startup image, timeout and pulse. The scene controls fades and timing.
 */
runeos.ui.BootLogo = function(config, bounds) {
    runeos.display.DisplayObject.call(this,
        (bounds.width - config.logoSizePx) / 2,
        (bounds.height - config.logoSizePx) / 2,
        config.logoSizePx, config.logoSizePx);

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Visual and loading settings supplied by the owning scene.
     *
     * @type {Object}
     * @private
     */
    this.m_config = config;

    /**
     * Owned logo image, released on disposal.
     *
     * @type {HTMLImageElement}
     * @private
     */
    this.m_image = null;

    /**
     * Pending image timeout.
     *
     * @type {?number}
     * @private
     */
    this.m_timeout = null;

    /**
     * Completion callback for the active loading attempt.
     *
     * @type {Function}
     * @private
     */
    this.m_onReady = null;

    /**
     * Whether the image loading attempt has settled.
     *
     * @type {boolean}
     * @private
     */
    this.m_ready = false;

    /**
     * Elapsed pulse phase in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_pulseTime = 0;

    /**
     * Prevents late callbacks and repeated loading after disposal.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    this.alpha = 0;
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.ui.BootLogo.prototype = Object.create(runeos.display.DisplayObject.prototype);
runeos.ui.BootLogo.prototype.constructor = runeos.ui.BootLogo;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether the loading attempt produced an image.
 *
 * @member {boolean} loaded
 * @memberof runeos.ui.BootLogo
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.BootLogo.prototype, "loaded", {
    /**
     * @this runeos.ui.BootLogo
     * @returns {boolean}
     * @ignore
     */
    get: function() {
        return this.m_ready && this.m_image !== null;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Loads once and reports completion even if the image is missing or times out.
 * Disposing the object cancels its completion callback.
 *
 * @param {Function} onReady Called after the loading attempt settles.
 *
 * @returns {undefined}
 */
runeos.ui.BootLogo.prototype.load = function(onReady) {
    if (this.m_disposed || this.m_ready || this.m_image) return;
    var logo = this;
    var image = new Image();
    this.m_image = image;
    this.m_onReady = onReady;
    image.onload = function() { logo.m_finish(true); };
    image.onerror = function() { logo.m_finish(false); };
    if (this.m_config.imageTimeoutMs > 0) {
        this.m_timeout = window.setTimeout(function() {
            logo.m_finish(false);
        }, this.m_config.imageTimeoutMs);
    }
    try {
        image.src = runeos.util.Paths.resolve(this.m_config.logoUrl);
    } catch (error) {
        this.m_finish(false);
    }
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Advances the visual pulse after the loading attempt has completed.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.BootLogo.prototype.update = function(step) {
    if (this.m_disposed || !this.m_ready || typeof step !== "number" || !isFinite(step) || step <= 0) return;
    this.m_pulseTime = (this.m_pulseTime + step) % this.m_config.pulsePeriodMs;
    this.scale = this.m_config.pulseEnabled ?
        1 + this.m_config.pulseAmount * runeos.util.Math.pulse(this.m_pulseTime, this.m_config.pulsePeriodMs) : 1;
};

/**
 * Draws the loaded image into the owned display buffer.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.BootLogo.prototype.render = function() {
    if (this.m_disposed) return;
    runeos.display.DisplayObject.prototype.render.call(this);
    if (this.loaded && this.m_image.naturalWidth > 0) {
        this.canvas.context.drawImage(this.m_image, 0, 0, this.width, this.height);
    }
};

/**
 * Cancels loading and releases the image and display buffer.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.BootLogo.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_onReady = null;
    this.m_clearLoading();
    if (this.m_image) this.m_image.src = "";
    this.m_image = null;
    runeos.display.DisplayObject.prototype.dispose.call(this);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Settles loading once before notifying the owning scene.
 *
 * @param {boolean} loaded Whether the image loaded successfully.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.BootLogo.prototype.m_finish = function(loaded) {
    if (this.m_disposed || this.m_ready) return;
    this.m_ready = true;
    this.m_clearLoading();
    if (!loaded) {
        console.warn("Boot: could not load the Rune OS logo.");
        this.m_image.src = "";
        this.m_image = null;
    }
    var onReady = this.m_onReady;
    this.m_onReady = null;
    onReady();
};

/**
 * Detaches image events and cancels the pending timeout.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.BootLogo.prototype.m_clearLoading = function() {
    window.clearTimeout(this.m_timeout);
    this.m_timeout = null;
    if (this.m_image) {
        this.m_image.onerror = null;
        this.m_image.onload = null;
    }
};
