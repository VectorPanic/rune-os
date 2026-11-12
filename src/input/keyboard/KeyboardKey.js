//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new KeyboardKey instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * The KeyboardKey class samples held state and pending key transitions once per
 * frame.
 */
runeos.input.KeyboardKey = function() {
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Physical held state received from keyboard events.
     *
     * @type {boolean}
     * @private
     */
    this.m_down = false;

    /**
     * Held state sampled for the current frame.
     *
     * @type {boolean}
     * @private
     */
    this.m_pressed = false;

    /**
     * Whether a press was sampled for the current frame.
     *
     * @type {boolean}
     * @private
     */
    this.m_justPressed = false;

    /**
     * Whether a release was sampled for the current frame.
     *
     * @type {boolean}
     * @private
     */
    this.m_justReleased = false;

    /**
     * Press received since the previous frame.
     *
     * @type {boolean}
     * @private
     */
    this.m_pendingPress = false;

    /**
     * Release received since the previous frame.
     *
     * @type {boolean}
     * @private
     */
    this.m_pendingRelease = false;
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Checks whether the key is held in the current frame.
 *
 * @returns {boolean}
 */
runeos.input.KeyboardKey.prototype.isPressed = function() {
    return this.m_pressed;
};

/**
 * Checks whether the key was pressed since the previous frame.
 *
 * @returns {boolean}
 */
runeos.input.KeyboardKey.prototype.isJustPressed = function() {
    return this.m_justPressed;
};

/**
 * Checks whether the key was released since the previous frame.
 *
 * @returns {boolean}
 */
runeos.input.KeyboardKey.prototype.isJustReleased = function() {
    return this.m_justReleased;
};

/**
 * Resets held state and pending input transitions.
 *
 * @returns {undefined}
 */
runeos.input.KeyboardKey.prototype.reset = function() {
    this.m_down = false;
    this.m_pressed = false;
    this.m_justPressed = false;
    this.m_justReleased = false;
    this.m_pendingPress = false;
    this.m_pendingRelease = false;
};

/**
 * Records a key press without treating browser repeat as a new press.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.input.KeyboardKey.prototype.onKeyDown = function() {
    if (!this.m_down) {
        this.m_pendingPress = true;
    }
    this.m_down = true;
};

/**
 * Records a key release.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.input.KeyboardKey.prototype.onKeyUp = function() {
    if (this.m_down) {
        this.m_pendingRelease = true;
    }
    this.m_down = false;
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
runeos.input.KeyboardKey.prototype.update = function() {
    this.m_pressed = this.m_down;
    this.m_justPressed = this.m_pendingPress;
    this.m_justReleased = this.m_pendingRelease;
    this.m_pendingPress = false;
    this.m_pendingRelease = false;
};
