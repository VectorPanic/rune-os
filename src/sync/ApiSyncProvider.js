//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ApiSyncProvider instance.
 *
 * @constructor
 * @extends runeos.sync.SyncProvider
 * @param {Object} environment Restricted native sync bridge.
 * @param {string} rootUrl Initially selected local content root.
 *
 * @class
 * @classdesc
 *
 * Adapts the existing sync coordinator to native HTTP and snapshot storage.
 * Owns cancellation tokens, while Electron owns all network and filesystem work.
 */
runeos.sync.ApiSyncProvider = function(environment, rootUrl) {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Borrowed native bridge.
     *
     * @type {Object}
     * @private
     */
    this.m_environment = environment;

    /**
     * Committed root to use when reloading the local catalog.
     *
     * @type {string}
     * @private
     */
    this.m_rootUrl = rootUrl;

    /**
     * Monotonic operation identifiers within this window.
     *
     * @type {number}
     * @private
     */
    this.m_sequence = 0;
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.sync.ApiSyncProvider.prototype = Object.create(runeos.sync.SyncProvider.prototype);
runeos.sync.ApiSyncProvider.prototype.constructor = runeos.sync.ApiSyncProvider;

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * @inheritDoc
 */
runeos.sync.ApiSyncProvider.prototype.check = function(operation) {
    return this.m_run("checkSync", null, operation);
};

/**
 * @inheritDoc
 */
runeos.sync.ApiSyncProvider.prototype.stage = function(update, operation) {
    return this.m_run("stageSync", update, operation);
};

/**
 * @inheritDoc
 */
runeos.sync.ApiSyncProvider.prototype.publish = function(prepared) {
    var provider = this;
    return this.m_environment["publishSync"](prepared).then(function(info) {
        provider.m_rootUrl = info.rootUrl;
    });
};

/**
 * @inheritDoc
 */
runeos.sync.ApiSyncProvider.prototype.discard = function(prepared) {
    return this.m_environment["discardSync"](prepared);
};

/**
 * Returns the committed root without querying the network or native storage.
 *
 * @returns {string} Immutable local snapshot root.
 */
runeos.sync.ApiSyncProvider.prototype.getRootUrl = function() {
    return this.m_rootUrl;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Registers cancellation before native work starts. The coordinator waits for
 * the returned promise to settle and owns any late prepared transaction.
 *
 * @param {string} method Native check or stage method.
 * @param {Object} update Update descriptor, or null for a check.
 * @param {runeos.sync.SyncOperation} operation Current cancellation owner.
 *
 * @returns {Promise.<Object>} Native update or prepared descriptor.
 * @private
 */
runeos.sync.ApiSyncProvider.prototype.m_run = function(method, update, operation) {
    var environment = this.m_environment;
    var token = "sync-" + (++this.m_sequence);
    operation.onCancel(function() {
        Promise.resolve(environment["cancelSync"](token)).catch(function(error) {
            console.warn("Sync cancellation: " + error.message);
        });
    });
    operation.assertActive();
    return method === "checkSync" ? environment["checkSync"](token) : environment["stageSync"](token, update);
};
