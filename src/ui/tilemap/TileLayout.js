//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new TileLayout instance. This class is a static layout library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Packs ordered size preferences into grid cells without depending on display
 * objects, navigation, images or pixel dimensions. Results contain slot and
 * variant values only. Tilemap applies the resulting geometry to its children.
 */
runeos.ui.tilemap.TileLayout = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Largest collection eligible for the bounded recursive search.
 *
 * @constant {number}
 */
runeos.ui.tilemap.TileLayout.MAX_TILES = runeos.ui.tilemap.TilemapOptions.DEFAULTS.advanced.layoutMaxTiles;

/**
 * Maximum recursive attempts before returning the normal-grid fallback signal.
 *
 * @constant {number}
 */
runeos.ui.tilemap.TileLayout.MAX_ATTEMPTS = runeos.ui.tilemap.TilemapOptions.DEFAULTS.advanced.layoutMaxAttempts;

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Finds the same first-fit layout as the original Tilemap packer, preferring
 * larger requested variants and reducing sizes when required to avoid holes.
 * Input preferences are never changed. Null delegates to a compact normal grid.
 *
 * @param {Array.<number>} priorities Ordered preferences: 0 Normal, 1 Wide, 2 Large.
 * @param {number} columns Positive integer number of grid columns.
 * @param {Object} [config] Optional bounded-search settings.
 *
 * @returns {?Array.<Object>} Ordered placements, or null when no complete layout is found.
 */
runeos.ui.tilemap.TileLayout.pack = function(priorities, columns, config) {
    config = config instanceof runeos.ui.tilemap.TilemapOptions ? config.advanced :
        runeos.ui.tilemap.TilemapOptions.resolve({advancedConfig: config}).advanced;
    if (!Array.isArray(priorities)) throw new TypeError("Expected Tile priorities.");
    if (typeof columns !== "number" || !isFinite(columns) || columns < 1 ||
        Math.floor(columns) !== columns) throw new RangeError("Invalid columns.");
    for (var priorityIndex = 0; priorityIndex < priorities.length; priorityIndex++) {
        var priority = priorities[priorityIndex];
        if (priority !== 0 && priority !== 1 && priority !== 2) {
            throw new RangeError("Invalid tile priority.");
        }
    }
    var attempts = 0;
    var failed = {};
    var result = null;

    // First-fit search favors requested sizes in insertion order. Memoization and
    // a search limit keep user-supplied collections bounded; normal is always safe.
    function pack(index, cells, placements) {
        if (++attempts > config.layoutMaxAttempts) return false;
        if (index === priorities.length) {
            if (cells.length % columns !== 0) return false;
            for (var c = 0; c < cells.length; c++) {
                if (!cells[c]) return false;
            }
            result = placements;
            return true;
        }
        var key = index + ":" + cells.join("");
        if (failed[key]) return false;
        for (var variant = priorities[index]; variant >= 0; variant--) {
            var width = variant === 0 ? 1 : 2;
            var height = variant === 2 ? 2 : 1;
            if (width > columns) continue;
            var slot = 0;
            while (true) {
                var column = slot % columns;
                var fits = column + width <= columns;
                for (var y = 0; fits && y < height; y++) {
                    for (var x = 0; x < width; x++) {
                        if (cells[slot + y * columns + x]) fits = false;
                    }
                }
                if (fits) break;
                slot++;
            }
            var next = cells.slice();
            var last = slot + (height - 1) * columns + width;
            while (next.length < last) next.push(0);
            for (var row = 0; row < height; row++) {
                for (var col = 0; col < width; col++) next[slot + row * columns + col] = 1;
            }
            if (pack(index + 1, next, placements.concat([{
                    slot: slot,
                    variant: variant
            }]))) return true;
        }
        failed[key] = true;
        return false;
    }

    // Avoid recursive search for very large groups. They retain a compact normal grid.
    if (priorities.length <= config.layoutMaxTiles) pack(0, [], []);
    return result;
};
