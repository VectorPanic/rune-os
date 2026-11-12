//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Paths instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Resolves content URLs with browser URL rules. The launcher's original base
 * remains stable while an application temporarily owns the document base.
 */
runeos.util.Paths = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Original launcher base, captured before any game starts.
 *
 * @constant {string}
 */
runeos.util.Paths.BASE_URL = typeof document !== "undefined" ? document.baseURI || "" : "";

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Resolves a resource URL against an explicit base or the original launcher.
 * An absent browser base leaves standalone launcher-relative values unchanged.
 *
 * @param {string} value Resource URL.
 * @param {string} [base] Directory or document URL.
 *
 * @returns {string} Normalized URL.
 */
runeos.util.Paths.resolve = function(value, base) {
    if (typeof value !== "string" || !value.trim()) throw new TypeError("Expected a resource URL.");
    var root = base || runeos.util.Paths.BASE_URL;
    if (!root) return value;
    if (runeos.util.Paths.BASE_URL) root = new URL(root, runeos.util.Paths.BASE_URL).href;
    return new URL(value, root).href;
};

/**
 * Normalizes a directory root and preserves its trailing slash.
 *
 * @param {string} value Directory URL.
 *
 * @returns {string} Directory root.
 */
runeos.util.Paths.root = function(value) {
    var directory = value.split(/[?#]/)[0].replace(/\/?$/, "/");
    return runeos.util.Paths.resolve(directory);
};

/**
 * Returns the containing directory of a resource, excluding query and fragment.
 *
 * @param {string} value Resource URL.
 *
 * @returns {string} Resource directory.
 */
runeos.util.Paths.directory = function(value) {
    var resolved = runeos.util.Paths.resolve(value);
    if (!runeos.util.Paths.BASE_URL && !/^[a-z][a-z0-9+.-]*:/i.test(resolved)) {
        return resolved.split(/[?#]/)[0].replace(/[^/]*$/, "");
    }
    return new URL(".", resolved).href;
};
