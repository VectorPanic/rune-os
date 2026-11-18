//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new HighscoreSync instance.
 *
 * @constructor
 * @param {?Object} provider Highscore provider, or null when unavailable.
 *
 * @class
 * @classdesc
 *
 * Coordinates one on-demand highscore request for an application session.
 * The optional provider implements sync(id, tables, callback), returning the
 * complete synchronized tables through callback(error, tables).
 */
runeos.sync.HighscoreSync = function(provider) {
    
    /**
     * Provider used to synchronize highscore tables.
     *
     * @type {?Object}
     * @private
     */
    this.m_provider = provider;

    /**
     * Current operation, or null when no request is pending.
     *
     * @type {?Object}
     * @private
     */
    this.m_operation = null;

    /**
     * Whether this coordinator has been disposed.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    /**
     * Maximum time to wait for the provider, in milliseconds.
     *
     * @const {number}
     * @private
     */
    this.TIMEOUT = 4000;
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Requests synchronization without overwriting changes made while waiting.
 *
 * @param {string} id SDK application identifier.
 * @param {Object} highscores Active SDK highscore object.
 * @param {Function} callback Completion callback.
 * @returns {undefined}
 */
runeos.sync.HighscoreSync.prototype.sync = function(id, highscores, callback) {
    if (!this.m_canSync(highscores)) {
        this.m_notify(callback, false, false);
        return;
    }

    var tables;
    var original;
    try {
        tables = highscores["export"]();
        original = JSON.stringify(tables);
    } catch (error) {
        this.m_notify(callback, false, false);
        return;
    }
    
    this.m_start(id, highscores, tables, original, callback);
};

/**
 * Invalidates any pending response when the game exits.
 *
 * @returns {undefined}
 */
runeos.sync.HighscoreSync.prototype.dispose = function() {
    this.m_disposed = true;
    if (this.m_operation) window.clearTimeout(this.m_operation.timer);
    this.m_operation = null;
    this.m_provider = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Checks that this session and the required interfaces are available.
 *
 * @param {Object} highscores Active SDK highscore object.
 * @returns {boolean} Whether a request can start.
 * @private
 */
runeos.sync.HighscoreSync.prototype.m_canSync = function(highscores) {
    return !this.m_disposed && !this.m_operation && !!this.m_provider &&
        typeof this.m_provider["sync"] === "function" && !!highscores &&
        typeof highscores["export"] === "function" &&
        typeof highscores["import"] === "function";
};

/**
 * Starts a provider request and associates its timeout with this session.
 *
 * @param {string} id SDK application identifier.
 * @param {Object} highscores Active SDK highscore object.
 * @param {Array} tables Exported highscore tables.
 * @param {string} original Serialized original tables.
 * @param {Function} callback Completion callback.
 * @returns {undefined}
 * @private
 */
runeos.sync.HighscoreSync.prototype.m_start = function(id, highscores, tables, original, callback) {
    var self = this;
    var operation = {timer: null, callback: callback};
    this.m_operation = operation;
    operation.timer = window.setTimeout(function() {
        self.m_finish(operation, false, false);
    }, this.TIMEOUT);
    try {
        this.m_provider["sync"](id, tables, function(error, result) {
            self.m_receive(operation, highscores, original, error, result);
        });
    } catch (error) {
        this.m_finish(operation, false, false);
    }
};

/**
 * Validates and imports a response while its request still owns the session.
 *
 * @param {Object} operation Request that received the response.
 * @param {Object} highscores Active SDK highscore object.
 * @param {string} original Serialized original tables.
 * @param {*} error Provider error, if any.
 * @param {*} result Synchronized highscore tables.
 * @returns {undefined}
 * @private
 */
runeos.sync.HighscoreSync.prototype.m_receive = function(operation, highscores, original, error, result) {
    if (!this.m_isCurrent(operation)) return;
    var success = false;
    var updated = false;
    try {
        if (!error && JSON.stringify(highscores["export"]()) === original) {
            updated = JSON.stringify(result) !== original;
            success = highscores["import"](result);
        }
    } catch (failure) {
        success = false;
    }
    this.m_finish(operation, success, success && updated);
};

/**
 * Checks whether a request may still modify this session.
 *
 * @param {Object} operation Request to check.
 * @returns {boolean} Whether the request is current.
 * @private
 */
runeos.sync.HighscoreSync.prototype.m_isCurrent = function(operation) {
    return !this.m_disposed && this.m_operation === operation;
};

/**
 * Releases the timeout and completes a current request once.
 *
 * @param {Object} operation Request to complete.
 * @param {boolean} success Whether the request succeeded.
 * @param {boolean} updated Whether the active list changed.
 * @returns {undefined}
 * @private
 */
runeos.sync.HighscoreSync.prototype.m_finish = function(operation, success, updated) {
    if (!this.m_isCurrent(operation)) return;
    window.clearTimeout(operation.timer);
    this.m_operation = null;
    this.m_notify(operation.callback, success, updated);
};

/**
 * Reports a synchronization result when a callback was provided.
 *
 * @param {Function} callback Completion callback.
 * @param {boolean} success Whether the request succeeded.
 * @param {boolean} updated Whether the active list changed.
 * @returns {undefined}
 * @private
 */
runeos.sync.HighscoreSync.prototype.m_notify = function(callback, success, updated) {
    if (typeof callback === "function") callback({success: success, updated: updated});
};
