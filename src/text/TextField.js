//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new TextField instance.
 *
 * @constructor
 * @extends runeos.display.DisplayObject
 *
 * @param {Object} [options] Text, typography role, appearance, dimensions and scrolling settings.
 *
 * @class
 * @classdesc
 *
 * A single-line text field. Overflow scrolls left at a fixed reading speed,
 * repeats seamlessly after a short pause. Text fitting the field remains
 * stationary.
 */
runeos.text.TextField = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};
    var settings = runeos.system.Config.getGroup("text", options.config);
    var style = runeos.text.Typography.getStyle(options.role || "body", settings, options);

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    runeos.display.DisplayObject.call(this, options.x, options.y,
        options.width === undefined ? 184 : options.width,
        style.height);

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Initial role opacity; presentation may animate this inherited property.
     *
     * @type {number}
     */
    this.alpha = style.alpha;

    /**
     * Text displayed by the field.
     *
     * @type {string}
     */
    this.text = options.text === undefined ? "" : String(options.text);

    /**
     * Canvas font used to draw and measure the text.
     *
     * @type {string}
     */
    this.font = style.font;

    /**
     * Text fill color.
     *
     * @type {string}
     */
    this.color = style.color;

    /**
     * Optional text-shadow color; transparent disables the effect.
     *
     * @type {string}
     */
    this.shadowColor = style.shadowColor;

    /**
     * Text-shadow blur radius in pixels.
     *
     * @type {number}
     */
    this.shadowBlur = style.shadowBlur;

    /**
     * Horizontal text-shadow offset in pixels.
     *
     * @type {number}
     */
    this.shadowOffsetX = style.shadowOffsetX;

    /**
     * Vertical text-shadow offset in pixels.
     *
     * @type {number}
     */
    this.shadowOffsetY = style.shadowOffsetY;

    /**
     * Reading speed in pixels per second. Zero disables scrolling.
     *
     * @type {number}
     */
    this.scrollSpeed = style.scrollSpeed;

    /**
     * Pause before each pass of the text, in milliseconds.
     *
     * @type {number}
     */
    this.scrollPause = style.scrollPause;

    /**
     * Space between repeated text copies, in pixels.
     *
     * @type {number}
     * @default 48
     */
    this.scrollGap = style.scrollGap;

    /**
     * Additional delay before the first scrolling pass, in milliseconds.
     *
     * @type {number}
     */
    this.scrollDelay = typeof options.scrollDelay === "number" &&
        isFinite(options.scrollDelay) ? Math.max(0, options.scrollDelay) : 0;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable initial style, including local overrides, used as a fade baseline.
     *
     * @type {Object}
     * @private
     */
    this.m_style = style;

    /**
     * Immutable text settings for this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = settings;

    /**
     * Cached measured text width.
     *
     * @type {number}
     * @private
     */
    this.m_textWidth = 0;

    /**
     * Independent overflow-scroll timing and position.
     *
     * @type {runeos.text.TextScroll}
     * @private
     */
    this.m_scroll = new runeos.text.TextScroll();

    /**
     * Text used for the cached measurement.
     *
     * @type {?string}
     * @private
     */
    this.m_lastText = null;

    /**
     * Font used for the cached measurement.
     *
     * @type {?string}
     * @private
     */
    this.m_lastFont = null;

    /**
     * Field width used for the current scrolling cycle.
     *
     * @type {number}
     * @private
     */
    this.m_lastWidth = -1;
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.text.TextField.prototype = Object.create(runeos.display.DisplayObject.prototype);
runeos.text.TextField.prototype.constructor = runeos.text.TextField;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Resolved initial role style. Mutable field properties may differ during
 * animation or after explicit changes; this baseline remains unchanged.
 *
 * @member {Object} style
 * @memberof runeos.text.TextField
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.text.TextField.prototype, "style", {
    /**
     * @this runeos.text.TextField
     * @returns {Object}
     * @ignore
     */
    get : function() {
        return this.m_style;
    }
});

/**
 * Cached natural text width, independent of the field's clipping width.
 *
 * @member {number} textWidth
 * @memberof runeos.text.TextField
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.text.TextField.prototype, "textWidth", {
    /**
     * @this runeos.text.TextField
     * @returns {number}
     * @ignore
     */
    get : function() {
        this.m_updateMetrics();
        return this.m_textWidth;
    }
});

/**
 * Current leftward text offset in pixels.
 *
 * @member {number} scrollOffset
 * @memberof runeos.text.TextField
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.text.TextField.prototype, "scrollOffset", {
    /**
     * @this runeos.text.TextField
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_scroll["offset"];
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Measures text using a supplied destination, without allocating a field buffer.
 *
 * @param {runeos.display.Canvas} canvas Shared destination canvas.
 *
 * @returns {number} Natural text width in logical pixels.
 */
