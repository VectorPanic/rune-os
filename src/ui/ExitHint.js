//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ExitHint instance after a successful game start.
 *
 * @constructor
 * @param {Object} config Notification text, opacity and timing settings.
 * @param {number} bodySize Logical body font size.
 *
 * @class
 * @classdesc
 *
 * Owns exit-reminder timing; GameMessage handles readable rendering and pixel restoration.
 * Receives settings explicitly and never reads input or controls game execution.
 */
runeos.ui.ExitHint = function(config, bodySize) {
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Borrowed notification settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = config;

    /**
     * Logical body font size.
     *
     * @type {number}
     * @private
     */
    this.m_bodySize = bodySize;

    /**
     * Owned reminder presentation.
     *
     * @type {runeos.ui.GameMessage}
     * @private
     */
    this.m_message = null;

    /**
     * Elapsed visible reminder time; negative after dismissal.
     *
     * @type {number}
     * @private
     */
    this.m_elapsed = 0;

};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether a reminder owns display resources.
 *
 * @member {boolean} visible
 * @memberof runeos.ui.ExitHint
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.ExitHint.prototype, "visible", {
    /**
     * @this runeos.ui.ExitHint
     * @returns {boolean}
     * @ignore
     */
    get: function() { return this.m_message !== null && this.m_message.visible; }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Restores the game pixels before the next frame or overlay is drawn.
 *
 * @returns {undefined}
 */
runeos.ui.ExitHint.prototype.restore = function() {
    if (this.m_message) this.m_message.restore();
};

/**
 * Advances visible time and dismisses the reminder on timeout or exit input.
 *
 * @param {number} step Elapsed frame time.
 * @param {boolean} dismiss Whether the scene has detected exit input.
 *
 * @returns {undefined}
 */
runeos.ui.ExitHint.prototype.update = function(step, dismiss) {
    if (!this.m_message || !this.m_message.visible) return;
    var config = this.m_config;
    if (typeof step === "number" && isFinite(step)) this.m_elapsed += Math.max(0, step);
    if (this.m_elapsed >= config.fadeInMs + config.exitHintHoldMs + config.fadeOutMs || dismiss) {
        this.dispose();
    }
};

/**
 * Draws the reminder over the game frame without capturing input.
 *
 * @param {runeos.display.Canvas} canvas Shared game output.
 *
 * @returns {undefined}
 */
runeos.ui.ExitHint.prototype.render = function(canvas) {
    if (this.m_elapsed < 0 || canvas.width <= 0 || canvas.height <= 0) return;
    var config = this.m_config;
    if (!config.exitHint || config.exitHintHoldMs <= 0) return;
    if (!this.m_message) {
        this.m_message = new runeos.ui.GameMessage(config, this.m_bodySize);
        this.m_message.show(config.exitHint);
    }
    var end = config.fadeInMs + config.exitHintHoldMs + config.fadeOutMs;
    var opacity = Math.max(0, Math.min(1, this.m_elapsed / Math.max(1, config.fadeInMs),
        (end - this.m_elapsed) / Math.max(1, config.fadeOutMs)));
    this.m_message.render(canvas, opacity);
};

/**
 * Restores pixels and releases the reminder permanently.
 *
 * @returns {undefined}
 */
runeos.ui.ExitHint.prototype.dispose = function() {
    if (this.m_message) this.m_message.dispose();
    this.m_message = null;
    this.m_elapsed = -1;
};
