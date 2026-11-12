//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ScreensaverRotation instance.
 *
 * @constructor
 * @param {Object} options Library, current identifier, interval and callbacks.
 *
 * @class
 * @classdesc
 *
 * Times a running screensaver and prepares one different available replacement.
 * Knows nothing about scenes or rendering; disposal invalidates pending results.
 */
runeos.application.ScreensaverRotation = function(options) {
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Library supplying current availability and executable preparation.
     *
     * @type {Object}
     * @private
     */
    this.m_library = options.library || null;

    /**
     * Identifier excluded from the next random selection.
     *
     * @type {string}
     * @private
     */
    this.m_currentId = options.currentId;

    /**
     * Running time between replacements; zero disables rotation.
     *
     * @type {number}
     * @private
     */
    this.m_interval = options.intervalMs;

    /**
     * Receives prepared source and replacement metadata.
     *
     * @type {Function}
     * @private
     */
    this.m_onReady = options.onReady;

    /**
     * Receives preparation failures.
     *
     * @type {Function}
     * @private
     */
    this.m_onError = options.onError;

    /**
     * Accumulated running time in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_elapsed = 0;

    /**
     * Current phase: waiting, preparing, ready, failed or disposed.
     * Only waiting advances the interval; ready and failed await scene teardown.
     *
     * @type {string}
     * @private
     */
    this.m_state = "waiting";

};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Current rotation phase, available for diagnostics without changing the process.
 *
 * @member {string} state
 * @memberof runeos.application.ScreensaverRotation
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.application.ScreensaverRotation.prototype, "state", {
    /**
     * @this runeos.application.ScreensaverRotation
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_state;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Accumulates running time and prepares at most one replacement.
 * A single saver or a zero interval leaves the current application running.
 *
 * @param {number} step Elapsed running time in milliseconds.
 *
 * @returns {undefined}
 */
runeos.application.ScreensaverRotation.prototype.update = function(step) {
    if (this.m_state !== "waiting" || this.m_interval === 0 ||
        typeof step !== "number" || !isFinite(step) || step <= 0) return;
    this.m_elapsed += step;
    if (this.m_elapsed < this.m_interval) return;
    this.m_elapsed = 0;
    var candidate = this.m_chooseNext();
    if (candidate) this.m_prepare(candidate);
};

/**
 * Releases callbacks and invalidates asynchronous preparation without stopping apps.
 *
 * @returns {undefined}
 */
runeos.application.ScreensaverRotation.prototype.dispose = function() {
    this.m_state = "disposed";
    this.m_library = null;
    this.m_onReady = null;
    this.m_onError = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Chooses from available definitions while excluding the running identifier.
 *
 * @returns {?Object} Different replacement, or null when none is available.
 * @private
 */
runeos.application.ScreensaverRotation.prototype.m_chooseNext = function() {
    if (!this.m_library || typeof this.m_library.prepareScreensaver !== "function") return null;
    var currentId = this.m_currentId;
    var items = runeos.catalog.ScreensaverRegistry.getAvailable(this.m_library.screensavers || []);
    var candidates = items.filter(function(item) {
        return runeos.catalog.ScreensaverRegistry.getId(item) !== currentId;
    });
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
};

/**
 * Prepares without disturbing the current output and ignores results after disposal.
 *
 * @param {Object} candidate Replacement metadata.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ScreensaverRotation.prototype.m_prepare = function(candidate) {
    this.m_state = "preparing";
    var rotation = this;
    Promise.resolve().then(function() {
        if (rotation.m_state !== "preparing") return null;
        return rotation.m_library.prepareScreensaver(runeos.catalog.ScreensaverRegistry.getId(candidate));
    }).then(function(source) {
        rotation.m_ready(source, candidate);
    }).catch(function(error) {
        rotation.m_fail(error);
    });
};

/**
 * Marks preparation complete before handing the replacement to the caller.
 *
 * @param {string} source Prepared executable URL.
 * @param {Object} candidate Replacement metadata.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ScreensaverRotation.prototype.m_ready = function(source, candidate) {
    if (this.m_state !== "preparing") return;
    this.m_state = "ready";
    this.m_onReady(source, candidate);
};

/**
 * Reports a terminal preparation or handoff failure without starting a retry loop.
 *
 * @param {*} error Preparation or handoff failure.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ScreensaverRotation.prototype.m_fail = function(error) {
    if (this.m_state === "disposed") return;
    this.m_state = "failed";
    this.m_onError(error);
};
