//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new FontLoader instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Loads and registers font faces through the shared file transport. Concurrent
 * requests for a family and URL share one promise; failed requests can be retried.
 * Does not depend on text roles, field geometry or UI components.
 */
runeos.text.FontLoader = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Private static properties
//------------------------------------------------------------------------------

/**
 * Font-face promises cached by family and resource URL for this document.
 *
 * @type {Object}
 * @private
 */
runeos.text.FontLoader.m_loadedFaces = Object.create(null);

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Loads the first family in a CSS family list and registers it before resolving.
 * Generic families and environments without font APIs need no resource request.
 *
 * @param {string} family Font family or CSS fallback list.
 * @param {string} url Font resource URL.
 * @param {Object} [loadingConfig] Optional file transport configuration.
 *
 * @returns {Promise} Registered font face, or immediate completion without loading.
 */
runeos.text.FontLoader.load = function(family, url, loadingConfig) {
    if (typeof FontFace !== "function" || typeof document === "undefined" || !document.fonts) {
        return Promise.resolve();
    }
    family = family.split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"].indexOf(family.toLowerCase()) !== -1) {
        return Promise.resolve();
    }
    var loader = runeos.text.FontLoader;
    var key = JSON.stringify([family, url]);
    if (!loader.m_loadedFaces[key]) {
        loader.m_loadedFaces[key] = loader.m_loadFace(family, url, loadingConfig).catch(function(error) {
            delete loader.m_loadedFaces[key];
            throw error;
        });
    }
    return loader.m_loadedFaces[key];
};

//------------------------------------------------------------------------------
// Private static methods
//------------------------------------------------------------------------------

/**
 * Reads one font resource and releases transport before decoding its face.
 *
 * @param {string} family Normalized font-family name.
 * @param {string} url Font resource URL.
 * @param {Object} [loadingConfig] File transport configuration.
 *
 * @returns {Promise} Registered font face.
 * @private
 */
runeos.text.FontLoader.m_loadFace = function(family, url, loadingConfig) {
    return new Promise(function(resolve, reject) {
        var files = new runeos.util.FileLoader({config: loadingConfig});
        files.binary(url, function(bytes) {
            files.dispose();
            try {
                var face = new FontFace(family, bytes);
                resolve(face.load().then(function(loaded) {
                    document.fonts.add(loaded);
                    return loaded;
                }));
            } catch (error) {
                reject(error);
            }
        }, function(error) {
            files.dispose();
            reject(error);
        });
    });
};
