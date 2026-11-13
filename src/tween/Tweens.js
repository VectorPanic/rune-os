//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new instance of Tweens.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * The Tweens class represents a Tween-based animation handler. With Tweens,
 * it is possible to create and remove Tween objects that handle interpolation
 * of one or more properties of an object.
 */
runeos.tween.Tweens = function() {

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * If set to True, all Tween objects handled by this Tweens instance are
     * paused.
     *
     * @type {boolean}
     * @default false
     */
    this.paused = false;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * List of all active tween objects.
     *
     * @type {Array.<runeos.tween.Tween>}
     * @private
     */
    this.m_tweens = [];

    /**
     * Whether the handler has been disposed.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * The number of Tween objects handled by this instance. When a Tween is
 * completed, it is automatically removed.
 *
 * @member {number} length
 * @memberof runeos.tween.Tweens
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.tween.Tweens.prototype, "length", {
    /**
     * @this runeos.tween.Tweens
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_tweens != null ? this.m_tweens.length : 0;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Removes all Tween objects from this handler. Ongoing interpolations are
 * interrupted and thus will not be completed.
 *
 * @returns {undefined}
 */
runeos.tween.Tweens.prototype.clear = function() {
    this.m_disposeTweens();
};

/**
 * Creates a new Tween object based on the specified option object.
 *
 * @param {Object} options Tween options.
 *
 * @returns {runeos.tween.Tween}
 */
runeos.tween.Tweens.prototype.create = function(options) {
    if (this.m_disposed) throw new Error("Tweens is disposed.");
    var tween = new runeos.tween.Tween(options);
    return this.m_addTween(tween);
};

/**
 * Replaces the target's active tweens, starting from its current property
 * values.
 * Options are validated before existing animations are removed.
 *
 * @param {Object} options Tween settings, including target and destination args.
 *
 * @returns {runeos.tween.Tween} Replacement tween.
 */
runeos.tween.Tweens.prototype.replace = function(options) {
    if (this.m_disposed) throw new Error("Tweens is disposed.");
    var tween = new runeos.tween.Tween(options);
    this.removeFrom(tween["target"]);
    return this.m_addTween(tween);
};

/**
 * Removes a specific tween object based on the object reference.
 *
 * @param {runeos.tween.Tween} tween Tween object to remove.
 *
 * @returns {undefined}
 */
runeos.tween.Tweens.prototype.remove = function(tween) {
    this.m_disposeTween(tween);
};

/**
 * Removes all Tween objects registered to the specified target object.
 *
 * @param {Object} target Removes all Tween objects from this object.
 *
 * @returns {undefined}
 */
runeos.tween.Tweens.prototype.removeFrom = function(target) {
    var i = this.m_tweens.length;
    while (i--) {
        if (this.m_tweens[i]['target'] == target) {
            this.m_disposeTween(this.m_tweens[i]);
        }
    }
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Updates calculations for all registered interpolations. Note that this is
 * an internal process and should therefore not be called manually.
 *
 * @param {number} step The current time step.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.tween.Tweens.prototype.update = function(step) {
    if (this.paused === false && this.m_tweens != null) {
        this.m_updateTweens(step);
    }
};

/**
 * Prepares for removal of the object.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.tween.Tweens.prototype.dispose = function() {
    this.m_disposed = true;
    this.m_disposeTweens();
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Registers and initializes a validated tween, removing it if initialization
 * fails.
 *
 * @param {runeos.tween.Tween} tween Tween to register.
 *
 * @returns {runeos.tween.Tween} Initialized tween.
 * @private
 */
runeos.tween.Tweens.prototype.m_addTween = function(tween) {
    this.m_tweens.push(tween);
    try {
        tween.init();
    } catch (error) {
        this.m_disposeTween(tween);
        throw error;
    }
    return tween;
};

/**
 * Updates all Tween objects.
 *
 * @param {number} step The current time step.
 *
 * @returns {undefined}
 * @ignore
 * @private
 */
runeos.tween.Tweens.prototype.m_updateTweens = function(step) {
    if (this.m_tweens == null || this.m_tweens.length === 0) return;

    // Callbacks may remove, clear or create tweens. New tweens start next frame.
    var tweens = this.m_tweens.slice();
    for (var i = 0; i < tweens.length; i++) {
        var tween = tweens[i];
        if (this.m_tweens.indexOf(tween) !== -1 && tween.update(step)) {
            this.m_disposeTween(tween);
        }
    }
};

/**
 * Removes all Tween objects.
 *
 * @returns {undefined}
 * @private
 */
runeos.tween.Tweens.prototype.m_disposeTweens = function() {
    if (this.m_tweens == null) return;

    var i = this.m_tweens.length;
    while (i--) {
        this.m_disposeTween(this.m_tweens[i]);
    }
};

/**
 * Removes a Tween object.
 *
 * @param {runeos.tween.Tween} tween Tween object to remove.
 *
 * @throws {TypeError} If the specified object is not of the correct type.
 *
 * @returns {undefined}
 * @private
 */
runeos.tween.Tweens.prototype.m_disposeTween = function(tween) {
    if (tween instanceof runeos.tween.Tween) {
        var i = this.m_tweens.indexOf(tween);
        if (i < 0) return;

        this.m_tweens.splice(i, 1);
        tween.dispose();
    } else throw new TypeError();
};
