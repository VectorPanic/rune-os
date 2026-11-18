//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new HighscoreApiProvider instance.
 *
 * @constructor
 * @param {Object} environment Restricted native bridge.
 * @class
 * @classdesc
 * Adapts highscore synchronization to the native HTTP bridge.
 */
runeos.sync.HighscoreApiProvider = function(environment) {
    /**
     * Native bridge borrowed from the application window.
     *
     * @type {Object}
     * @private
     */
    this.m_environment = environment;
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Sends SDK tables and returns synchronized tables through the callback.
 *
 * @param {string} id SDK application identifier.
 * @param {Array} tables SDK highscore tables.
 * @param {Function} callback Receives an error or the synchronized tables.
 * @returns {undefined}
 */
runeos.sync.HighscoreApiProvider.prototype.sync = function(id, tables, callback) {
    this.m_environment["syncHighscores"](id, tables).then(function(result) {
        callback(null, result);
    }, function(error) {
        callback(error, null);
    });
};
