//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new LibrarySync instance.
 *
 * @constructor
 *
 * @param {Object} [options] Provider, refresh callback and sync settings.
 *
 * @class
 * @classdesc
 *
 * Schedules one cancellable background operation at a time. Only the caller
 * decides when the system is quiet. Offline errors never replace local content.
 * Providers own staged storage and atomic publication; scenes know neither.
 */
runeos.sync.LibrarySync = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable scheduling settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("sync", options.config);

    /**
     * Optional external provider; absent means local-only operation.
     *
     * @type {runeos.sync.SyncProvider}
     * @private
     */
    this.m_provider = options.provider || null;

    /**
     * Reloads the local catalog after a successful commit.
     *
     * @type {Function}
     * @private
     */
    this.m_onPublished = options.onPublished || function() { return Promise.resolve(); };

    /**
     * Current phase, exposed through state.
     *
     * @type {string}
     * @private
     */
    this.m_state = "idle";

    /**
     * Remaining time before the next check or refresh retry.
     *
     * @type {number}
     * @private
     */
    this.m_until = this.m_config.initialDelayMs;

    /**
     * Quiet time accumulated in the eligible scene.
     *
     * @type {number}
     * @private
     */
    this.m_idle = 0;

    /**
     * Explicit request permits preparation before the quiet presentation window.
     *
     * @type {boolean}
     * @private
     */
    this.m_requested = false;

    /**
     * Whether the latest frame permits activation in Launcher.
     *
     * @type {boolean}
     * @private
     */
    this.m_allowed = false;

    /**
     * Current cancellable operation, if any.
     *
     * @type {runeos.sync.SyncOperation}
     * @private
     */
    this.m_operation = null;

    /**
     * Update waiting for quiet preparation.
     *
     * @type {Object}
     * @private
     */
    this.m_update = null;

    /**
     * Verified staging transaction awaiting publication.
     *
     * @type {Object}
     * @private
     */
    this.m_prepared = null;

    /**
     * Latest background failure, without making local games unavailable.
     *
     * @type {Error}
     * @private
     */
    this.m_error = null;

    /**
     * Permanent disposal flag.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Current background phase.
 *
 * @member {string} state
 * @memberof runeos.sync.LibrarySync
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.sync.LibrarySync.prototype, "state", {
    /**
     * @this runeos.sync.LibrarySync
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_disposed ? "disposed" : this.m_state;
    }
});

/**
 * Whether atomic publication or local catalog reload is in progress.
 *
 * @member {boolean} publishing
 * @memberof runeos.sync.LibrarySync
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.sync.LibrarySync.prototype, "publishing", {
    /**
     * @this runeos.sync.LibrarySync
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return !this.m_disposed && (this.m_state === "publishing" || this.m_state === "refreshing");
    }
});

/**
 * Latest background error, or null.
 *
 * @member {Error} error
 * @memberof runeos.sync.LibrarySync
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.sync.LibrarySync.prototype, "error", {
    /**
     * @this runeos.sync.LibrarySync
     * @returns {Error}
     * @ignore
     */
    get : function() {
        return this.m_error;
    }
});
/**
 * Whether the latest frame has accumulated enough quiet time for presentation.
 *
 * @member {boolean} quiet
 * @memberof runeos.sync.LibrarySync
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.sync.LibrarySync.prototype, "quiet", {
    /**
     * @this runeos.sync.LibrarySync
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return !this.m_disposed && this.m_allowed && this.m_idle >= this.m_config.idleDelayMs;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Prepares and applies updates while Launcher permits synchronization.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 * @param {boolean} hasInput A user input is held or newly pressed.
 *
 * @returns {undefined}
 */
runeos.sync.LibrarySync.prototype.updateInLauncher = function(step, hasInput) {
    if (!this.m_canSync()) return;
    this.m_allowed = true;
    var elapsed = this.m_advance(step);
    this.m_idle = hasInput ? 0 : this.m_idle + elapsed;

    if (this.m_until > 0) return;
    if (this.m_idle < this.m_config.idleDelayMs) {
        if (this.m_requested) this.m_prepareUpdate();
        return;
    }
    if (this.m_state === "ready") this.m_publish();
    else if (this.m_state === "refresh") this.m_refresh();
    else this.m_prepareUpdate();
};

