//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new TextScroll instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Tracks a seamless leftward text cycle with a pause and optional initial delay.
 * Accepts dimensions and timing only, without fonts, display objects or input.
 */
runeos.text.TextScroll = function() {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Elapsed cycle time, negative during the initial delay.
     *
     * @type {number}
     * @private
     */
    this.m_elapsed = 0;

    /**
     * Current leftward offset in pixels.
     *
     * @type {number}
     * @private
     */
    this.m_offset = 0;
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Current leftward translation of the first text copy.
 *
 * @member {number} offset
 * @memberof runeos.text.TextScroll
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.text.TextScroll.prototype, "offset", {
    /**
     * @this runeos.text.TextScroll
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_offset;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Restarts the reading pause with an optional additional initial delay.
 *
 * @param {number} [delay=0] Initial delay in milliseconds.
 *
 * @returns {undefined}
 */
runeos.text.TextScroll.prototype.restart = function(delay) {
    this.m_elapsed = typeof delay === "number" && isFinite(delay) ? -Math.max(0, delay) : 0;
    this.m_offset = 0;
};

/**
 * Advances a cycle. Fitting text or a disabled speed resets the offset. Invalid
 * time steps leave an active cycle unchanged. Dimensions use finite pixel values;
 * pause and gap use finite nonnegative values supplied by the caller.
 *
 * @param {number} step Elapsed milliseconds.
 * @param {number} textWidth Natural text width.
 * @param {number} fieldWidth Visible field width.
 * @param {number} speed Reading speed in pixels per second; zero disables it.
 * @param {number} pause Reading pause in milliseconds.
 * @param {number} gap Space between repeated copies in pixels.
 *
 * @returns {undefined}
 */
runeos.text.TextScroll.prototype.update = function(step, textWidth, fieldWidth, speed, pause, gap) {
    if (textWidth <= fieldWidth || typeof speed !== "number" || !isFinite(speed) || speed <= 0) {
        this.restart();
        return;
    }
    if (typeof step !== "number" || !isFinite(step) || step <= 0) return;
    var travel = (textWidth + gap) / speed * 1000;
    var cycle = pause + travel;
    this.m_elapsed = (this.m_elapsed + step) % cycle;
    this.m_offset = Math.max(0, this.m_elapsed - pause) * speed / 1000;
};
