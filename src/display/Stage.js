//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Stage instance.
 *
 * @constructor
 * @extends runeos.display.DisplayObjectContainer
 *
 * @class
 * @classdesc
 *
 * Root display container rendered by the OS camera.
 */
runeos.display.Stage = function() {

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    /**
     * Extend DisplayObjectContainer.
     */
    runeos.display.DisplayObjectContainer.call(this);
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.display.Stage.prototype = Object.create(runeos.display.DisplayObjectContainer.prototype);
runeos.display.Stage.prototype.constructor = runeos.display.Stage;
