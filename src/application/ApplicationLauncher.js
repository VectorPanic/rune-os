//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ApplicationLauncher instance.
 *
 * @constructor
 *
 * @param {Object} [options] Return scene and optional state-change callback.
 *
 * @class
 * @classdesc
 *
 * Owns application/saver preparation, duplicate protection and cancellation.
 * Requests supply the library and scene manager; presentation is reported through
 * a callback, with no dependency on Launcher, input, audio or global OS state.
 */
runeos.application.ApplicationLauncher = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Scene restored by the created execution scene.
     *
     * @type {runeos.scene.Scene}
     * @private
     */
    this.m_returnScene = options.returnScene || null;

    /**
     * Optional presentation observer receiving state, request and error.
     *
     * @type {Function}
     * @private
     */
    this.m_onChange = options.onChange || null;

    /**
     * Accepted immutable request, retained through execution handoff.
     *
     * @type {Object}
     * @private
     */
    this.m_request = null;

    /**
     * Current phase: idle, preparing, starting or suspended.
     *
     * @type {string}
     * @private
     */
    this.m_state = "idle";

    /**
     * Invalidates superseded asynchronous results.
     *
     * @type {number}
     * @private
     */
    this.m_generation = 0;

    /**
     * Whether new requests are accepted.
     *
     * @type {boolean}
     * @private
     */
    this.m_enabled = true;

    /**
     * Latest accepted launch failure.
     *
     * @type {Error}
     * @private
     */
    this.m_error = null;

    /**
     * Permanent teardown flag.
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
 * Accepted launch request, or null.
 *
 * @member {Object} request
 * @memberof runeos.application.ApplicationLauncher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.application.ApplicationLauncher.prototype, "request", {
    /**
     * @this runeos.application.ApplicationLauncher
     * @returns {Object}
     * @ignore
     */
    get : function() {
        return this.m_request;
    }
});

