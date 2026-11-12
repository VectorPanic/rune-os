//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new instance of Tween.
 *
 * @constructor
 *
 * @param {Object} options Tween object settings.
 *
 * @class
 * @classdesc
 *
 * The Tween class represents a linear interpolation between a beginning and
 * ending value.
 */
runeos.tween.Tween = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    /**
     * @ignore
     */
    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * The length of the animation, in milliseconds. Defaults to 250.
     *
     * @type {number}
     * @private
     */
    this.m_duration = 0;

    /**
     * The easing behavior for this effect
     *
     * @type {Function}
     * @private
     */
    this.m_easing = options.transition || options.easing || runeos.tween.Sine.easeInOut;
    if (typeof this.m_easing !== "function") throw new TypeError("Invalid tween easing.");

    /**
     * Callback method.
     *
     * @type {Function}
     * @private
     */
    this.m_onDispose = options.onDispose || null;

    /**
     * Callback method.
     *
     * @type {Function}
     * @private
     */
    this.m_onInit = options.onInit || null;

    /**
     * Callback method.
     *
     * @type {Function}
     * @private
     */
    this.m_onUpdate = options.onUpdate || null;

    /**
     * If the animation is currently playing.
     *
     * @type {boolean}
     * @private
     */
    this.m_running = true;

    /**
     * Whether the animation reached its final values.
     *
     * @type {boolean}
     * @private
     */
    this.m_finished = false;

    /**
     * Scope for callback methods.
     *
     * @type {Object}
     * @private
     */
    this.m_scope = options.scope || this;

    /**
     * Elapsed animation time in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_elapsed = 0;

    /**
     * Object to animate.
     *
     * @type {Object}
     * @private
     */
    this.m_target = options.target || null;
    if (this.m_target === null || (typeof this.m_target !== "object" &&
        typeof this.m_target !== "function")) {
        throw new TypeError("A tween requires a target object.");
    }

    /**
     * Values to animate.
     *
     * @type {Array.<runeos.tween.TweenValue>}
     * @private
     */
    this.m_values = [];

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Prepares the duration and interpolation values.
     */
    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether the animation has reached its final values.
 * Completed animations are automatically removed by the handler.
 *
 * @member {boolean} complete
 * @memberof runeos.tween.Tween
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.tween.Tween.prototype, "complete", {
    /**
     * @this runeos.tween.Tween
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_finished;
    }
});

/**
 * The progression of the animation from zero to one.
 *
 * @member {number} progress
 * @memberof runeos.tween.Tween
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.tween.Tween.prototype, "progress", {
    /**
     * @this runeos.tween.Tween
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_duration === 0 ? 1 : Math.min(this.m_elapsed / this.m_duration, 1);
    }
});

/**
 * Object that is animated.
 *
 * @member {Object} target
 * @memberof runeos.tween.Tween
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.tween.Tween.prototype, "target", {
    /**
     * @this runeos.tween.Tween
     * @returns {Object}
     * @ignore
     */
    get : function() {
        return this.m_target;
    }
});

//------------------------------------------------------------------------------
// Internal prototype methods
//------------------------------------------------------------------------------

/**
 * Called by the manager when the animation is initiated.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.tween.Tween.prototype.init = function() {
    if (!this.m_finished && typeof this.m_onInit === "function") {
        this.m_onInit.call(this.m_scope, this.m_target, this);
    }
};

/**
 * Called by the manager when the animation is updated.
 *
 * @param {number} step Current time step.
 *
 * @returns {boolean} Whether the animation is complete.
 * @ignore
 */
runeos.tween.Tween.prototype.update = function(step) {
    if (!this.m_running || this.m_finished) return this.m_finished;
    step = this.m_parseStep(step);
    if (step === 0 && this.m_duration > 0) return false;

    this.m_elapsed = Math.min(this.m_elapsed + step, this.m_duration);
    this.m_finished = this.m_elapsed >= this.m_duration;
    this.m_updateValues();
    if (typeof this.m_onUpdate === "function") {
        this.m_onUpdate.call(this.m_scope, this.m_target, this);
    }
    return this.m_finished;
};

/**
 * Called by the manager when the animation is completed. The call is made
 * before the animation is removed from the handler.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.tween.Tween.prototype.dispose = function() {
    if (!this.m_running) return;
    this.m_running = false;
    var target = this.m_target;
    var callback = this.m_finished ? this.m_onDispose : null;
    var scope = this.m_scope;
    this.m_values = null;
    this.m_target = null;
    this.m_scope = null;
    this.m_onInit = null;
    this.m_onUpdate = null;
    this.m_onDispose = null;
    if (typeof callback === "function") callback.call(scope, target, this);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Runs the initialization steps owned by this instance.
 *
 * @param {Object} options Constructor settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.tween.Tween.prototype.m_construct = function(options) {
    this.m_duration = this.m_parseDuration(options['duration']);
    this.m_values = this.m_createTweenValues(options['args'] || {});
};

/**
 * Updates the properties to be interpolated / animated.
 *
 * @returns {undefined}
 * @private
 */
runeos.tween.Tween.prototype.m_updateValues = function() {
    for (var i = 0; i < this.m_values.length; i++) {
        if (this.m_finished) {
            this.m_target[this.m_values[i]['name']] = this.m_values[i]['end'];
        } else {
            this.m_target[this.m_values[i]['name']] = this.m_easing(
                this.m_elapsed,
                this.m_values[i]['start'],
                this.m_values[i]['delta'],
                this.m_duration
            );
        }
    }
};

/**
 * Parses the animation duration.
 *
 * @param {*} value Value to parse.
 *
 * @returns {number}
 * @private
 */
runeos.tween.Tween.prototype.m_parseDuration = function(value) {
    if (typeof value === "number" && isFinite(value)) {
        return Math.max(value, 0);
    }

    return 250;
};

/**
 * Parses the update time step.
 *
 * @param {*} value Value to parse.
 *
 * @returns {number}
 * @private
 */
runeos.tween.Tween.prototype.m_parseStep = function(value) {
    if (typeof value === "number" && isFinite(value)) {
        return Math.max(value, 0);
    }

    return 0;
};

/**
 * Creates a TweenValue object for each argument to be interpolated.
 *
 * @param {Object} args Objects containing properties to interpolate.
 *
 * @returns {Array.<runeos.tween.TweenValue>}
 * @private
 */
runeos.tween.Tween.prototype.m_createTweenValues = function(args) {
    var values = [];
    if (args != null && this.m_target != null) {
        for (var arg in args) {
            if (
                Object.prototype.hasOwnProperty.call(args, arg) &&
                    arg !== "__proto__" && arg !== "constructor" && arg !== "prototype" &&
                    arg in this.m_target &&
                    this.m_isValidTweenValue(this.m_target[arg]) &&
                    this.m_isValidTweenValue(args[arg])
            ) {
                var value = new runeos.tween.TweenValue(
                    arg,
                    this.m_target[arg],
                    args[arg]
                );

                values.push(value);
            }
        }
    }

    return values;
};

/**
 * Validates a value to be interpolated.
 *
 * @param {*} value Value to validate.
 *
 * @returns {boolean}
 * @private
 */
runeos.tween.Tween.prototype.m_isValidTweenValue = function(value) {
    return typeof value === "number" && isFinite(value);
};
