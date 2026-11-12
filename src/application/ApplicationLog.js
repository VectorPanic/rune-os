//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ApplicationLog instance. This class is a static utility.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Sends caught application failures to Electron's library-scoped incident log.
 * Owns no files, application instances or pending work. Logging never delays
 * shutdown and is optional outside Electron.
 */
runeos.application.ApplicationLog = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Copies diagnostic text before the failed application releases its resources.
 * Native validation controls filenames, storage location and retained history.
 *
 * @param {*} error Caught startup or execution failure.
 * @param {Object} metadata Application metadata, or null when unavailable.
 * @param {string} source Executable URL used by the failed request.
 * @param {string} phase Preparation, startup or runtime phase identifier.
 *
 * @returns {undefined}
 */
runeos.application.ApplicationLog.write = function(error, metadata, source, phase) {
    try {
        var report = runeos.application.ApplicationLog.m_report(error, metadata, source, phase);
        runeos.application.ApplicationLog.m_send(report);
    } catch (failure) {
        runeos.application.ApplicationLog.m_warn(failure);
    }
};

//------------------------------------------------------------------------------
// Private static methods
//------------------------------------------------------------------------------

/**
 * Builds a diagnostic snapshot independently of Electron and transport.
 *
 * @param {*} error Caught application failure.
 * @param {Object} metadata Application metadata, or null when unavailable.
 * @param {string} source Executable URL.
 * @param {string} phase Preparation, startup or runtime phase identifier.
 *
 * @returns {Object} Incident report containing copied diagnostic values.
 * @private
 */
runeos.application.ApplicationLog.m_report = function(error, metadata, source, phase) {
    metadata = metadata || {};

    return {
        name: String(metadata.name || metadata.id || source),
        id: String(metadata.id || ""),
        source: source,
        phase: phase,
        errorName: String(error && error.name || "Error"),
        message: String(error && error.message || error),
        stack: error && typeof error.stack === "string" ? error.stack : ""
    };
};

/**
 * Sends a report through the optional Electron bridge without waiting for storage.
 *
 * @param {Object} report Completed incident report.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ApplicationLog.m_send = function(report) {
    var environment = typeof window !== "undefined" && window["runeosEnvironment"];
    if (!environment || typeof environment.writeApplicationLog !== "function") return;

    Promise.resolve(environment.writeApplicationLog(report)).catch(runeos.application.ApplicationLog.m_warn);
};

/**
 * Reports a logging failure without retrying or delaying application shutdown.
 *
 * @param {*} failure Report creation or transport failure.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ApplicationLog.m_warn = function(failure) {
    console.warn("Application log: " + failure.message);
};
