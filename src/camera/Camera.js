//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Camera instance.
 *
 * @constructor
 *
 * @param {runeos.display.Stage} input Stage to render.
 * @param {runeos.display.Screen} output Destination screen.
 *
 * @class
 * @classdesc
 *
 * The Camera class renders a stage directly to the OS screen without an
 * intermediate buffer.
 */
runeos.camera.Camera = function(input, output) {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Stage rendered by the camera.
     *
     * @type {runeos.display.Stage}
     * @private
     */
    this.m_input = input || null;

    /**
     * Screen receiving the camera output.
     *
     * @type {runeos.display.Screen}
     * @private
     */
    this.m_output = output;
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Returns the input associated with this instance.
 *
 * @member {runeos.display.Stage} input
 * @memberof runeos.camera.Camera
 * @instance
 */
Object.defineProperty(runeos.camera.Camera.prototype, "input", {
    /**
     * @this runeos.camera.Camera
     * @returns {runeos.display.Stage}
     * @ignore
     */
    get : function() {
        return this.m_input;
    },
    /**
     * @this runeos.camera.Camera
     * @ignore
     */
    set : function(value) {
        this.m_input = value;
    }
});

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Renders the current contents of the object.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.camera.Camera.prototype.render = function() {
    if (!this.m_input || !this.m_output) {
        return;
    }
    this.m_renderBackgroundColor();
    this.m_renderInput();
};

/**
 * Releases references and resources owned by the object.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.camera.Camera.prototype.dispose = function() {
    this.m_input = null;
    this.m_output = null;
};

//------------------------------------------------------------------------------
// Protected prototype methods
//------------------------------------------------------------------------------

/**
 * Clears the output and renders the stage background color.
 *
 * @returns {undefined}
 * @protected
 * @ignore
 */
runeos.camera.Camera.prototype.m_renderBackgroundColor = function() {
    var canvas = this.m_output["canvas"];
    canvas.clear();
    if (this.m_input.backgroundColor) {
        canvas.drawFill(this.m_input.backgroundColor);
    }
};

/**
 * Renders stage children in insertion order.
 *
 * @returns {undefined}
 * @protected
 * @ignore
 */
runeos.camera.Camera.prototype.m_renderInput = function() {
    var children = this.m_input["children"];
    var canvas = this.m_output["canvas"];
    for (var i = 0, length = children.length; i < length; i++) {
        canvas.renderDisplayObject(children[i]);
    }
};