/**
 * Current phase, including disposed after teardown.
 *
 * @member {string} state
 * @memberof runeos.application.ApplicationLauncher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.application.ApplicationLauncher.prototype, "state", {
    /**
     * @this runeos.application.ApplicationLauncher
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_disposed ? "disposed" : this.m_state;
    }
});

/**
 * Whether asynchronous content preparation is pending.
 *
 * @member {boolean} preparing
 * @memberof runeos.application.ApplicationLauncher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.application.ApplicationLauncher.prototype, "preparing", {
    /**
     * @this runeos.application.ApplicationLauncher
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_state === "preparing";
    }
});

/**
 * Whether preparation or execution handoff owns the launch slot.
 *
 * @member {boolean} busy
 * @memberof runeos.application.ApplicationLauncher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.application.ApplicationLauncher.prototype, "busy", {
    /**
     * @this runeos.application.ApplicationLauncher
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_state === "preparing" || this.m_state === "starting";
    }
});

/**
 * Whether the accepted request is an automatic screensaver.
 *
 * @member {boolean} automatic
 * @memberof runeos.application.ApplicationLauncher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.application.ApplicationLauncher.prototype, "automatic", {
    /**
     * @this runeos.application.ApplicationLauncher
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return !!this.m_request && this.m_request.kind === "screensaver";
    }
});

/**
 * Latest preparation or handoff error, or null.
 *
 * @member {Error} error
 * @memberof runeos.application.ApplicationLauncher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.application.ApplicationLauncher.prototype, "error", {
    /**
     * @this runeos.application.ApplicationLauncher
     * @returns {Error}
     * @ignore
     */
    get : function() {
        return this.m_error;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Accepts one named request and starts preparation or direct execution.
 *
 * @param {Object} request Source, optional id/library, scenes, kind and shared metadata.
 *
 * @returns {boolean}
 */
runeos.application.ApplicationLauncher.prototype.launch = function(request) {
    if (!this.m_canLaunch(request)) return false;
    var accepted = this.m_acceptRequest(request);

    try {
        this.m_begin(accepted, this.m_generation);
    } catch (error) {
        this.m_fail(error, accepted);
    }

    return true;
};

/**
 * Invalidates pending preparation without taking ownership of library resources.
 *
 * @returns {boolean}
 */
runeos.application.ApplicationLauncher.prototype.cancel = function() {
    if (this.m_disposed || !this["preparing"]) return false;
    var request = this.m_request;
    this.m_generation++;
    this.m_request = null;
    this.m_state = this.m_enabled ? "idle" : "suspended";
    this.m_notify("cancelled", request);
    return true;
};

/**
 * Cancels pending preparation only when it belongs to a screensaver.
 *
 * @returns {boolean}
 */
runeos.application.ApplicationLauncher.prototype.cancelAutomatic = function() {
    return this.automatic && this.cancel();
};

/**
 * Rejects new launches on scene departure, preserving an active handoff status.
 *
 * @returns {undefined}
 */
runeos.application.ApplicationLauncher.prototype.suspend = function() {
    if (this.m_disposed) return;
    this.m_enabled = false;
    if (!this.cancel() && this.m_state !== "starting") this.m_state = "suspended";
};

/**
 * Starts a fresh launch session when the return scene becomes active again.
 *
 * @returns {undefined}
 */
runeos.application.ApplicationLauncher.prototype.resume = function() {
    if (this.m_disposed) return;
    this.m_generation++;
    this.m_request = null;
    this.m_error = null;
    this.m_enabled = true;
    this.m_state = "idle";
};

/**
 * Invalidates pending work and releases scene/presentation references.
 *
 * @returns {undefined}
 */
runeos.application.ApplicationLauncher.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_generation++;
    this.m_error = null;
    this.m_onChange = null;
    this.m_returnScene = null;
    this.m_request = null;
    this.m_enabled = false;
    this.m_state = "idle";
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Checks whether this session can accept the supplied launch request.
 *
 * @param {Object} request Proposed request.
 *
 * @returns {boolean}
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_canLaunch = function(request) {
    if (this.m_disposed || !this.m_enabled || this.busy || !request) return false;
    if (typeof request.source !== "string" || !request.source.trim()) return false;
    var kind = request.kind || "application";
    return ["application", "screensaver"].indexOf(kind) >= 0 && !!request.scenes;
};

/**
 * Freezes the accepted request and opens a new preparation session.
 *
 * @param {Object} request Valid launch request.
 *
 * @returns {Object} Accepted immutable request.
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_acceptRequest = function(request) {
    this.m_request = Object.freeze({
        source: request.source,
        id: request.id,
        library: request.library,
        scenes: request.scenes,
        kind: request.kind || "application",
        data: request.data
    });
    this.m_error = null;
    this.m_generation++;
    this.m_state = "preparing";
    return this.m_request;
};

/**
 * Reports acceptance before preparing library content or starting a direct source.
 *
 * @param {Object} request Accepted request.
 * @param {number} generation Generation captured on acceptance.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_begin = function(request, generation) {
    this.m_notify("accepted", request);
    if (!this.m_isCurrentRequest(request, generation) || !this["preparing"]) return;

    if (request.library && request.id) {
        this.m_prepare(request, generation);
    } else {
        this.m_start(request.source, request);
    }
};

/**
 * Delegates content preparation and rejects late or no-longer-current results.
 *
 * @param {Object} request Accepted request.
 * @param {number} generation Generation captured on acceptance.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_prepare = function(request, generation) {
    var launcher = this;
    Promise.resolve().then(function() {
        if (!launcher.m_acceptResult(request, generation)) return null;
        return request.kind === "screensaver" ? request.library.prepareScreensaver(request.id) : request.library.prepareGame(request.id);
    }).then(function(source) {
        if (launcher.m_acceptResult(request, generation)) launcher.m_start(source, request);
    }).catch(function(error) {
        if (launcher.m_isCurrentRequest(request, generation)) launcher.m_fail(error, request);
    });
};

/**
 * Checks whether a result still belongs to this launch session.
 *
 * @param {Object} request Original request.
 * @param {number} generation Original generation.
 *
 * @returns {boolean}
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_isCurrentRequest = function(request, generation) {
    return !this.m_disposed && this.m_request === request && generation === this.m_generation;
};

/**
 * Checks generation, request identity and ownership before asynchronous effects.
 *
 * @param {Object} request Request producing a result.
 * @param {number} generation Captured generation.
 *
 * @returns {boolean}
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_acceptResult = function(request, generation) {
    if (!this.m_isCurrentRequest(request, generation) || !this["preparing"]) return false;
    if (request.scenes.current === this.m_returnScene) return true;
    this.cancel();
    return false;
};

/**
 * Validates the prepared URL and creates the appropriate execution scene.
 *
 * @param {string} source Ready executable URL.
 * @param {Object} request Accepted request.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_start = function(source, request) {
    runeos.util.Validation.validatePath(source, "prepared binary");
    this.m_state = "starting";
    this.m_notify("ready", request);
    if (this.m_disposed || this.m_request !== request) return;
    request.scenes.swap(this.m_createScene(source, request));
};

/**
 * Creates the execution scene for the requested application type.
 *
 * @param {string} source Validated executable URL.
 * @param {Object} request Accepted request.
 *
 * @returns {runeos.scene.Scene}
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_createScene = function(source, request) {
    if (request.kind === "screensaver") {
        return new runeos.scene.Screensaver(source, this.m_returnScene, {metadata: request.data});
    }

    return new runeos.scene.Application(source, this.m_returnScene, {metadata: request.data});
};

/**
 * Releases the launch slot and reports a retryable failure to presentation.
 *
 * @param {*} error Preparation or handoff rejection reason.
 * @param {Object} request Failed request.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_fail = function(error, request) {
    if (this.m_disposed || this.m_request !== request) return;
    this.m_generation++;
    var failure = error instanceof Error ? error : new Error(String(error));
    this.m_error = failure;
    this.m_request = null;
    this.m_state = this.m_enabled ? "idle" : "suspended";
    runeos.application.ApplicationLog.write(failure, request.data, request.source, "preparation");
    console.warn("Application launch: " + failure.message);
    this.m_notify("failed", request, failure);
};

/**
 * Reports presentation events without depending on a specific UI or scene.
 *
 * @param {string} state Accepted, ready, cancelled or failed.
 * @param {Object} request Associated request.
 * @param {Error} [error] Failure when applicable.
 *
 * @returns {undefined}
 * @private
 */
runeos.application.ApplicationLauncher.prototype.m_notify = function(state, request, error) {
    if (this.m_onChange) this.m_onChange(state, request, error);
};
