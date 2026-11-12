//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Color instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Provides color calculations independent of display objects and text styles.
 */
runeos.util.Color = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Estimates perceived RGB brightness between zero and one. This is not a
 * contrast-ratio calculation. Supports #RGB and #RRGGBB; other formats return zero.
 *
 * @param {string} color Hexadecimal color.
 *
 * @returns {number} Weighted brightness, or zero for unsupported input.
 */
runeos.util.Color.getBrightness = function(color) {
    var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
    if (!hex) return 0;
    
    var value = hex[1];
    
    if (value.length === 3) {
        value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    }
    
    var rgb = parseInt(value, 16);
    var red = rgb >> 16;
    var green = (rgb >> 8) & 255;
    var blue = rgb & 255;
    
    return (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
};
