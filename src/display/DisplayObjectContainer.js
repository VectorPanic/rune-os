//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new DisplayObjectContainer instance.
 *
 * @constructor
 * @extends runeos.display.DisplayObject
 *
 * @param {number} [x] Horizontal position in pixels.
 * @param {number} [y] Vertical position in pixels.
 * @param {number} [width] Width in pixels.
 * @param {number} [height] Height in pixels.
 *
 * @class
 * @classdesc
 *
 * The DisplayObjectContainer class maintains and renders an ordered list of
 * children.
 */
runeos.display.DisplayObjectContainer = function(x, y, width, height) {
    runeos.display.DisplayObject.call(this, x, y, width, height);

    //--------------------------------------------------------------------------
    // Protected properties
    //--------------------------------------------------------------------------

    /**
     * List of current children.
     *
     * @type {Array.<runeos.display.DisplayObject>}
     * @protected
     * @ignore
     */
    this.m_children = [];
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.display.DisplayObjectContainer.prototype = Object.create(runeos.display.DisplayObject.prototype);
runeos.display.DisplayObjectContainer.prototype.constructor = runeos.display.DisplayObjectContainer;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Returns the children associated with this instance.
 *
 * @member {Array.<runeos.display.DisplayObject>} children
 * @memberof runeos.display.DisplayObjectContainer
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.display.DisplayObjectContainer.prototype, "children", {
    /**
     * @this runeos.display.DisplayObjectContainer
     * @returns {Array.<runeos.display.DisplayObject>}
     * @ignore
     */
    get : function() {
        return this.m_children;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Adds a display object if it is not already present.
 *
 * @param {runeos.display.DisplayObject} child Child display object.
 *
 * @returns {runeos.display.DisplayObject}
 */
runeos.display.DisplayObjectContainer.prototype.addChild = function(child) {
    if (child instanceof runeos.display.DisplayObject) {
        if (child != this) {
            if (this.m_children.indexOf(child) !== -1) {
                return child;
            }
            this.m_children.push(child);
        } else throw new Error();
    } else throw new TypeError();

    return child;
};

/**
 * Removes a display object from the child list.
 *
 * @param {runeos.display.DisplayObject} child Child display object.
 *
 * @returns {runeos.display.DisplayObject}
 */
runeos.display.DisplayObjectContainer.prototype.removeChild = function(child) {
    var index = this.m_children.indexOf(child);
    if (index !== -1) {
        this.m_children.splice(index, 1);
    }
    return child;
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Renders the current contents of the object.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.display.DisplayObjectContainer.prototype.render = function() {
    runeos.display.DisplayObject.prototype.render.call(this);
    this.m_renderChildren();
};

/**
 * Updates the object for the current frame.
 *
 * @param {number} step Current time step.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.display.DisplayObjectContainer.prototype.update = function(step) {
    for (var i = 0; i < this.m_children.length; i++) {
        this.m_children[i].update(step);
    }
};

/**
 * Releases references and resources owned by the object.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.display.DisplayObjectContainer.prototype.dispose = function() {
    for (var i = 0; i < this.m_children.length; i++) {
        this.m_children[i].dispose();
    }
    this.m_children.length = 0;
    runeos.display.DisplayObject.prototype.dispose.call(this);
};

//------------------------------------------------------------------------------
// Protected prototype methods
//------------------------------------------------------------------------------

/**
 * Renders children in insertion order into the container pixel buffer.
 *
 * @returns {undefined}
 * @protected
 * @ignore
 */
runeos.display.DisplayObjectContainer.prototype.m_renderChildren = function() {
    for (var i = 0; i < this.m_children.length; i++) {
        this["canvas"].renderDisplayObject(this.m_children[i]);
    }
};
