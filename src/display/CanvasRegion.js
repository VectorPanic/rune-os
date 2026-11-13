//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new CanvasRegion instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Temporarily saves a small rectangle of shared output for feedback restoration.
 * Owns pixel data only; never creates, resizes or disposes a canvas.
 */
runeos.display.CanvasRegion = function() {
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Saved pixel data and its borrowed canvas reference.
     *
     * @type {?Object}
     * @private
     */
    this.m_saved = null;

    /**
     * Permanent teardown flag.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether a saved region is waiting to be restored.
 *
 * @member {boolean} captured
 * @memberof runeos.display.CanvasRegion
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.display.CanvasRegion.prototype, "captured", {
    /**
     * @this runeos.display.CanvasRegion
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_saved !== null;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Saves clipped physical output bounds. Unreadable regions return false so
 * callers can skip drawing feedback that could not later be restored.
 *
 * @param {runeos.display.Canvas} canvas Borrowed shared output.
 * @param {Object} bounds Physical x, y, width and height.
 *
 * @returns {boolean} Whether pixels were captured.
 */
runeos.display.CanvasRegion.prototype.capture = function(canvas, bounds) {
    if (this.m_disposed) return false;
    this.restore();
    var x = Math.max(0, Math.floor(bounds.x));
    var y = Math.max(0, Math.floor(bounds.y));
    var width = Math.min(canvas.width, Math.ceil(bounds.x + bounds.width)) - x;
    var height = Math.min(canvas.height, Math.ceil(bounds.y + bounds.height)) - y;
    if (width <= 0 || height <= 0) return false;
    try {
        var pixels = canvas["context"].getImageData(x, y, width, height);
        this.m_saved = {
            canvas: canvas,
            width: canvas.width,
            height: canvas.height,
            x: x,
            y: y,
            pixels: pixels
        };
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Restores saved pixels and releases their borrowed output reference.
 * A resized buffer discards obsolete pixels instead.
 *
 * @returns {undefined}
 */
runeos.display.CanvasRegion.prototype.restore = function() {
    var saved = this.m_saved;
    this.m_saved = null;
    if (!saved || saved.canvas.width !== saved.width || saved.canvas.height !== saved.height) return;
    saved.canvas.context.putImageData(saved.pixels, saved.x, saved.y);
};

/**
 * Releases obsolete pixels without repainting output now owned by another renderer.
 *
 * @returns {undefined}
 */
runeos.display.CanvasRegion.prototype.discard = function() {
    this.m_saved = null;
};

/**
 * Restores output and permanently releases owned pixel data.
 *
 * @returns {undefined}
 */
runeos.display.CanvasRegion.prototype.dispose = function() {
    this.restore();
    this.m_disposed = true;
};
