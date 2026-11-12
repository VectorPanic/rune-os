//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new DirectionalNavigation instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Finds directional neighbors and entry-edge objects using rectangle geometry
 * only. Returns original objects without changing them or depending on display,
 * input, selection history, animation or layout classes.
 */
runeos.util.DirectionalNavigation = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Supported movement directions.
 *
 * @constant {Array.<string>}
 */
runeos.util.DirectionalNavigation.DIRECTIONS = Object.freeze(["LEFT", "RIGHT", "UP", "DOWN"]);

/**
 * Existing cost applied when cross-axis intervals do not overlap.
 *
 * @constant {number}
 */
runeos.util.DirectionalNavigation.MISALIGNMENT_PENALTY = 1000000;

/**
 * Existing weight of movement-axis gaps relative to cross-axis distance.
 *
 * @constant {number}
 */
runeos.util.DirectionalNavigation.PRIMARY_DISTANCE_WEIGHT = 1000;

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Tests whether a direction is supported without allocating a new list.
 *
 * @param {string} direction Movement direction.
 *
 * @returns {boolean}
 */
runeos.util.DirectionalNavigation.isDirection = function(direction) {
    return runeos.util.DirectionalNavigation.DIRECTIONS.indexOf(direction) >= 0;
};

/**
 * Finds the nearest eligible rectangle on the requested side of the source.
 * Equal scores retain input order. All rectangles use a common coordinate space.
 *
 * @template T
 * @param {Array.<T>} items Objects exposing x, y, width and height.
 * @param {(Object|undefined)} source Source rectangle, optionally one of the items.
 * @param {string} direction LEFT, RIGHT, UP or DOWN.
 *
 * @returns {?T} Original candidate or null when no neighbor exists.
 */
runeos.util.DirectionalNavigation.find = function(items, source, direction) {
    var navigation = runeos.util.DirectionalNavigation;
    if (!source || !navigation.isDirection(direction)) return null;
    var horizontal = navigation.m_isHorizontal(direction);
    var positive = navigation.m_isPositive(direction);
    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item || item === source) continue;
        var gap = navigation.m_primaryGap(source, item, horizontal, positive);
        if (gap < 0) continue;
        var score = navigation.m_score(source, item, horizontal, gap);
        if (score < bestScore) {
            bestScore = score;
            best = item;
        }
    }
    return best;
};

/**
 * Finds an entry on the opposite edge of a destination collection.
 * Cross-axis proximity to the source determines which edge rectangle wins.
 * RIGHT enters the left edge; DOWN enters the top edge, and conversely.
 *
 * @template T
 * @param {Array.<T>} items Destination rectangles.
 * @param {(Object|undefined)} source Rectangle in a compatible cross-axis coordinate space.
 * @param {string} direction Movement into the destination collection.
 *
 * @returns {?T} Original entry candidate or null for an empty collection.
 */
runeos.util.DirectionalNavigation.findEntry = function(items, source, direction) {
    var navigation = runeos.util.DirectionalNavigation;
    if (!navigation.isDirection(direction)) return null;
    var horizontal = navigation.m_isHorizontal(direction);
    var positive = navigation.m_isPositive(direction);
    var edge = positive ? Infinity : -Infinity;
    for (var i = 0; i < items.length; i++) {
        if (!items[i]) continue;
        var boundary = navigation.m_entryBoundary(items[i], horizontal, positive);
        edge = positive ? Math.min(edge, boundary) : Math.max(edge, boundary);
    }
    var best = null;
    var distance = Infinity;
    for (var j = 0; j < items.length; j++) {
        var item = items[j];
        if (!item || navigation.m_entryBoundary(item, horizontal, positive) !== edge) continue;
        var cross = navigation.m_crossDistance(source, item, horizontal);
        if (cross < distance) {
            distance = cross;
            best = item;
        }
    }
    return best;
};

//------------------------------------------------------------------------------
// Private static methods
//------------------------------------------------------------------------------

/**
 * Identifies the movement axis.
 *
 * @param {string} direction Validated direction.
 *
 * @returns {boolean} Whether movement is horizontal.
 * @private
 */
runeos.util.DirectionalNavigation.m_isHorizontal = function(direction) {
    return direction === "LEFT" || direction === "RIGHT";
};

/**
 * Identifies movement toward increasing coordinates.
 *
 * @param {string} direction Validated direction.
 *
 * @returns {boolean}
 * @private
 */
runeos.util.DirectionalNavigation.m_isPositive = function(direction) {
    return direction === "RIGHT" || direction === "DOWN";
};

/**
 * Measures the edge-to-edge gap along the requested movement direction.
 * Negative values reject candidates that are not wholly on that side.
 *
 * @param {(Object|undefined)} source Source rectangle.
 * @param {Object} item Candidate rectangle.
 * @param {boolean} horizontal Whether the movement axis is horizontal.
 * @param {boolean} positive Whether coordinates increase in this direction.
 *
 * @returns {number} Signed movement-axis gap.
 * @private
 */
runeos.util.DirectionalNavigation.m_primaryGap = function(source, item, horizontal, positive) {
    if (horizontal) return positive ? item.x - source.x - source.width : source.x - item.x - item.width;
    return positive ? item.y - source.y - source.height : source.y - item.y - item.height;
};

/**
 * Combines alignment, movement-axis gap and cross-axis center distance.
 * Named weights preserve the established navigation ranking.
 *
 * @param {(Object|undefined)} source Source rectangle.
 * @param {Object} item Candidate rectangle.
 * @param {boolean} horizontal Whether movement is horizontal.
 * @param {number} gap Nonnegative movement-axis gap.
 *
 * @returns {number} Lower scores rank before higher scores.
 * @private
 */
runeos.util.DirectionalNavigation.m_score = function(source, item, horizontal, gap) {
    var navigation = runeos.util.DirectionalNavigation;
    var aligned = horizontal ? item.y < source.y + source.height && item.y + item.height > source.y :
        item.x < source.x + source.width && item.x + item.width > source.x;
    return (aligned ? 0 : navigation.MISALIGNMENT_PENALTY) + gap * navigation.PRIMARY_DISTANCE_WEIGHT +
        navigation.m_crossDistance(source, item, horizontal);
};

/**
 * Measures cross-axis center separation without projecting or copying rectangles.
 * A missing source uses cross-axis coordinate zero for first-entry fallback.
 *
 * @param {(Object|undefined)} source Source rectangle, or null.
 * @param {Object} item Candidate rectangle.
 * @param {boolean} horizontal Whether movement is horizontal.
 *
 * @returns {number} Absolute cross-axis distance.
 * @private
 */
runeos.util.DirectionalNavigation.m_crossDistance = function(source, item, horizontal) {
    var center = source ? (horizontal ? source.y + source.height / 2 : source.x + source.width / 2) : 0;
    var candidate = horizontal ? item.y + item.height / 2 : item.x + item.width / 2;
    return Math.abs(candidate - center);
};

/**
 * Reads the boundary used for first entry into a destination collection.
 *
 * @param {Object} item Destination rectangle.
 * @param {boolean} horizontal Whether movement is horizontal.
 * @param {boolean} positive Whether entry uses the leading edge.
 *
 * @returns {number} Position of the relevant edge.
 * @private
 */
runeos.util.DirectionalNavigation.m_entryBoundary = function(item, horizontal, positive) {
    if (horizontal) return positive ? item.x : item.x + item.width;
    return positive ? item.y : item.y + item.height;
};