runeos.text.TextField.prototype.measure = function(canvas) {
    this.m_updateMetrics(canvas["context"]);
    return this.m_textWidth;
};

/**
 * Draws at natural size directly into a borrowed destination. Uses the same
 * text painter and clipping as normal field rendering, without a second canvas.
 *
 * @param {runeos.display.Canvas} canvas Destination canvas.
 * @param {number} [offsetX=0] Parent horizontal translation.
 * @param {number} [offsetY=0] Parent vertical translation.
 *
 * @returns {undefined}
 */
runeos.text.TextField.prototype.drawTo = function(canvas, offsetX, offsetY) {
    if (!this.visible || this.alpha <= 0 || this.width <= 0 || this.height <= 0) return;
    this.m_updateMetrics(canvas["context"]);
    var context = canvas["context"];
    context.save();
    try {
        context.translate(this.x + (offsetX || 0), this.y + (offsetY || 0));
        context.globalAlpha *= this.alpha;
        context.beginPath();
        context.rect(0, 0, this.width, this.height);
        context.clip();
        if (this.backgroundColor) {
            context.fillStyle = this.backgroundColor;
            context.fillRect(0, 0, this.width, this.height);
        }
        this.m_renderText(context);
    } finally {
        context.restore();
    }
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Advances scrolling using elapsed milliseconds.
 *
 * @param {number} step Current time step in milliseconds.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.text.TextField.prototype.update = function(step) {
    this.m_updateMetrics();
    var pause = typeof this.scrollPause === "number" && isFinite(this.scrollPause) ?
        Math.max(0, this.scrollPause) : this.m_config.scrollPauseMs;
    this.m_scroll.update(step, this.m_textWidth, this.width, this.scrollSpeed, pause, this.m_getScrollGap());
};

/**
 * Returns to the beginning and restarts the reading pause.
 *
 * @returns {undefined}
 */
runeos.text.TextField.prototype.restartScroll = function() {
    this.m_updateMetrics();
    this.m_scroll.restart(this.scrollDelay);
};

/**
 * Renders text at natural size, clipped by the field pixel buffer.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.text.TextField.prototype.render = function() {
    this.m_updateMetrics();
    runeos.display.DisplayObject.prototype.render.call(this);
    this.m_renderText(this["canvas"].context);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Paints the prepared string with shared font, shadow and scroll behavior.
 *
 * @param {CanvasRenderingContext2D} context Destination drawing context.
 *
 * @returns {undefined}
 * @private
 */
runeos.text.TextField.prototype.m_renderText = function(context) {
    context.save();
    try {
        context.font = this.font;
        context.fillStyle = this.color;
        context.shadowColor = this.shadowColor;
        context.shadowBlur = this.shadowBlur;
        context.shadowOffsetX = this.shadowOffsetX;
        context.shadowOffsetY = this.shadowOffsetY;
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(/**
             * Measurement populated this cache before painting.
             * @type {string}
             */ (this.m_lastText), -this.m_scroll["offset"], this.height / 2);
        if (this.m_textWidth > this.width) {
            var next = this.m_textWidth + this.m_getScrollGap() - this.m_scroll["offset"];
            if (next < this.width) {
                context.fillText(/**
             * Measurement populated this cache before painting.
             * @type {string}
             */ (this.m_lastText), next, this.height / 2);
            }
        }
    } finally {
        context.restore();
    }
};

/**
 * Measures changed text or fonts and restarts scrolling when the content or
 * width changes.
 *
 * @param {CanvasRenderingContext2D} [context] Borrowed metrics context.
 *
 * @returns {undefined}
 * @private
 */
runeos.text.TextField.prototype.m_updateMetrics = function(context) {
    var text = this.text === null || this.text === undefined ? "" : String(this.text);
    if (text !== this.m_lastText || this.font !== this.m_lastFont) {
        context = context || this["canvas"].context;
        context.save();
        try {
            context.font = this.font;
            this.m_textWidth = context.measureText(text).width;
        } finally {
            context.restore();
        }
        this.m_lastText = text;
        this.m_lastFont = this.font;
        this.m_scroll.restart(this.scrollDelay);
    }
    if (this.width !== this.m_lastWidth) {
        this.m_lastWidth = this.width;
        this.m_scroll.restart(this.scrollDelay);
    }
};

/**
 * Returns a finite nonnegative gap between repeated copies.
 *
 * @returns {number} Gap in pixels.
 * @private
 */
runeos.text.TextField.prototype.m_getScrollGap = function() {
    return typeof this.scrollGap === "number" && isFinite(this.scrollGap) ?
        Math.max(0, this.scrollGap) : this.m_config.scrollGapPx;
};
