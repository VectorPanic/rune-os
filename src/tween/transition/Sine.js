//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new instance of Sine.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * The Sine class provides three easing functions that enable the
 * implementation of smooth motion in Rune animations.
 */
runeos.tween.Sine = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Private static constants
//------------------------------------------------------------------------------

/**
 * The value of Pi divided into two.
 *
 * @const {number}
 * @private
 */
runeos.tween.Sine.HALF_PI = Math.PI * 0.5;

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Ease in.
 *
 * @param {number} t Specifies the current time, between 0 and duration inclusive.
 * @param {number} b Specifies the initial value of the animation property.
 * @param {number} c Specifies the total change in the animation property.
 * @param {number} d Specifies the duration of the motion.
 *
 * @returns {number} The value of the interpolated property at the specified time.
 */
runeos.tween.Sine.easeIn = function(t, b, c, d) {
    return -c * Math.cos(t / d * runeos.tween.Sine.HALF_PI) + c + b;
};

/**
 * Ease out.
 *
 * @param {number} t Specifies the current time, between 0 and duration inclusive.
 * @param {number} b Specifies the initial value of the animation property.
 * @param {number} c Specifies the total change in the animation property.
 * @param {number} d Specifies the duration of the motion.
 *
 * @returns {number}
 */
runeos.tween.Sine.easeOut = function(t, b, c, d) {
    return c * Math.sin(t / d * runeos.tween.Sine.HALF_PI) + b;
};

/**
 * Ease in and out.
 *
 * @param {number} t Specifies the current time, between 0 and duration inclusive.
 * @param {number} b Specifies the initial value of the animation property.
 * @param {number} c Specifies the total change in the animation property.
 * @param {number} d Specifies the duration of the motion.
 *
 * @returns {number}
 */
runeos.tween.Sine.easeInOut = function(t, b, c, d) {
    return -c * 0.5 * (Math.cos(Math.PI * t / d) - 1) + b;
};