/**
 * Checks and stages content during application execution without activating it.
 * Game input does not delay background preparation; returning to Launcher starts
 * a fresh quiet period before publication and catalog replacement.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {undefined}
 */
runeos.sync.LibrarySync.prototype.prepareInBackground = function(step) {
    if (!this.m_canSync()) return;
    this.m_allowed = false;
    this.m_idle = 0;
    this.m_advance(step);
    if (this.m_until === 0) this.m_prepareUpdate();
};

/**
 * Cancels preparation and resets the quiet period while sync is paused.
 *
 * @returns {undefined}
 */
runeos.sync.LibrarySync.prototype.pause = function() {
    if (!this.m_canSync()) return;
    this.m_allowed = false;
    this.m_idle = 0;
    this.m_pause();
};

/**
 * Requests immediate preparation in Launcher; publication still waits for quiet.
 *
 * @returns {undefined}
 */
runeos.sync.LibrarySync.prototype.request = function() {
    if (this.m_disposed) return;
    this.m_requested = true;
    this.m_until = 0;
};

/**
 * Cancels background preparation and discards unused staged content.
 *
 * @returns {undefined}
 */
runeos.sync.LibrarySync.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_pause();
    if (this.m_state !== "publishing") this.m_discard(this.m_prepared);
    this.m_update = null;
    this.m_prepared = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Checks whether the scheduler can run.
 *
 * @returns {boolean} Whether synchronization is enabled and available.
 * @private
 */
runeos.sync.LibrarySync.prototype.m_canSync = function() {
    return !this.m_disposed && !!this.m_provider && this.m_config.enabled;
};

/**
 * Checks for or stages an update when the current state allows preparation.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_prepareUpdate = function() {
    if (this.m_state === "idle") this.m_check();
    else if (this.m_state === "available") this.m_stage();
};

/**
 * Advances polling and retry delays using a finite, nonnegative frame duration.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {number} Normalized elapsed milliseconds.
 * @private
 */
runeos.sync.LibrarySync.prototype.m_advance = function(step) {
    var elapsed = typeof step === "number" && isFinite(step) ? Math.max(0, step) : 0;
    this.m_until = Math.max(0, this.m_until - elapsed);
    return elapsed;
};

