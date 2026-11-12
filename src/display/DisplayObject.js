//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new DisplayObject instance.
 *
 * @constructor
 *
 * @param {number} [x] Horizontal position in pixels.
 * @param {number} [y] Vertical position in pixels.
 * @param {number} [width] Width in pixels.
 * @param {number} [height] Height in pixels.
 *
 * @class
 * @classdesc
 *
 * The DisplayObject class represents a drawable object in parent-local
 * coordinates.
 */
runeos.display.DisplayObject = function(x, y, width, height) {

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Horizontal position relative to the parent.
     *
     * @type {number}
     */
    this.x = x || 0;

    /**
     * Vertical position relative to the parent.
     *
     * @type {number}
     */
    this.y = y || 0;

    /**
     * Width of the display object in pixels.
     *
     * @type {number}
     */
    this.width = width === undefined ? 16 : width;

    /**
     * Height of the display object in pixels.
     *
     * @type {number}
     */
    this.height = height === undefined ? 16 : height;

    /**
     * Whether the object is rendered.
     *
     * @type {boolean}
     */
    this.visible = true;

    /**
     * Opacity of the display object.
     *
     * @type {number}
     */
    this.alpha = 1;

    /**
     * Visual scale applied around the object center without changing layout
     * size.
     *
     * @type {number}
     * @default 1
     */
    this.scale = 1;

    /**
     * Background fill color. An empty string leaves the background transparent.
     *
     * @type {string}
     */
    this.backgroundColor = "";

    //--------------------------------------------------------------------------
    // Protected properties
    //--------------------------------------------------------------------------

    /**
     * Pixel buffer used to render the object.
     *
     * @type {runeos.display.Canvas}
     * @protected
     */
    this.m_canvas = null;
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Returns the canvas associated with this instance.
 *
 * @member {runeos.display.Canvas} canvas
 * @memberof runeos.display.DisplayObject
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.display.DisplayObject.prototype, "canvas", {
    /**
     * @this runeos.display.DisplayObject
     * @returns {runeos.display.Canvas}
     * @ignore
     */
    get : function() {
        if (!this.m_canvas) {
            this.m_canvas = new runeos.display.Canvas(this.width, this.height);
        }
        return this.m_canvas;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Returns the visual scale used for rendering, without changing layout
 * geometry.
 * Override to add temporary effects independently of animated scale properties.
 *
 * @returns {number} Effective render scale.
 * @ignore
 */
runeos.display.DisplayObject.prototype.getRenderScale = function() {
    return this.scale;
};

/**
 * Calculates the scaled rectangle in parent coordinates, centered on the
 * unchanged layout rectangle. Supply a result object to reuse its storage.
 *
 * @param {Object} [result] Reusable object receiving x, y, width and height.
 * @param {number} [offsetX=0] Parent horizontal translation.
 * @param {number} [offsetY=0] Parent vertical translation.
 *
 * @returns {Object} The supplied result object, or a newly created rectangle.
 */
runeos.display.DisplayObject.prototype.getRenderBounds = function(result, offsetX, offsetY) {
    result = result || {};
    var scale = this.getRenderScale();
    result.width = this.width * scale;
    result.height = this.height * scale;
    result.x = this.x + (offsetX || 0) + (this.width - result.width) / 2;
    result.y = this.y + (offsetY || 0) + (this.height - result.height) / 2;
    return result;
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Updates the object for the current frame.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.display.DisplayObject.prototype.update = function(step) {
};

/**
 * Renders the current contents of the object.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.display.DisplayObject.prototype.render = function() {
    var canvas = this.canvas;
    canvas.resize(this.width, this.height);
    canvas.clear();
    if (this.backgroundColor) {
        canvas.drawFill(this.backgroundColor);
    }
};

/**
 * Releases references and resources owned by the object.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.display.DisplayObject.prototype.dispose = function() {
    if (this.m_canvas) {
        this.m_canvas.dispose();
    }
    this.m_canvas = null;
};
