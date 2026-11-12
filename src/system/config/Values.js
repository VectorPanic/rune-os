//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Values instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Copies known settings and freezes owned snapshots without retaining caller data.
 */
runeos.system.config.Values = function() {

};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Copies partial overrides against an explicit default structure.
 *
 * @param {!Object} defaults Expected fields and primitive types.
 * @param {*} options Caller-owned partial overrides; undefined uses defaults.
 * @param {string} path Diagnostic path, such as config or config.input.
 *
 * @returns {!Object}
 */
runeos.system.config.Values.prototype.merge = function(defaults, options, path) {
    var overrides = this.m_options(defaults, options, path);
    var result = {};
    var self = this;
    Object.keys(defaults).forEach(function(key) {
        var supplied = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : undefined;
        result[key] = self.m_copy(defaults[key], supplied, path + "." + key);
    });
    return result;
};

/**
 * Recursively freezes an owned snapshot, including nested groups and arrays.
 *
 * @param {!Object} value Freshly copied configuration.
 *
 * @returns {!Object}
 */
runeos.system.config.Values.prototype.freeze = function(value) {
    var self = this;
    Object.keys(value).forEach(function(key) {
        if (value[key] && typeof value[key] === "object") self.freeze(value[key]);
    });
    return Object.freeze(value);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Returns validated overrides, rejecting unknown fields before copying.
 *
 * @param {!Object} defaults Expected field names.
 * @param {*} options Optional overrides.
 * @param {string} path Diagnostic path.
 *
 * @returns {!Object} Validated overrides, or an empty object when omitted.
 * @private
 */
runeos.system.config.Values.prototype.m_options = function(defaults, options, path) {
    if (options === undefined) return {};
    if (options === null || typeof options !== "object" || Array.isArray(options)) throw new TypeError(path + " must be an object.");
    Object.keys(options).forEach(function(key) {
        if (!Object.prototype.hasOwnProperty.call(defaults, key)) throw new Error("Unknown setting: " + path + "." + key);
    });
    return options;
};

/**
 * Copies one array, nested group or validated primitive value.
 *
 * @param {*} fallback Default value defining the expected type.
 * @param {*} supplied Optional override, preserving explicit false and zero.
 * @param {string} path Complete setting path.
 *
 * @returns {*}
 * @private
 */
runeos.system.config.Values.prototype.m_copy = function(fallback, supplied, path) {
    var value = supplied === undefined ? fallback : supplied;
    if (Array.isArray(fallback)) {
        if (!Array.isArray(value)) throw new TypeError("Invalid setting: " + path);
        return value.slice();
    }
    if (typeof fallback === "object" && fallback !== null) return this.merge(fallback, supplied, path);
    if (typeof value !== typeof fallback || (typeof value === "number" && !isFinite(value)) ||
        (typeof value === "string" && !value.trim())) throw new TypeError("Invalid setting: " + path);
    return value;
};

