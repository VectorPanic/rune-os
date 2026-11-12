//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new SyncProvider instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Contract for an API/download/installation adapter. Reads never change the
 * active library; verified staging is separate from atomic local publication.
 * No network implementation or package format is assumed by this contract.
 */
runeos.sync.SyncProvider = function() {

};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Checks for an update without changing installed content.
 *
 * @param {runeos.sync.SyncOperation} operation Register abort handlers here.
 *
 * @returns {Promise.<?Object>}
 */
runeos.sync.SyncProvider.prototype.check = function(operation) {
    return Promise.resolve(null);
};

/**
 * Prepares and validates immutable local content outside the active library.
 *
 * @param {Object} update Update descriptor from check.
 * @param {runeos.sync.SyncOperation} operation Cancellation and transport ownership.
 *
 * @returns {Promise.<Object>}
 */
runeos.sync.SyncProvider.prototype.stage = function(update, operation) {
    return Promise.reject(Error("SyncProvider.stage must be implemented."));
};

/**
 * Atomically activates a prepared local snapshot; performs no network work.
 *
 * @param {Object} prepared Verified local staging transaction.
 *
 * @returns {Promise}
 */
runeos.sync.SyncProvider.prototype.publish = function(prepared) {
    return Promise.reject(Error("SyncProvider.publish must be implemented."));
};

/**
 * Releases an unused prepared transaction without touching the active library.
 *
 * @param {Object} prepared Unused staging transaction.
 *
 * @returns {Promise}
 */
runeos.sync.SyncProvider.prototype.discard = function(prepared) {
    return Promise.resolve();
};
