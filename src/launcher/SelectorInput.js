//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new SelectorInput instance.
 *
 * @constructor
 *
 * @param {Object} config Selector timing settings.
 *
 * @class
 * @classdesc
 *
 * Translates sampled input into one selector command per frame. Refresh takes
 * precedence over launch, then fresh directions take precedence over repeats.
 * Owns repeat timing without changing scenes, tiles or device state.
 */
runeos.launcher.SelectorInput = function(config) {
    
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Borrowed selector timing settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = config;

    /**
     * Direction armed by the latest fresh navigation press.
     *
     * @type {?string}
     * @private
     */
    this.m_direction = null;

    /**
     * Remaining time before the next navigation hop, in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_remaining = 0;
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Cancels repetition. Resuming requires a fresh directional press.
 *
 * @returns {undefined}
 */
runeos.launcher.SelectorInput.prototype.reset = function() {
    this.m_direction = null;
    this.m_remaining = 0;
};

/**
 * Reads commands only while the selector accepts input.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 * @param {runeos.input.Keyboard} keyboard Sampled keyboard.
 * @param {?runeos.input.Gamepads} gamepads Optional sampled controllers.
 *
 * @returns {?string} refresh, launch, a direction, or null.
 */
runeos.launcher.SelectorInput.prototype.read = function(step, keyboard, gamepads) {
    var action = this.m_readAction(step, keyboard, gamepads);
    if (action) {
        this.reset();
        return action;
    }
    
    var direction = this.m_readDirection(keyboard, gamepads);
    if (direction) {
        this.m_direction = direction;
        this.m_remaining = this.m_config.navigationRepeatDelayMs;
        return direction;
    }
    
    return this.m_readRepeat(step, keyboard, gamepads);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Reads selector shortcuts in their established priority order.
 *
 * @param {number} step Elapsed frame time.
 * @param {runeos.input.Keyboard} keyboard Sampled keyboard.
 * @param {?runeos.input.Gamepads} gamepads Optional controllers.
 *
 * @returns {?string}
 * @private
 */
runeos.launcher.SelectorInput.prototype.m_readAction = function(step, keyboard, gamepads) {
    if (keyboard.justPressed("F5") || (gamepads && gamepads.justHeld &&
        gamepads.justHeld(runeos.input.Gamepad.SELECT, this.m_config.refreshHoldMs, step))) return "refresh";
    if (keyboard.justPressed("ENTER") || (gamepads &&
        (gamepads.justPressed(runeos.input.Gamepad.A) || gamepads.justPressed(runeos.input.Gamepad.START)))) return "launch";
    
    return null;
};

/**
 * Selects one fresh direction using the shared controller navigation order.
 *
 * @param {runeos.input.Keyboard} keyboard Sampled keyboard.
 * @param {?runeos.input.Gamepads} gamepads Optional controllers.
 *
 * @returns {?string}
 * @private
 */
runeos.launcher.SelectorInput.prototype.m_readDirection = function(keyboard, gamepads) {
    var directions = runeos.input.Gamepad.DIRECTIONS;
    for (var i = 0; i < directions.length; i++) {
        if (keyboard.justPressed(directions[i]) ||
            (gamepads && gamepads.directionJustPressed(directions[i]))) return directions[i];
    }
    
    return null;
};

/**
 * Repeats an armed direction while either device holds it. Slow frames emit
 * only one hop and never accumulate a burst of delayed navigation commands.
 *
 * @param {number} step Elapsed frame time.
 * @param {runeos.input.Keyboard} keyboard Sampled keyboard.
 * @param {?runeos.input.Gamepads} gamepads Optional controllers.
 *
 * @returns {?string}
 * @private
 */
runeos.launcher.SelectorInput.prototype.m_readRepeat = function(step, keyboard, gamepads) {
    if (!this.m_direction) return null;
    if (!keyboard.pressed(this.m_direction) &&
        (!gamepads || !gamepads.directionPressed(this.m_direction))) {
        this.reset();
        return null;
    }
    
    this.m_remaining -= Math.max(0, step);
    if (this.m_remaining > 0) return null;
    this.m_remaining = this.m_config.navigationRepeatIntervalMs;
    return this.m_direction;
};