/**
 * Stops cancellable work while retaining a completed staged update.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_pause = function() {
    if (this.m_state !== "checking" && this.m_state !== "staging") return;
    this.m_state = "pausing";
    this.m_until = 0;
    if (this.m_operation) this.m_operation.cancel();
};

/**
 * Checks for a newer snapshot without delaying local startup.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_check = function() {
    var sync = this;
    this.m_run("checking", function(operation) {
        return sync.m_provider.check(operation);
    }, function(update) {
        if (update !== null && (!update || typeof update !== "object")) throw Error("Invalid sync update descriptor.");
        if (!update) sync.m_requested = false;
        sync.m_update = update;
        sync.m_state = update ? "available" : "idle";
        sync.m_until = update ? 0 : sync.m_config.intervalMs;
    });
};

/**
 * Prepares one update without changing active game paths.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_stage = function() {
    var sync = this;
    this.m_requested = false;
    this.m_run("staging", function(operation) {
        return sync.m_provider.stage(sync.m_update, operation);
    }, function(prepared) {
        if (!prepared || typeof prepared !== "object") throw Error("Invalid prepared sync transaction.");
        sync.m_prepared = prepared;
        sync.m_state = "ready";
    }, true);
};

/**
 * Commits a verified local transaction only after navigation has settled.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_publish = function() {
    var sync = this;
    var prepared = this.m_prepared;
    this.m_run("publishing", function() {
        return Promise.resolve(sync.m_provider.publish(prepared)).catch(function(error) {
            if (sync.m_disposed) sync.m_discard(prepared);
            throw error;
        });
    }, function() {
        sync.m_update = null;
        sync.m_prepared = null;
        sync.m_state = "refresh";
    });
};

/**
 * Reloads committed local content without publishing the transaction twice.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_refresh = function() {
    var sync = this;
    this.m_run("refreshing", function() {
        return sync.m_onPublished();
    }, function() {
        sync.m_state = "idle";
        sync.m_until = sync.m_config.intervalMs;
    });
};

/**
 * Owns one asynchronous operation and ignores cancelled or superseded results.
 *
 * @param {string} state Phase while awaiting completion.
 * @param {Function} work Provider operation.
 * @param {Function} complete Accepted-result handler.
 * @param {boolean} [discardLate=false] Whether late results own staged files.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_run = function(state, work, complete, discardLate) {
    var sync = this;
    var operation = new runeos.sync.SyncOperation();
    this.m_operation = operation;
    this.m_state = state;
    Promise.resolve().then(function() {
        operation.assertActive();
        if (sync.m_disposed) throw Error("LibrarySync is disposed.");
        return work(operation);
    }).then(function(value) {
        sync.m_completeOperation(operation, value, complete, discardLate);
    }).catch(function(error) {
        sync.m_failOperation(operation, state, error);
    });
};

/**
 * Accepts a current result or releases a late result from staged work.
 *
 * @param {runeos.sync.SyncOperation} operation Completed provider operation.
 * @param {Object|undefined} value Provider result, absent for a completed refresh.
 * @param {Function} complete Accepted-result handler.
 * @param {boolean} [discardLate=false] Whether ignored results own staging.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_completeOperation = function(operation, value, complete, discardLate) {
    if (this.m_isIgnored(operation)) {
        if (discardLate && value) this.m_discard(value);
        this.m_finishIgnored(operation);
        return;
    }
    operation.complete();
    complete(value);
    this.m_operation = null;
    this.m_error = null;
};

/**
 * Records a current failure without changing state for superseded operations.
 *
 * @param {runeos.sync.SyncOperation} operation Failed provider operation.
 * @param {string} state Phase that failed.
 * @param {*} error Provider or accepted-result failure.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_failOperation = function(operation, state, error) {
    if (this.m_isIgnored(operation)) {
        this.m_finishIgnored(operation);
        return;
    }
    operation.complete();
    this.m_operation = null;
    this.m_requested = false;
    this.m_error = error instanceof Error ? error : new Error(String(error));
    this.m_retry(state);
    console.warn("Library sync: " + error.message);
};

/**
 * Checks whether an operation no longer owns synchronization state.
 *
 * @param {runeos.sync.SyncOperation} operation Provider operation.
 *
 * @returns {boolean} Whether disposal, replacement or cancellation invalidates the result.
 * @private
 */
runeos.sync.LibrarySync.prototype.m_isIgnored = function(operation) {
    return this.m_disposed || operation !== this.m_operation || operation.cancelled;
};

/**
 * Schedules a retry, preserving a published snapshot when only refresh failed.
 *
 * @param {string} state Phase that failed.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_retry = function(state) {
    if (state === "refreshing") this.m_state = "refresh";
    else {
        this.m_discard(this.m_prepared);
        this.m_update = null;
        this.m_prepared = null;
        this.m_state = "idle";
    }
    this.m_until = this.m_config.retryMs;
};

/**
 * Waits for cancelled work to settle before allowing a replacement operation.
 *
 * @param {runeos.sync.SyncOperation} operation Settled ignored operation.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_finishIgnored = function(operation) {
    operation.complete();
    if (operation !== this.m_operation) return;
    this.m_operation = null;
    if (this.m_state === "pausing") this.m_state = this.m_update ? "available" : "idle";
};

/**
 * Asks the provider to release unused staging without unhandled rejections.
 *
 * @param {Object} prepared Unused local transaction, or null.
 *
 * @returns {undefined}
 * @private
 */
runeos.sync.LibrarySync.prototype.m_discard = function(prepared) {
    if (!prepared) return;
    var provider = this.m_provider;
    Promise.resolve().then(function() { return provider.discard(prepared); }).catch(function(error) {
        console.warn("Sync staging cleanup: " + error.message);
    });
};
