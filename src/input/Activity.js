//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Activity instance.
 *
 * @constructor
 *
 * @param {Object} [options] Event target, document, activity callback and optional gamepadConfig.
 *
 * @class
 * @classdesc
 *
 * Measures inactivity independently of presentation. Combines keyboard/gamepad
 * snapshots with pointer/key events and focus, without knowing scenes or UI.
 */
runeos.input.Activity = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Event source used only while measurement is started.
     *
     * @type {EventTarget}
     * @private
     */
    this.m_target = options.target || (typeof window !== "undefined" ? window : null);

    /**
     * Optional document providing visibility and focus state.
     *
     * @type {EventTarget}
     * @private
     */
    this.m_document = options.document || (typeof document !== "undefined" ? document : null);

    /**
     * Optional thresholds for polling native controllers while game input is isolated.
     *
     * @type {Object}
     * @private
     */
    this.m_gamepadConfig = options.gamepadConfig || null;

    /**
     * Caller-owned response to an activity event, such as cancelling a launch.
     *
     * @type {Function}
     * @private
     */
    this.m_onActivity = options.onActivity || null;

    /**
     * Owned event subscriptions.
     *
     * @type {runeos.util.EventBindings}
     * @private
     */
    this.m_events = new runeos.util.EventBindings();

    /**
     * Time since activity, in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_elapsed = 0;

    /**
     * Whether input was active during the latest sample.
     *
     * @type {boolean}
     * @private
     */
    this.m_active = false;

    /**
     * Event activity waiting to be included in the next frame sample.
     *
     * @type {boolean}
     * @private
     */
    this.m_pending = false;

    /**
     * Whether the document is visible and focused.
     *
     * @type {boolean}
     * @private
     */
    this.m_focused = true;

    /**
     * Whether elapsed time and input are currently being sampled.
     *
     * @type {boolean}
     * @private
     */
    this.m_enabled = false;

    /**
     * Permanent teardown flag.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    /**
     * Native keys held even when OS input snapshots are suspended by a game.
     *
     * @type {!Object}
     * @private
     */
    this.m_keys = Object.create(null);

    /**
     * Stable handler used for all activity subscriptions.
     *
     * @type {Function}
     * @private
     */
    this.m_handler = null;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Binds the event handler without subscribing before start.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Inactivity in milliseconds.
 *
 * @member {number} elapsed
 * @memberof runeos.input.Activity
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Activity.prototype, "elapsed", {
    /**
     * @this runeos.input.Activity
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_elapsed;
    }
});

/**
 * Input activity in the latest sample, including events between frames.
 *
 * @member {boolean} active
 * @memberof runeos.input.Activity
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Activity.prototype, "active", {
    /**
     * @this runeos.input.Activity
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_active;
    }
});

/**
 * Visibility/focus sampled by the activity model.
 *
 * @member {boolean} focused
 * @memberof runeos.input.Activity
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Activity.prototype, "focused", {
    /**
     * @this runeos.input.Activity
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_focused;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Starts a fresh interval and subscribes once to keyboard/pointer activity.
 *
 * @returns {undefined}
 */
runeos.input.Activity.prototype.start = function() {
    if (this.m_disposed || this.m_enabled) return;
    this.m_enabled = true;
    this.reset();
    this.m_updateFocus();
    this.m_bindEvents();
};

/**
 * Resets elapsed time without discarding a pending input event.
 *
 * @returns {undefined}
 */
runeos.input.Activity.prototype.reset = function() {
    this.m_elapsed = 0;
};

/**
 * Samples held input and consumes the pending event pulse once per frame.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 * @param {Object} [inputs] Keyboard/gamepad snapshot owners.
 *
 * @returns {undefined}
 */
runeos.input.Activity.prototype.update = function(step, inputs) {
    if (!this.m_enabled || this.m_disposed) return;
    this.m_updateFocus();
    inputs = inputs || {};
    var gamepadActive = this.m_gamepadActive();
    this.m_active = gamepadActive || this.m_pending || Object.keys(this.m_keys).length > 0 || !!(inputs.keyboard && inputs.keyboard.active) || !!(inputs.gamepads && inputs.gamepads.active);
    this.m_pending = false;
    if (this.m_active || !this.m_focused) this.reset();
    else if (typeof step === "number" && isFinite(step) && step > 0) this.m_elapsed += step;
};

/**
 * Stops measurement and releases every event subscription for reuse later.
 *
 * @returns {undefined}
 */
runeos.input.Activity.prototype.stop = function() {
    this.m_events.clear();
    this.m_enabled = false;
    this.m_pending = false;
    this.m_active = false;
    this.m_keys = Object.create(null);
    this.reset();
};

/**
 * Releases subscriptions and external references permanently.
 *
 * @returns {undefined}
 */
runeos.input.Activity.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.stop();
    this.m_disposed = true;
    this.m_events.dispose();
    this.m_handler = null;
    this.m_onActivity = null;
    this.m_document = null;
    this.m_target = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Samples connected native controllers when polling thresholds were supplied.
 *
 * @returns {boolean}
 * @private
 */
runeos.input.Activity.prototype.m_gamepadActive = function() {
    if (!this.m_gamepadConfig) return false;
    var states = runeos.input.Gamepad.getStates();

    for (var i = 0; i < states.length; i++) {
        if (runeos.input.Gamepad.isActive(states[i], this.m_gamepadConfig)) return true;
    }

    return false;
};

/**
 * Prepares the stable event handler and initial focus state.
 *
 * @returns {undefined}
 * @private
 */
runeos.input.Activity.prototype.m_construct = function() {
    this.m_handler = this.m_noteActivity.bind(this);
    this.m_updateFocus();
};

/**
 * Subscribes to input and focus events through one owned binding group.
 *
 * @returns {undefined}
 * @private
 */
runeos.input.Activity.prototype.m_bindEvents = function() {
    if (!this.m_target) return;
    this.m_events.add(this.m_target, "keydown", this.m_handler, true);
    this.m_events.add(this.m_target, "keyup", this.m_handler, true);
    var activity = this;
    ["pointermove", "pointerdown", "wheel", "focus", "blur"].forEach(function(type) {
        activity.m_events.add(activity.m_target, type, activity.m_handler);
    });
    if (this.m_document && typeof this.m_document.addEventListener === "function") {
        this.m_events.add(this.m_document, "visibilitychange", this.m_handler);
    }
};

/**
 * Records activity immediately and notifies the caller without consuming input.
 *
 * @param {Event} event Native keyboard/pointer event.
 *
 * @returns {undefined}
 * @private
 */
runeos.input.Activity.prototype.m_noteActivity = function(event) {
    if (!this.m_enabled || this.m_disposed) return;
    this.m_updateKeys(event);
    this.reset();
    this.m_pending = true;
    if (this.m_onActivity) this.m_onActivity(event);
};

/**
 * Tracks held native keys without consuming events or relying on key repeat.
 *
 * @param {Event} event Keyboard or focus event.
 *
 * @returns {undefined}
 * @private
 */
runeos.input.Activity.prototype.m_updateKeys = function(event) {
    var key = event.code || event.key || event.keyCode;
    if (event.type === "keydown" && key !== undefined) this.m_keys[key] = true;
    else if (event.type === "keyup") delete this.m_keys[key];
    else if (event.type === "blur" || event.type === "focus" || event.type === "visibilitychange") this.m_keys = Object.create(null);
};

/**
 * Centralizes document focus/visibility checks for all inactivity consumers.
 *
 * @returns {undefined}
 * @private
 */
runeos.input.Activity.prototype.m_updateFocus = function() {
    var doc = this.m_document;
    this.m_focused = !doc || (!doc.hidden && (typeof doc.hasFocus !== "function" || doc.hasFocus()));
};
