//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Validation instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Shared scalar, resource-path and record validation. It owns no content schema,
 * registry state or dependencies on game and screensaver classes.
 */
runeos.util.Validation = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Checks whether a value is an integer at or above the supplied minimum.
 *
 * @param {*} value Value.
 * @param {number} min Minimum.
 *
 * @returns {boolean}
 */
runeos.util.Validation.isInteger = function(value, min) {
    return typeof value === "number" && isFinite(value) && Math.floor(value) === value && value >= min;
};


/**
 * Requires a nonempty string for the named field.
 *
 * @param {*} value Value.
 * @param {string} name Field.
 *
 * @returns {undefined}
 */
runeos.util.Validation.validateText = function(value, name) {
    if (typeof value !== "string" || !value.trim()) throw Error("Invalid " + name);
};


/**
 * Validates a resource path and rejects executable URL schemes.
 *
 * @param {*} value Value.
 * @param {string} name Field.
 *
 * @returns {undefined}
 */
runeos.util.Validation.validatePath = function(value, name) {
    runeos.util.Validation.validateText(value, name);
    if (/[\x00-\x1f]/.test(value) || /^(javascript|data|vbscript):/i.test(value.trim())) {
        throw Error("Invalid " + name + " path");
    }
};


/**
 * Validates optional bundle-relative required files for any executable content.
 *
 * @param {(Array.<string>|undefined)} files Optional required-file list.
 *
 * @returns {undefined}
 */
runeos.util.Validation.validateRequiredFiles = function(files) {
    if (files === undefined) return;
    if (!Array.isArray(files)) throw Error("Invalid requiredFiles");
    files.forEach(function(file) {
        runeos.util.Validation.validatePath(file, "requiredFiles");
        if (/^(?:[a-z][a-z0-9+.-]*:|[\/\\])/i.test(file.trim())) throw Error("requiredFiles must be bundle-relative");
    });
};


/**
 * Validates independently, so one bad record never discards valid siblings.
 *
 * @param {Object} document JSON document.
 * @param {string} key Collection key.
 * @param {Function} validate Record validator.
 * @param {Function} [identify] Optional internal identifier resolver.
 *
 * @returns {Object} Accepted items, ID lookup and diagnostics.
 */
runeos.util.Validation.validateRecords = function(document, key, validate, identify) {
    var result = {
        items: [],
        ids: Object.create(null),
        errors: []
    };
    if (!document || !Array.isArray(document[key])) {
        result.errors.push(key + ": expected an array");
        return result;
    }
    document[key].forEach(function(item, index) {
        try {
            if (!item || typeof item !== "object") throw Error("Expected an object");
            var id = identify ? identify(item) : item.id;
            runeos.util.Validation.validateText(id, "id");
            if (result.ids[id]) throw Error("Duplicate ID: " + id);
            validate(item);
            result.ids[id] = item;
            result.items.push(item);
        } catch (error) {
            result.errors.push(key + "[" + index + "] " + (item && item.id || "") + ": " + error.message);
        }
    });
    return result;
};
