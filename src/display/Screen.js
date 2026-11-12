//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Screen instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Owns the shared canvas and restores OS drawing state after an application
 * exits.
 */
runeos.display.Screen = function() {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Pixel buffer owning the shared visible canvas and its drawing context.
     *
     * @type {runeos.display.Canvas}
     * @private
     */
    this.m_canvas = null;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Initializes the object and performs necessary construction tasks.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Default height of the screen in the RuneOS application.
 *
 * @type {number}
 * @const
 */
runeos.display.Screen.DEFAULT_HEIGHT = 720;

/**
 * Default width of the screen in the RuneOS application.
 *
 * @type {number}
 * @const
 */
runeos.display.Screen.DEFAULT_WIDTH = 1280;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Pixel buffer wrapping the shared screen canvas.
 *
 * @member {runeos.display.Canvas} canvas
 * @memberof runeos.display.Screen
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.display.Screen.prototype, "canvas", {
    /**
     * @this runeos.display.Screen
     * @returns {runeos.display.Canvas}
     * @ignore
     */
    get : function() {
        return this.m_canvas;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Appends the canvas element to the specified HTML element if valid.
 *
 * @param {Element} element The HTMLElement to which the canvas will be appended.
 *
 * @returns {undefined}
 */
runeos.display.Screen.prototype.appendTo = function(element) {
    if (element instanceof HTMLElement && this.m_canvas) {
        element.appendChild(this.m_canvas.element);
    }
};

/**
 * Sets the resolution of the canvas, ensuring it does not exceed the default
 * dimensions.
 *
 * @param {number} width The desired width of the canvas.
 * @param {number} height The desired height of the canvas.
 *
 * @returns {undefined}
 */
runeos.display.Screen.prototype.setResolution = function(width, height) {
    if (this.m_canvas) {
        this.canvas.resize(
            Math.min(width, runeos.display.Screen.DEFAULT_WIDTH),
            Math.min(height, runeos.display.Screen.DEFAULT_HEIGHT)
        );
        this.m_canvas.element.style.imageRendering = "pixelated";
    }
};

/**
 * Restores OS resolution and drawing state after an application exits.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.display.Screen.prototype.restore = function() {
    // SDK disposal can detach the shared canvas when the application stops.
    if (!this.m_canvas.element.parentNode && document.body) {
        this.appendTo(document.body);
    }
    this.canvas.reset(runeos.display.Screen.DEFAULT_WIDTH, runeos.display.Screen.DEFAULT_HEIGHT);
    this.m_canvas.element.style.imageRendering = "pixelated";
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Constructs the shared canvas and its drawing context.
 *
 * @returns {undefined}
 * @private
 */
runeos.display.Screen.prototype.m_construct = function() {
    this.m_constructCanvas();
    this.m_constructStyle();
};

/**
 * Constructs the shared pixel buffer using the standard Canvas implementation.
 *
 * @returns {undefined}
 * @private
 */
runeos.display.Screen.prototype.m_constructCanvas = function() {
    this.m_canvas = new runeos.display.Canvas(
        runeos.display.Screen.DEFAULT_WIDTH, runeos.display.Screen.DEFAULT_HEIGHT
    );
    this.m_canvas.context.imageSmoothingQuality = "low";
};

/**
 * Fits the visible canvas to its host without changing logical resolution.
 *
 * @returns {undefined}
 * @private
 */
runeos.display.Screen.prototype.m_constructStyle = function() {
    var style = this.m_canvas.element.style;
    style.width = "100%";
    style.height = "100%";
    style.imageRendering = "pixelated";
};
