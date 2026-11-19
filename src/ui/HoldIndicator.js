//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new HoldIndicator instance.
 *
 * @constructor
 *
 * @param {Object} [options] Indicator appearance settings.
 *
 * @class
 * @classdesc
 *
 * Draws supplied progress directly into the shared output canvas. Temporarily
 * saves only the affected pixels so paused or partial game frames can be restored.
 * Owns no DOM, canvas, input, timers or frame loop.
 */
runeos.ui.HoldIndicator = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Validated immutable appearance settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("exitIndicator", options.config);

    /**
     * Normalized requested progress.
     *
     * @type {number}
     * @private
     */
    this.m_progress = 0;

    /**
     * Whether feedback should be drawn on the next frame.
     *
     * @type {boolean}
     * @private
     */
    this.m_visible = false;

    /**
     * Owned regional restoration, borrowing output only while pixels are saved.
     *
     * @type {runeos.display.CanvasRegion}
     * @private
     */
    this.m_region = new runeos.display.CanvasRegion();

    /**
     * Permanent teardown flag.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Sets normalized progress for the next shared-canvas render.
 *
 * @param {number} progress Finite progress between zero and one.
 *
 * @returns {undefined}
 */
runeos.ui.HoldIndicator.prototype.show = function(progress) {
    if (this.m_disposed) return;
    this.m_progress = Math.max(0, Math.min(1, progress));
    this.m_visible = true;
};

/**
 * Draws after the game or loading stage has completed its frame. restore must
 * run before the next game update so saved pixels never cover new game drawing.
 * Repeated renders without a game update restore the previous drawing first.
 *
 * @param {runeos.display.Canvas} canvas Borrowed shared output canvas.
 *
 * @returns {undefined}
 */
runeos.ui.HoldIndicator.prototype.render = function(canvas) {
    this.restore();
    if (this.m_disposed || !this.m_visible || canvas.width <= 0 || canvas.height <= 0) return;
    if (!this.m_region.capture(canvas, this.m_getBounds(canvas))) return;
    var context = canvas["context"];
    var scale = canvas.height / runeos.display.Screen.DEFAULT_HEIGHT;
    var x = canvas.width / scale / 2;
    var y = runeos.display.Screen.DEFAULT_HEIGHT - this.m_config.marginPx - this.m_config.sizePx / 2;
    var radius = this.m_config.sizePx / 2 - this.m_config.strokeWidthPx - 3;
    context.save();
    try {
        this.m_prepareContext(context, scale);
        this.m_renderBackground(context, x, y);
        this.m_renderTrack(context, x, y, radius);
        this.m_renderProgress(context, x, y, radius);
    } finally {
        context.restore();
    }
};

/**
 * Restores the affected pixels before game updates or when feedback disappears.
 * A resized buffer discards the saved region rather than restoring stale pixels.
 *
 * @returns {undefined}
 */
runeos.ui.HoldIndicator.prototype.restore = function() {
    this.m_region.restore();
};

/**
 * Hides progress and immediately restores a paused application's pixels.
 *
 * @returns {undefined}
 */
runeos.ui.HoldIndicator.prototype.hide = function() {
    this.m_visible = false;
    this.restore();
};

/**
 * Restores output and releases saved pixel data without disposing the canvas.
 *
 * @returns {undefined}
 */
runeos.ui.HoldIndicator.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.hide();
    this.m_region.dispose();
    this.m_disposed = true;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Converts the indicator's logical bounds to a clipped physical pixel region.
 * One extra pixel around each edge includes antialiasing at the circle boundary.
 *
 * @param {runeos.display.Canvas} canvas Shared output canvas.
 *
 * @returns {Object} Integer x, y, width and height in canvas pixels.
 * @private
 */
runeos.ui.HoldIndicator.prototype.m_getBounds = function(canvas) {
    var scale = canvas.height / runeos.display.Screen.DEFAULT_HEIGHT;
    var size = this.m_config.sizePx * scale;
    var left = (canvas.width - size) / 2;
    var top = canvas.height - (this.m_config.marginPx + this.m_config.sizePx) * scale;
    var x = Math.max(0, Math.floor(left) - 1);
    var y = Math.max(0, Math.floor(top) - 1);
    var right = Math.min(canvas.width, Math.ceil(left + size) + 1);
    var bottom = Math.min(canvas.height, Math.ceil(top + size) + 1);
    return {
        x: x,
        y: y,
        width: right - x,
        height: bottom - y
    };
};

/**
 * Isolates drawing from the application's transform, opacity and paint effects.
 * The caller saves and restores context state around the complete operation.
 *
 * @param {CanvasRenderingContext2D} context Shared drawing context.
 * @param {number} scale Output pixels per logical OS pixel.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.HoldIndicator.prototype.m_prepareContext = function(context, scale) {
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.filter = "none";
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.shadowOffsetX = 0;
    context.setLineDash([]);
    context.lineWidth = this.m_config.strokeWidthPx;
    context.lineCap = "butt";
};

/**
 * Draws the translucent circular backdrop.
 *
 * @param {CanvasRenderingContext2D} context Shared drawing context.
 * @param {number} x Logical center X.
 * @param {number} y Logical center Y.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.HoldIndicator.prototype.m_renderBackground = function(context, x, y) {
    context.beginPath();
    context.arc(x, y, this.m_config.sizePx / 2, 0, Math.PI * 2);
    context.fillStyle = this.m_config.backgroundColor;
    context.globalAlpha = this.m_config.backgroundOpacity;
    context.fill();
};

/**
 * Draws the faint full-circle reference track.
 *
 * @param {CanvasRenderingContext2D} context Shared drawing context.
 * @param {number} x Logical center X.
 * @param {number} y Logical center Y.
 * @param {number} radius Logical ring radius.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.HoldIndicator.prototype.m_renderTrack = function(context, x, y, radius) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.strokeStyle = this.m_config.color;
    context.globalAlpha = this.m_config.trackOpacity;
    context.stroke();
};

/**
 * Draws clockwise progress from the top of the ring.
 *
 * @param {CanvasRenderingContext2D} context Shared drawing context.
 * @param {number} x Logical center X.
 * @param {number} y Logical center Y.
 * @param {number} radius Logical ring radius.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.HoldIndicator.prototype.m_renderProgress = function(context, x, y, radius) {
    if (this.m_progress <= 0) return;
    var start = -Math.PI / 2;
    context.beginPath();
    context.arc(x, y, radius, start, start + this.m_progress * Math.PI * 2);
    context.globalAlpha = 1;
    context.lineCap = "round";
    context.stroke();
};
