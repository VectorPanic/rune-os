//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new instance of TweenValue.
 *
 * @constructor
 *
 * @param {string} name Name of the property.
 * @param {number} [start] The initial value of the property.
 * @param {number} [end] The final value of the property.
 *
 * @class
 * @classdesc
 *
 * The TweenValue class represents a name-value pair used by Tween objects.
 */
runeos.tween.TweenValue = function(name, start, end) {

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Name of the property.
     *
     * @type {string}
     * @default ""
     */
    this.name = name;

    /**
     * The initial value of the property (before interpolation).
     *
     * @type {number}
     * @default 0
     */
    this.start = 0;

    /**
     * The final value of the property (after interpolation).
     *
     * @type {number}
     * @default 0
     */
    this.end = 0;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Normalizes the interpolation endpoints.
     */
    this.m_construct(start, end);
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Delta value of the start and end value.
 *
 * @member {number} delta
 * @memberof runeos.tween.TweenValue
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.tween.TweenValue.prototype, "delta", {
    /**
     * @this runeos.tween.TweenValue
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.end - this.start;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Free up allocated memory.
 *
 * @returns {undefined}
 */
runeos.tween.TweenValue.prototype.dispose = function() {
    //NOTHING; ATM
};

/**
 * Returns a string representation of the TweenValue object.
 *
 * @returns {string}
 */
runeos.tween.TweenValue.prototype.toString = function() {
    return "[{TweenProp (name=" + this['name'] + " start=" + this['start'] + " end=" + this['end']  + ")}]";
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Runs the initialization steps owned by this instance.
 *
 * @param {number} [start] Initial value.
 * @param {number} [end] Final value.
 *
 * @returns {undefined}
 * @private
 */
runeos.tween.TweenValue.prototype.m_construct = function(start, end) {
    this.start = this.m_parseValue(start);
    this.end = this.m_parseValue(end);
};

/**
 * Parses a tween value.
 *
 * @param {*} value Value to parse.
 *
 * @returns {number}
 * @private
 */
runeos.tween.TweenValue.prototype.m_parseValue = function(value) {
    return (typeof value === "number" && isFinite(value)) ? value : 0;
};
