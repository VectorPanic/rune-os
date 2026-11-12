//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Inputs instance.
 *
 * @constructor
 *
 * @param {Object} options Input settings. Keyboard input is enabled unless useKeyboard is false.
 *
 * @class
 * @classdesc
 *
 * The Inputs class manages the input devices used by OS scenes. Keyboard and
 * all connected gamepads are supported.
 */
runeos.input.Inputs = function(options) {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Settings used to construct the input subsystem.
     *
     * @type {Object}
     * @private
     */
    this.m_options = options || {};

    /**
     * Immutable input defaults shared with keyboard and controller setup.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("input", this.m_options.config);

    /**
     * Keyboard input subsystem.
     *
     * @type {runeos.input.Keyboard}
     * @private
     */
    this.m_keyboard = null;

    /**
     * Connected controller snapshots and aggregated navigation input.
     *
     * @type {runeos.input.Gamepads}
     * @private
     */
    this.m_gamepads = null;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Constructs the configured input devices.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Returns the keyboard associated with this instance.
 *
 * @member {runeos.input.Keyboard} keyboard
 * @memberof runeos.input.Inputs
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Inputs.prototype, "keyboard", {
    /**
     * @this runeos.input.Inputs
     * @returns {runeos.input.Keyboard}
     * @ignore
     */
    get : function() {
        return this.m_keyboard;
    }
});

/**
 * All connected gamepads, queried individually or as one navigation source.
 *
 * @member {runeos.input.Gamepads} gamepads
 * @memberof runeos.input.Inputs
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Inputs.prototype, "gamepads", {
    /**
     * @this runeos.input.Inputs
     * @returns {runeos.input.Gamepads}
     * @ignore
     */
    get : function() {
        return this.m_gamepads;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Resets held state and pending input transitions.
 *
 * @returns {undefined}
 */
runeos.input.Inputs.prototype.reset = function() {
    if (this.m_gamepads) this.m_gamepads.reset();
    if (this.m_keyboard) {
        this.m_keyboard.reset();
    }
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Updates the object for the current frame.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.input.Inputs.prototype.update = function() {
    if (this.m_gamepads) this.m_gamepads.update();
    if (this.m_keyboard) {
        this.m_keyboard.update();
    }
};

/**
 * Releases references and resources owned by the object.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.input.Inputs.prototype.dispose = function() {
    if (this.m_gamepads) this.m_gamepads.dispose();
    this.m_gamepads = null;
    if (this.m_keyboard) {
        this.m_keyboard.dispose();
    }
    this.m_keyboard = null;
};

//------------------------------------------------------------------------------
// Protected prototype methods
//------------------------------------------------------------------------------

/**
 * Creates the keyboard input subsystem.
 *
 * @returns {undefined}
 * @protected
 * @ignore
 */
runeos.input.Inputs.prototype.m_constructKeyboard = function() {
    this.m_keyboard = new runeos.input.Keyboard({
        enable: this.m_options.useKeyboard === undefined ? this.m_config.useKeyboard : this.m_options.useKeyboard,
        target: this.m_options.target || window
    });
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Runs the initialization steps owned by this instance.
 *
 * @returns {undefined}
 * @private
 */
runeos.input.Inputs.prototype.m_construct = function() {
    this.m_gamepads = new runeos.input.Gamepads({
        enable: this.m_options.useGamepads === undefined ? this.m_config.useGamepads : this.m_options.useGamepads,
        config: this.m_config
    });
    this.m_constructKeyboard();
};

