//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Scene instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Base OS scene with a stage, scene-owned tweens and access to the shared
 * keyboard.
 */
runeos.scene.Scene = function() {

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Whether the OS camera renders this scene.
     *
     * @type {boolean}
     * @default true
     */
    this.renderToScreen = true;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Whether the base scene resources have been permanently released.
     * Separate from subclass shutdown flags, which may be set before cleanup.
     *
     * @type {boolean}
     * @private
     */
    this.m_sceneDisposed = false;

    /**
     * Root stage owned by this scene.
     *
     * @type {runeos.display.Stage}
     * @private
     */
    this.m_stage = null;

    /**
     * Animation handler owned by this scene. Inactive scenes are not advanced.
     *
     * @type {runeos.tween.Tweens}
     * @private
     */
    this.m_tweens = new runeos.tween.Tweens();

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Constructs the objects owned by this instance.
     */
    runeos.scene.Scene.prototype.m_construct.call(this);
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether final scene-resource cleanup has completed.
 *
 * @member {boolean} disposed
 * @memberof runeos.scene.Scene
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Scene.prototype, "disposed", {
    /**
     * @this runeos.scene.Scene
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_sceneDisposed;
    }
});

/**
 * Animation handler for this scene.
 *
 * @member {runeos.tween.Tweens} tweens
 * @memberof runeos.scene.Scene
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Scene.prototype, "tweens", {
    /**
     * @this runeos.scene.Scene
     * @returns {runeos.tween.Tweens}
     * @ignore
     */
    get : function() {
        return this.m_tweens;
    }
});

/**
 * Shared OS sound effects and music manager.
 *
 * @member {runeos.media.Sounds} sounds
 * @memberof runeos.scene.Scene
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Scene.prototype, "sounds", {
    /**
     * @this runeos.scene.Scene
     * @returns {runeos.media.Sounds}
     * @ignore
     */
    get : function() {
        return runeos.instance.sounds;
    }
});

/**
 * Shared controller manager with aggregate input from all connected devices.
 *
 * @member {runeos.input.Gamepads} gamepads
 * @memberof runeos.scene.Scene
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Scene.prototype, "gamepads", {
    /**
     * @this runeos.scene.Scene
     * @returns {runeos.input.Gamepads}
     * @ignore
     */
    get : function() {
        return runeos.instance.inputs.gamepads;
    }
});

/**
 * Reference to the shared OS keyboard manager.
 *
 * @member {runeos.input.Keyboard} keyboard
 * @memberof runeos.scene.Scene
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Scene.prototype, "keyboard", {
    /**
     * @this runeos.scene.Scene
     * @returns {runeos.input.Keyboard}
     * @ignore
     */
    get : function() {
        return runeos.instance.inputs.keyboard;
    }
});

/**
 * Root stage rendered by the OS camera.
 *
 * @member {runeos.display.Stage} stage
 * @memberof runeos.scene.Scene
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Scene.prototype, "stage", {
    /**
     * @this runeos.scene.Scene
     * @returns {runeos.display.Stage}
     * @ignore
     */
    get : function() {
        return this.m_stage;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Initializes the scene when selected; override to add scene-specific behavior.
 *
 * @param {runeos.scene.Scene} [previousScene] Scene whose teardown has completed.
 *
 * @returns {undefined}
 */
runeos.scene.Scene.prototype.init = function(previousScene) {
    if (this.m_sceneDisposed) throw new Error("Scene is disposed.");
};

/**
 * Completes departure immediately by default, retaining resources for reentry.
 * Override when animation or application shutdown must finish before activation.
 *
 * @param {Function} onStopped Called when the next scene may be activated.
 *
 * @returns {undefined}
 */
runeos.scene.Scene.prototype.leave = function(onStopped) {
    if (typeof onStopped === "function") onStopped();
};

/**
 * Updates display children using the current frame time.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {undefined}
 */
runeos.scene.Scene.prototype.update = function(step) {
    if (!this.m_sceneDisposed) this.m_stage.update(step);
};

/**
 * Draws final scene feedback directly into the shared output after its content.
 * Stage rendering remains owned by the OS camera; the default draws nothing.
 *
 * @param {runeos.display.Canvas} canvas Borrowed shared output canvas.
 *
 * @returns {undefined}
 */
runeos.scene.Scene.prototype.render = function(canvas) {

};

/**
 * Permanently releases owned tweens and display resources once. Subclasses
 * release their own resources before delegating here. Shared OS services and
 * other scene instances are not disposed. Completion is immediate by default;
 * asynchronous execution scenes may finish shutdown before calling this method.
 *
 * @param {Function} [onDisposed] Called after final resource cleanup.
 *
 * @returns {undefined}
 */
runeos.scene.Scene.prototype.dispose = function(onDisposed) {
    if (!this.m_sceneDisposed) {
        this.m_sceneDisposed = true;
        this.m_tweens.dispose();
        this.m_stage.dispose();
        this.m_tweens = null;
        this.m_stage = null;
    }
    if (typeof onDisposed === "function") onDisposed();
};

//------------------------------------------------------------------------------
// Protected prototype methods
//------------------------------------------------------------------------------

/**
 * Constructs the stage owned by this scene.
 *
 * @param {Object} [options] Optional subclass construction settings.
 *
 * @returns {undefined}
 * @protected
 */
runeos.scene.Scene.prototype.m_construct = function(options) {
    this.m_constructStage();
};


//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------
/**
 * Creates the root stage owned by this scene.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Scene.prototype.m_constructStage = function() {
    this.m_stage = new runeos.display.Stage();

};
