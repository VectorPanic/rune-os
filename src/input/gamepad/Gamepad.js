//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Gamepad instance.
 *
 * @constructor
 *
 * @param {Object} [options] Optional input configuration.
 *
 * @class
 * @classdesc
 *
 * Snapshots buttons and the right stick without retaining native Gamepad
 * objects.
 * Newly connected or resumed devices require release before a held input
 * triggers.
 */
runeos.input.Gamepad = function(options) {
    options = options || {};
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable input settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("input", options.config);

    /**
     * Current button states.
     *
     * @type {Array.<boolean>}
     * @private
     */
    this.m_buttons = [];

    /**
     * Previous button states.
     *
     * @type {Array.<boolean>}
     * @private
     */
    this.m_previousButtons = [];

    /**
     * Right-stick directions: left, right, up, down.
     *
     * @type {Array.<boolean>}
     * @private
     */
    this.m_stick = [false, false, false, false];

    /**
     * Previous right-stick directions.
     *
     * @type {Array.<boolean>}
     * @private
     */
    this.m_previousStick = [false, false, false, false];

    /**
     * Combined stick and D-pad directions.
     *
     * @type {Array.<boolean>}
     * @private
     */
    this.m_navigation = [false, false, false, false];

    /**
     * Previous combined navigation directions.
     *
     * @type {Array.<boolean>}
     * @private
     */
    this.m_previousNavigation = [false, false, false, false];

    /**
     * Whether the current device is connected.
     *
     * @type {boolean}
     * @private
     */
    this.m_connected = false;

    /**
     * Any sampled button or stick activity, independent of navigation mapping.
     *
     * @type {boolean}
     * @private
     */
    this.m_active = false;

    /**
     * Native device identifier.
     *
     * @type {string}
     * @private
     */
    this.m_id = "";

    /**
     * Native device slot.
     *
     * @type {number}
     * @private
     */
    this.m_index = -1;

    /**
     * Whether the next sample establishes a baseline without press edges.
     *
     * @type {boolean}
     * @private
     */
    this.m_prime = true;
};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Shared navigation order used by controller sampling and Launcher.
 *
 * @type {Array.<string>}
 * @const
 */
runeos.input.Gamepad.DIRECTIONS = ["LEFT", "RIGHT", "UP", "DOWN"];

/**
 * A button index in the standard browser mapping.
 *
 * @type {number}
 * @const
 */
runeos.input.Gamepad.A = 0;

/**
 * Select / Back / View button index in the standard browser mapping.
 *
 * @type {number}
 * @const
 */
runeos.input.Gamepad.SELECT = 8;

/**
 * START button index in the standard browser mapping.
 *
 * @type {number}
 * @const
 */
runeos.input.Gamepad.START = 9;

/**
 * UP button index in the standard browser mapping.
 *
 * @type {number}
 * @const
 */
runeos.input.Gamepad.UP = 12;

/**
 * DOWN button index in the standard browser mapping.
 *
 * @type {number}
 * @const
 */
runeos.input.Gamepad.DOWN = 13;

/**
 * LEFT button index in the standard browser mapping.
 *
 * @type {number}
 * @const
 */
runeos.input.Gamepad.LEFT = 14;

/**
 * RIGHT button index in the standard browser mapping.
 *
 * @type {number}
 * @const
 */
runeos.input.Gamepad.RIGHT = 15;

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Reads either a standard button snapshot or a legacy numeric button value.
 *
 * @param {*} button Browser button snapshot.
 * @param {number} [threshold] Optional analog activation threshold.
 *
 * @returns {boolean} Whether the button is held.
 */
runeos.input.Gamepad.isButtonPressed = function(button, threshold) {
    threshold = threshold === undefined ? runeos.system.Config.getGroup("input").buttonThreshold : threshold;
    return typeof button === "number" ? button >= threshold :
    Boolean(button && (button.pressed || button.value >= threshold));
};

/**
 * Checks raw controller activity using the existing button and stick thresholds.
 *
 * @param {Gamepad} state Browser controller snapshot.
 * @param {Object} config Input settings.
 *
 * @returns {boolean} Whether any button or stick is active.
 */
runeos.input.Gamepad.isActive = function(state, config) {
    if (!state || state.connected === false) return false;
    var buttons = state.buttons || [];
    for (var i = 0; i < buttons.length; i++) {
        if (runeos.input.Gamepad.isButtonPressed(buttons[i], config.buttonThreshold)) return true;
    }
    var axes = state.axes || [];
    for (var a = 0; a < axes.length; a++) {
        if (typeof axes[a] === "number" && isFinite(axes[a]) && Math.abs(axes[a]) >= config.stickEngage) return true;
    }
    return false;
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether sampled input is held or newly pressed.
 *
 * @member {boolean} active
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "active", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_connected && this.m_active;
    }
});

