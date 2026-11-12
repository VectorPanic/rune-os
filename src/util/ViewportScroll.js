//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ViewportScroll instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Calculates content translation needed to reveal an interval in a viewport.
 * Independent of display objects, selection, layout and animation.
 */
runeos.util.ViewportScroll = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Reveals content bounds with the smallest necessary translation. Intervals use
 * finite, ordered start/end coordinates on either axis. Position translates
 * content coordinates into viewport coordinates; it is not a scrollTop value.
 * If the bounds exceed the viewport, their end edge takes precedence.
 * Inputs are never changed. Missing bounds retain the current position.
 *
 * @param {Object} viewport Visible interval with start and end coordinates.
 * @param {?Object} bounds Content interval with start and end coordinates.
 * @param {number} position Current content translation.
 *
 * @returns {number} Required content translation.
 */
runeos.util.ViewportScroll.reveal = function(viewport, bounds, position) {
    if (!bounds) return position;
    if (bounds.start + position < viewport.start) {
        position = viewport.start - bounds.start;
    }
    if (bounds.end + position > viewport.end) {
        position = viewport.end - bounds.end;
    }
    return position;
};
