//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new SyncOperation instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Cooperative cancellation for one sync operation. Providers register transport
 * abort handlers; completion releases those handlers without aborting anything.
 */
runeos.sync.SyncOperation = function() {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Whether cancellation has been requested.
     *
     * @type {boolean}
     * @private
     */
    this.m_cancelled = false;

    /**
     * Abort handlers owned by this operation.
     *
     * @type {Array.<Function>}
     * @private
     */
    this.m_handlers = [];

    /**
     * Whether normal completion already released transport ownership.
     *
     * @type {boolean}
     * @private
     */
    this.m_completed = false;
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether this operation was cancelled.
 *
 * @member {boolean} cancelled
 * @memberof runeos.sync.SyncOperation
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.sync.SyncOperation.prototype, "cancelled", {
    /**
     * @this runeos.sync.SyncOperation
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_cancelled;
    }
});
//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Registers a transport abort handler before starting asynchronous work.
 *
 * @param {Function} handler Abort callback.
 *
 * @returns {undefined}
 */
runeos.sync.SyncOperation.prototype.onCancel = function(handler) {
    if (this.m_cancelled) handler();
    else if (!this.m_completed) this.m_handlers.push(handler);
};

/**
 * Rejects work that must not continue after cancellation.
 *
 * @returns {undefined}
 */
runeos.sync.SyncOperation.prototype.assertActive = function() {
    if (this.m_cancelled) throw Error("Sync operation was cancelled.");
};

/**
 * Cancels every registered transport once and releases its callback.
 *
 * @returns {undefined}
 */
runeos.sync.SyncOperation.prototype.cancel = function() {
    if (this.m_cancelled) return;
    this.m_cancelled = true;
    var handlers = this.m_handlers;
    this.m_handlers = [];
    for (var i = 0; i < handlers.length; i++) {
        try { handlers[i](); }
        catch (error) { console.warn("Sync cancellation: " + error.message); }
    }
};

/**
 * Releases abort handlers after normal completion.
 *
 * @returns {undefined}
 */
runeos.sync.SyncOperation.prototype.complete = function() {
    this.m_completed = true;
    this.m_handlers = [];
};
