//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates the inactivity controller for one hosted game.
 *
 * @constructor
 * @param {Object} config Idle delay and warning duration supplied by the scene.
 * @param {runeos.input.Activity} activity Passive input and focus measurement.
 *
 * @class
 * @classdesc
 * Applies inactivity warning and expiry rules to an injected input measurement.
 */
runeos.application.ApplicationIdle = function(config, activity) {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Explicit inactivity settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = config;

    /**
     * Injected input measurement; owns subscriptions for this game session.
     *
     * @type {runeos.input.Activity}
     * @private
     */
    this.m_activity = activity;

    /**
     * Elapsed warning time, or null before warning.
     *
     * @type {?number}
     * @private
     */
    this.m_warningElapsed = null;

    /**
     * Whether input measurement has started.
     *
     * @type {boolean}
     * @private
     */
    this.m_started = false;

};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whole seconds remaining in the warning; zero before warning or after expiry.
 *
 * @member {number} remaining
 * @memberof runeos.application.ApplicationIdle
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.application.ApplicationIdle.prototype, "remaining", {
    /**
     * @this runeos.application.ApplicationIdle
     * @returns {number}
     * @ignore
     */
    get: function() { return this.m_warningElapsed === null ? 0 : Math.max(0, Math.ceil((this.m_config.warningMs - this.m_warningElapsed) / 1000)); }
});

/**
 * Whether the warning interval has elapsed without activity.
 *
 * @member {boolean} expired
 * @memberof runeos.application.ApplicationIdle
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.application.ApplicationIdle.prototype, "expired", {
    /**
     * @this runeos.application.ApplicationIdle
     * @returns {boolean}
     * @ignore
     */
    get: function() { return this.m_warningElapsed !== null && this.m_warningElapsed >= this.m_config.warningMs; }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Subscribes before game code can consume native keyboard events.
 *
 * @returns {undefined}
 */
runeos.application.ApplicationIdle.prototype.start = function() {
    if (this.m_started || !this.m_config.enabled) return;
    this.m_started = true;
    this.m_activity.start();
};

/**
 * Starts a new idle interval after successful game startup.
 *
 * @returns {undefined}
 */
runeos.application.ApplicationIdle.prototype.reset = function() {
    this.m_activity.reset();
    this.m_warningElapsed = null;
};

/**
 * Samples passive input and advances the warning only while the game is focused.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {boolean}
 */
runeos.application.ApplicationIdle.prototype.update = function(step) {
    if (!this.m_started) return false;

    this.m_activity.update(step);
    this.m_updateWarning(step);

    return this.expired;
};

/**
 * Stops measurement and releases every input subscription.
 *
 * @returns {undefined}
 */
runeos.application.ApplicationIdle.prototype.dispose = function() {
    this.m_started = false;
    this.m_activity.dispose();
    this.m_warningElapsed = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Applies warning timing to the latest activity and focus measurements.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ApplicationIdle.prototype.m_updateWarning = function(step) {
    if (this.m_activity.active || !this.m_activity.focused) {
        this.m_warningElapsed = null;
    } else if (this.m_warningElapsed === null) {
        if (this.m_activity.elapsed >= this.m_config.delayMs) this.m_warningElapsed = 0;
    } else if (typeof step === "number" && isFinite(step) && step > 0) {
        this.m_warningElapsed += step;
    }

};