/**
 * Current device connected.
 *
 * @member {boolean} connected
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "connected", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_connected;
    }
});

/**
 * Current device id.
 *
 * @member {string} id
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "id", {
    /**
     * @this runeos.input.Gamepad
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_id;
    }
});

/**
 * Current device index.
 *
 * @member {number} index
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "index", {
    /**
     * @this runeos.input.Gamepad
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_index;
    }
});

/**
 * Whether the right stick is held left.
 *
 * @member {boolean} stickRightLeft
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "stickRightLeft", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_stick[0];
    }
});

/**
 * Whether the right stick just moved left.
 *
 * @member {boolean} stickRightJustLeft
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "stickRightJustLeft", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_stick[0] && !this.m_previousStick[0];
    }
});

/**
 * Whether the right stick is held right.
 *
 * @member {boolean} stickRightRight
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "stickRightRight", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_stick[1];
    }
});

/**
 * Whether the right stick just moved right.
 *
 * @member {boolean} stickRightJustRight
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "stickRightJustRight", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_stick[1] && !this.m_previousStick[1];
    }
});

/**
 * Whether the right stick is held up.
 *
 * @member {boolean} stickRightUp
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "stickRightUp", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_stick[2];
    }
});

/**
 * Whether the right stick just moved up.
 *
 * @member {boolean} stickRightJustUp
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "stickRightJustUp", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_stick[2] && !this.m_previousStick[2];
    }
});

/**
 * Whether the right stick is held down.
 *
 * @member {boolean} stickRightDown
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "stickRightDown", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_stick[3];
    }
});

/**
 * Whether the right stick just moved down.
 *
 * @member {boolean} stickRightJustDown
 * @memberof runeos.input.Gamepad
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepad.prototype, "stickRightJustDown", {
    /**
     * @this runeos.input.Gamepad
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_stick[3] && !this.m_previousStick[3];
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Reads the sampled button pressed state.
 *
 * @param {number} button Standard browser button index.
 *
 * @returns {boolean}
 */
runeos.input.Gamepad.prototype.pressed = function(button) {
    return this.m_buttons[button] === true;
};

/**
 * Reads the sampled button justPressed state.
 *
 * @param {number} button Standard browser button index.
 *
 * @returns {boolean}
 */
runeos.input.Gamepad.prototype.justPressed = function(button) {
    return this.m_buttons[button] === true && this.m_previousButtons[button] !== true;
};

/**
 * Reads the sampled button justReleased state.
 *
 * @param {number} button Standard browser button index.
 *
 * @returns {boolean}
 */
runeos.input.Gamepad.prototype.justReleased = function(button) {
    return this.m_previousButtons[button] === true && this.m_buttons[button] !== true;
};

/**
 * Checks a combined D-pad/right-stick direction without duplicate source edges.
 *
 * @param {string} direction LEFT, RIGHT, UP or DOWN.
 *
 * @returns {boolean}
 */
runeos.input.Gamepad.prototype.directionJustPressed = function(direction) {
    var index = runeos.input.Gamepad.DIRECTIONS.indexOf(direction);
    return index !== -1 && this.m_navigation[index] && !this.m_previousNavigation[index];
};

/**
 * Clears sampled state and requires a fresh baseline before generating edges.
 *
 * @returns {undefined}
 */
runeos.input.Gamepad.prototype.reset = function() {
    this.m_buttons.length = 0;
    this.m_previousButtons.length = 0;
    for (var i = 0; i < 4; i++) {
        this.m_previousStick[i] = false;
        this.m_stick[i] = false;
        this.m_previousNavigation[i] = false;
        this.m_navigation[i] = false;
    }
    this.m_connected = false;
    this.m_active = false;
    this.m_id = "";
    this.m_index = -1;
    this.m_prime = true;
};

/**
 * Samples primitive values once, including browsers that mutate Gamepad objects
 * in place.
 *
 * @param {Gamepad} state Browser gamepad snapshot, or null.
 *
 * @returns {undefined}
 */
runeos.input.Gamepad.prototype.update = function(state) {
    if (!state || state.connected === false) {
        this.reset();
        return;
    }
    if (!this.m_connected || this.m_id !== (state.id || "")) this.reset();
    this.m_connected = true;
    this.m_active = runeos.input.Gamepad.isActive(state, this.m_config);
    this.m_id = state.id || "";
    this.m_index = state.index;
    var buttons = state.buttons || [];
    var count = Math.max(buttons.length, this.m_buttons.length);
    for (var i = 0; i < count; i++) {
        this.m_previousButtons[i] = this.m_buttons[i] === true;
        var button = buttons[i];
        this.m_buttons[i] = runeos.input.Gamepad.isButtonPressed(button, this.m_config.buttonThreshold);
        if (this.m_prime) this.m_previousButtons[i] = this.m_buttons[i];
    }
    var axes = state.axes || [];
    var axis = this.m_config.navigationStick === "left" ? 0 : 2;
    var x = typeof axes[axis] === "number" && isFinite(axes[axis]) ? axes[axis] : 0;
    var y = typeof axes[axis + 1] === "number" && isFinite(axes[axis + 1]) ? axes[axis + 1] : 0;
    this.m_sampleDirection(0, -x, 14);
    this.m_sampleDirection(1, x, 15);
    this.m_sampleDirection(2, -y, 12);
    this.m_sampleDirection(3, y, 13);
    this.m_prime = false;
};

/**
 * Releases device state. Native devices are never retained.
 *
 * @returns {undefined}
 */
runeos.input.Gamepad.prototype.dispose = function() {
    this.reset();
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Applies configured stick engagement and release hysteresis.
 *
 * @param {number} index Direction slot.
 * @param {number} value Signed axis value towards this direction.
 * @param {number} button Matching D-pad button.
 *
 * @returns {undefined}
 * @private
 */
runeos.input.Gamepad.prototype.m_sampleDirection = function(index, value, button) {
    this.m_previousStick[index] = this.m_stick[index];
    this.m_previousNavigation[index] = this.m_navigation[index];
    this.m_stick[index] = value >= (this.m_stick[index] ? this.m_config.stickRelease : this.m_config.stickEngage);
    this.m_navigation[index] = this.m_stick[index] || this.pressed(button);
    if (this.m_prime) {
        this.m_previousStick[index] = this.m_stick[index];
        this.m_previousNavigation[index] = this.m_navigation[index];
    }
};
