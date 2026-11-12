//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ScreenDimmer instance.
 *
 * @constructor
 * @extends runeos.display.DisplayObject
 *
 * @param {Object} [options] Viewport dimensions, target opacity and fade duration.
 *
 * @class
 * @classdesc
 *
 * A black overlay fading toward a supplied dimmed state. Owns its visual
 * transition without knowing about inactivity, input, scenes or OS configuration.
 */
runeos.ui.ScreenDimmer = function(options) {
    options = options || {};

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    runeos.display.DisplayObject.call(this, 0, 0, options.width || 1280, options.height || 720);

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Target overlay opacity when dimmed.
     *
     * @type {number}
     * @private
     */
    this.m_opacity = options.opacity === undefined ? 0.5 : options.opacity;

    /**
     * Transition duration in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_duration = options.duration === undefined ? 500 : options.duration;

    /**
     * Requested visual state.
     *
     * @type {boolean}
     * @private
     */
    this.m_dimmed = false;

    /**
     * Owned fade driven by the display update chain.
     *
     * @type {runeos.tween.Tween}
     * @private
     */
    this.m_transition = null;

    /**
     * Whether resources have been permanently released.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Validates presentation settings and initializes the hidden overlay.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.ui.ScreenDimmer.prototype = Object.create(runeos.display.DisplayObject.prototype);
runeos.ui.ScreenDimmer.prototype.constructor = runeos.ui.ScreenDimmer;

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Changes the requested dimming state without restarting an unchanged fade.
 * Immediate changes also finish an in-progress fade toward the same state.
 *
 * @param {boolean} dimmed Whether to show the dimming overlay.
 * @param {boolean} [immediate=false] Apply the destination without fading.
 *
 * @returns {boolean} Whether the requested state changed.
 */
runeos.ui.ScreenDimmer.prototype.setDimmed = function(dimmed, immediate) {
    if (this.m_disposed) return false;
    if (typeof dimmed !== "boolean") throw new TypeError("Expected a dimmed state.");
    var changed = this.m_dimmed !== dimmed;
    if (!changed && !immediate) return false;
    this.m_dimmed = dimmed;
    this.m_cancelTransition();
    var alpha = dimmed ? this.m_opacity : 0;
    if (immediate || this.m_duration === 0 || this.alpha === alpha) {
        this.alpha = alpha;
        this.visible = alpha > 0;
    } else {
        this.visible = true;
        this.m_transition = new runeos.tween.Tween({
            target: this,
            args: {alpha: alpha},
            duration: this.m_duration,
            transition: runeos.tween.Linear.easeIn
        });
        this.m_transition.init();
    }
    return changed;
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Advances the visual fade, independently of the reason dimming was requested.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.ScreenDimmer.prototype.update = function(step) {
    if (this.m_disposed || !this.m_transition) return;
    if (this.m_transition.update(step)) this.m_cancelTransition();
    this.visible = this.alpha > 0;
};

/**
 * Stops the owned fade and releases the overlay buffer.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.ScreenDimmer.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_cancelTransition();
    this.alpha = 0;
    this.visible = false;
    runeos.display.DisplayObject.prototype.dispose.call(this);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Configures the overlay without consulting application or inactivity state.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.ScreenDimmer.prototype.m_construct = function() {
    if (typeof this.m_opacity !== "number" || !isFinite(this.m_opacity) ||
        this.m_opacity < 0 || this.m_opacity > 1 || typeof this.m_duration !== "number" ||
        !isFinite(this.m_duration) || this.m_duration < 0) {
        throw new TypeError("Invalid ScreenDimmer options.");
    }
    this.backgroundColor = "#000000";
    this.alpha = 0;
    this.visible = false;
};

/**
 * Releases a finished or replaced transition without affecting other animations.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.ScreenDimmer.prototype.m_cancelTransition = function() {
    if (this.m_transition) this.m_transition.dispose();
    this.m_transition = null;
};
