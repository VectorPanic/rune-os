//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Canvas instance.
 *
 * @constructor
 *
 * @param {number} width Width in pixels.
 * @param {number} height Height in pixels.
 * @param {HTMLCanvasElement} [element] Existing canvas to wrap without copying.
 *
 * @class
 * @classdesc
 *
 * The Canvas class wraps a pixel buffer used by display objects or the shared
 * OS screen.
 */
runeos.display.Canvas = function(width, height, element) {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Canvas element containing the pixel buffer.
     *
     * @type {HTMLCanvasElement}
     * @private
     */
    this.m_canvas = element || /**
     * @type {HTMLCanvasElement}
     */ (document.createElement("canvas"));

    /**
     * Drawing context of the pixel buffer.
     *
     * @type {CanvasRenderingContext2D}
     * @private
     */
    this.m_context = /**
     * @type {CanvasRenderingContext2D}
     */ (this.m_canvas.getContext("2d"));

    /**
     * Reusable scaled bounds for display-object rendering and culling.
     *
     * @type {Object}
     * @private
     */
    this.m_renderBounds = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Initializes the pixel buffer without resizing an existing canvas.
     */
    this.m_construct(width, height, element);
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Returns the element associated with this instance.
 *
 * @member {HTMLCanvasElement} element
 * @memberof runeos.display.Canvas
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.display.Canvas.prototype, "element", {
    /**
     * @this runeos.display.Canvas
     * @returns {HTMLCanvasElement}
     * @ignore
     */
    get : function() {
        return this.m_canvas;
    }
});

/**
 * Returns the context associated with this instance.
 *
 * @member {CanvasRenderingContext2D} context
 * @memberof runeos.display.Canvas
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.display.Canvas.prototype, "context", {
    /**
     * @this runeos.display.Canvas
     * @returns {CanvasRenderingContext2D}
     * @ignore
     */
    get : function() {
        return this.m_context;
    }
});

/**
 * Returns the width associated with this instance.
 *
 * @member {number} width
 * @memberof runeos.display.Canvas
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.display.Canvas.prototype, "width", {
    /**
     * @this runeos.display.Canvas
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_canvas.width;
    }
});

/**
 * Returns the height associated with this instance.
 *
 * @member {number} height
 * @memberof runeos.display.Canvas
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.display.Canvas.prototype, "height", {
    /**
     * @this runeos.display.Canvas
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_canvas.height;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Resizes the pixel buffer only when its dimensions change.
 *
 * @param {number} width Width in pixels.
 * @param {number} height Height in pixels.
 *
 * @returns {undefined}
 */
runeos.display.Canvas.prototype.resize = function(width, height) {
    if (this.m_canvas.width !== width) {
        this.m_canvas.width = width;
    }
    if (this.m_canvas.height !== height) {
        this.m_canvas.height = height;
    }
    this.m_context.imageSmoothingEnabled = false;
};

/**
 * Clears pixels and all drawing state, including clipping and the saved state
 * stack, even when dimensions are unchanged. Retains the element and context.
 * Omitted dimensions retain the current pixel-buffer size.
 *
 * @param {number} [width] Target width in pixels.
 * @param {number} [height] Target height in pixels.
 *
 * @returns {undefined}
 */
runeos.display.Canvas.prototype.reset = function(width, height) {
    width = width === undefined ? this.width : width;
    height = height === undefined ? this.height : height;
    // Assigning width resets the native buffer and context even at the same size.
    this.m_canvas.width = width;
    this.resize(width, height);
    this.m_context.setTransform(1, 0, 0, 1, 0, 0);
    this.m_context.globalAlpha = 1;
    this.m_context.globalCompositeOperation = "source-over";
};

/**
 * Clears the entire pixel buffer.
 *
 * @returns {undefined}
 */
runeos.display.Canvas.prototype.clear = function() {
    this.m_context.clearRect(0, 0, this.width, this.height);
};

/**
 * Fills the pixel buffer with the specified color.
 *
 * @param {string} color Fill color.
 *
 * @returns {undefined}
 */
runeos.display.Canvas.prototype.drawFill = function(color) {
    this.m_context.fillStyle = color;
    this.m_context.fillRect(0, 0, this.width, this.height);
};

/**
 * Renders a visible display object intersecting the pixel buffer.
 *
 * @param {runeos.display.DisplayObject} object Object to render.
 * @param {number} [offsetX=0] Parent horizontal translation.
 * @param {number} [offsetY=0] Parent vertical translation.
 *
 * @returns {undefined}
 */
runeos.display.Canvas.prototype.renderDisplayObject = function(object, offsetX, offsetY) {
    if (typeof object.renderTo === "function") {
        object.renderTo(this, offsetX, offsetY);
        return;
    }
    var bounds = object.getRenderBounds(this.m_renderBounds, offsetX, offsetY);
    // Snapshot primitives before render(), which can render other objects.
    var width = bounds.width;
    var height = bounds.height;
    var x = bounds.x;
    var y = bounds.y;
    if (!object.visible || object.alpha <= 0 || width <= 0 || height <= 0 ||
        x >= this.width || y >= this.height || x + width <= 0 || y + height <= 0) {
        return;
    }
    
    this.m_renderBufferedObject(object, x, y, width, height);
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Releases references and resources owned by the object.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.display.Canvas.prototype.dispose = function() {
    this.m_context = null;
    this.m_canvas = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Renders the object into its own buffer and composites it at the saved bounds.
 *
 * @param {runeos.display.DisplayObject} object Object backed by a canvas.
 * @param {number} x Destination left edge.
 * @param {number} y Destination top edge.
 * @param {number} width Destination width.
 * @param {number} height Destination height.
 *
 * @returns {undefined}
 * @private
 */
runeos.display.Canvas.prototype.m_renderBufferedObject = function(object, x, y, width, height) {
    object.render();
    var context = this.m_context;
    context.save();
    try {
        context.globalAlpha *= object.alpha;
        context.drawImage(object["canvas"].element, x, y, width, height);
    } finally {
        context.restore();
    }
};

/**
 * Sets initial dimensions only for a newly created canvas.
 *
 * @param {number} width Initial pixel width.
 * @param {number} height Initial pixel height.
 * @param {HTMLCanvasElement} [element] Existing canvas, if supplied.
 *
 * @returns {undefined}
 * @private
 */
runeos.display.Canvas.prototype.m_construct = function(width, height, element) {
    if (!element) {
        this.resize(width || 16, height || 16);
    }
};

