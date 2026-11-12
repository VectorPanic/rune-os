//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Math instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Provides scalar calculations independent of animation state and display objects.
 */
runeos.util.Math = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Returns a smooth repeating pulse: zero at the start of each period, one at
 * its midpoint, then zero again. Time and period must use the same units.
 * Callers own elapsed time and amplitude; this function retains no state.
 *
 * @param {number} elapsed Finite elapsed time.
 * @param {number} period Finite period greater than zero.
 *
 * @returns {number} Pulse value between zero and one.
 */
runeos.util.Math.pulse = function(elapsed, period) {
    var phase = elapsed / period * Math.PI * 2;
    return (1 - Math.cos(phase)) / 2;
};
