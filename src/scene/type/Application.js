//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Application instance.
 *
 * @constructor
 * @extends runeos.scene.Scene
 *
 * @param {string} [source="./rtest.js"] Executable application bundle URL.
 * @param {runeos.scene.Scene} [returnScene] Scene restored if loading or execution fails.
 * @param {runeos.scene.Application.Options} [options] Optional input and loading settings.
 *
 * @class
 * @classdesc
 *
 * Loads and drives a Rune application while it owns the shared screen output.
 */
runeos.scene.Application = function(source, returnScene, options) {
    options = options || {};
    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    runeos.scene.Scene.call(this);
    this.renderToScreen = false;

    //--------------------------------------------------------------------------
    // Protected properties
    //--------------------------------------------------------------------------

    /**
     * Immutable input settings used by this component.
     *
     * @type {Object}
     * @protected
     */
    this.m_config = runeos.system.Config.getGroup("input", options.config);

    /**
     * Application bundle URL.
     *
     * @type {string}
     * @protected
     */
    this.m_source = runeos.util.Paths.resolve(source || "./rtest.js");

    /**
     * Scene restored on failure, preserving its selection.
     *
     * @type {runeos.scene.Scene}
     * @protected
     */
    this.m_returnScene = returnScene || null;

    /**
     * Running application instance.
     *
     * @type {?{tick:(Function|undefined), stop:(Function|undefined), m_time:(Object|undefined), m_screen:(Object|undefined), m_callback:(Function|undefined)}}
     * @protected
     */
    this.m_app = null;

    /**
     * Whether execution has failed or been disposed.
     *
     * @type {boolean}
     * @protected
     */
    this.m_finished = false;

    /**
     * Event subscriptions owned by this execution session.
     *
     * @type {runeos.util.EventBindings}
     * @protected
     */
    this.m_events = new runeos.util.EventBindings();

    /**
     * Whether exit shortcuts may be sampled in the focused window.
     *
     * @type {boolean}
     * @protected
     */
    this.m_gamepadFocused = true;

    /**
     * Whether this application scene offers the game exit shortcut reminder.
     *
     * @type {boolean}
     * @protected
     */
    this.m_showExitHint = true;

    /**
     * Whether this application returns to Launcher after inactivity.
     *
     * @type {boolean}
     * @protected
     */
    this.m_exitOnIdle = true;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Owned passive inactivity process.
     *
     * @type {runeos.application.ApplicationIdle}
     * @private
     */
    this.m_idle = new runeos.application.ApplicationIdle(
        runeos.system.Config.getGroup("applicationIdle", options.idleConfig),
        new runeos.input.Activity({gamepadConfig: this.m_config})
    );

    /**
     * Owned inactivity warning.
     *
     * @type {runeos.ui.GameMessage}
     * @private
     */
    this.m_idleMessage = null;

    /**
     * Exit feedback settings, separate from input timing and application output.
     *
     * @type {Object}
     * @private
     */
    this.m_exitIndicatorConfig = runeos.system.Config.getGroup("exitIndicator", options.exitIndicatorConfig);

    /**
     * Owned canvas indicator, created only after a hold passes its display delay.
     *
     * @type {runeos.ui.HoldIndicator}
     * @private
     */
    this.m_exitIndicator = null;

    /**
     * Short game-start reminder, created on the first visible game frame.
     *
     * @type {runeos.ui.ExitHint}
     * @private
     */
    this.m_exitHint = null;

    /**
     * Borrowed application identity used only for incident diagnostics.
     *
     * @type {Object}
     * @private
     */
    this.m_metadata = options.metadata || null;

    /**
     * Immutable loading settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_loadingConfig = runeos.system.Config.getGroup("loading", options.loadingConfig);

    /**
     * Application-relative resource scope, retained until shutdown completes.
     *
     * @type {runeos.util.ResourceBase}
     * @private
     */
    this.m_resourceBase = null;

    /**
     * Pending source request.
     *
     * @type {?(XMLHttpRequest|Object)}
     * @private
     */
    this.m_request = null;

    /**
     * File transport owning source-request cancellation and cleanup.
     *
     * @type {runeos.util.FileLoader}
     * @private
     */
    this.m_files = new runeos.util.FileLoader({config: this.m_loadingConfig});

    /**
     * Short failure message delivered after application shutdown completes.
     *
     * @type {string}
     * @private
     */
    this.m_failureMessage = "";

    /**
     * Whether this scene has registered its exit shortcut listeners.
     *
     * @type {boolean}
     * @private
     */
    this.m_exitBound = false;

    /**
     * Application namespace registered by this execution session.
     *
     * @type {Object}
     * @private
     */
    this.m_namespace = null;

    /**
     * Newly exported application globals owned by this session.
     *
     * @type {Array.<string>}
     * @private
     */
    this.m_exports = [];

    /**
     * Legacy stop verification timer, cleared when shutdown completes.
     *
     * @type {?number}
     * @private
     */
    this.m_stopTimer = null;

    /**
     * Completion callbacks waiting for asynchronous application shutdown.
     *
     * @type {Array.<Function>}
     * @private
     */
    this.m_onStopped = [];

    /**
     * Whether all session resources have been released.
     *
     * @type {boolean}
     * @private
     */
    this.m_stopped = false;

    /**
     * Hold progress per controller slot; never retains native Gamepad objects.
     *
     * @type {Array.<Object>}
     * @private
     */
    this.m_gamepadHolds = [];

    /**
     * Elapsed Escape hold in milliseconds; null while the key is released.
     *
     * @type {?number}
     * @private
     */
    this.m_escapeElapsed = null;
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.scene.Application.prototype = Object.create(runeos.scene.Scene.prototype);
runeos.scene.Application.prototype.constructor = runeos.scene.Application;

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Optional constructor settings and configuration overrides.
 *
 * @typedef {{
 *     config: (Object|undefined),
 *     idleConfig: (Object|undefined),
 *     exitIndicatorConfig: (Object|undefined),
 *     loadingConfig: (Object|undefined),
 *     metadata: (Object|undefined)
 * }}
 */
runeos.scene.Application.Options;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * OS stage to display while source loading is delayed. Input remains suspended.
 *
 * @member {runeos.display.Stage} loadingStage
 * @memberof runeos.scene.Application
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Application.prototype, "loadingStage", {
    /**
     * @this runeos.scene.Application
     * @returns {runeos.display.Stage}
     * @ignore
     */
    get : function() {
        var indicator = this.m_returnScene && this.m_returnScene.launchIndicator;
        return !this.m_finished && !this.m_app && indicator && indicator.visible ? this.m_returnScene["stage"] : null;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Cancels loading or stops the running application before returning to
 * Launcher.
 * Repeated exit requests cannot stop the application more than once.
 *
 * @param {Function} [onStopped] Optional continuation for an explicit scene change.
 *
 * @returns {undefined}
 */
runeos.scene.Application.prototype.exit = function(onStopped) {
    if (typeof onStopped === "function") {
        if (this.m_stopped) {
            onStopped();
            return;
        }
        this.m_onStopped.push(onStopped);
    }
    if (this.m_finished) return;
    this.m_prepareExit();
    this.m_stopApplication();
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Starts loading only after the scene has been selected.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Application.prototype.init = function() {
    if (this.m_finished) return;
    if (this.m_exitOnIdle) this.m_idle.start();
    this.m_bindEvents();
    if (!this.m_request && !this.m_app) this.m_fetchSourceCode();
};

/**
 * Samples the host exit shortcut before driving the application's render loop.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Application.prototype.update = function(step) {
    if (this.m_finished) return;
    if (this.m_exitIndicator) this.m_exitIndicator.restore();
    if (this.m_idleMessage) this.m_idleMessage.restore();
    if (this.m_exitHint) {
        this.m_exitHint.restore();
        this.m_exitHint.update(step, this.m_getExitHoldTime() > 0);
    }
    if (this.m_updateEscapeExit(step) || this.m_updateGamepadExit(step)) {
        this.exit();
        return;
    }
    this.m_updateExitIndicator();
    if (!this.m_app) {
        var indicator = this.m_returnScene && this.m_returnScene.launchIndicator;
        if (indicator) indicator.update(step);
        return;
    }
    if (this.m_updateIdle(step)) return;
    try {
        if (typeof this.m_app.tick === "function") {
            this.m_app.tick();
        } else if (this.m_app.m_time) {
            // Compatibility with bundles built before the public hosted tick API.
            this.m_app.m_time.m_tick();
        }
    } catch (error) {
        this.m_fail(error);
    }
};

/**
 * Draws exit feedback after application or loading-stage rendering has finished.
 *
 * @param {runeos.display.Canvas} canvas Shared output canvas.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Application.prototype.render = function(canvas) {
    if (((this.m_exitHint && this.m_exitHint.visible) || this.m_idleMessage) && this.m_exitIndicator) this.m_exitIndicator.restore();
    if (this.m_idleMessage) this.m_idleMessage.restore();
    if (this.m_exitHint) this.m_exitHint.restore();
    if (this.m_finished) return;
    if (this.m_showExitHint && this.m_app && this.m_exitHint) this.m_exitHint.render(canvas);
    if (this.m_idleMessage) this.m_idleMessage.render(canvas);
    if (this.m_exitIndicator) this.m_exitIndicator.render(canvas);
};

/**
 * Stops execution before the scene manager activates a replacement scene.
 *
 * @param {Function} onStopped Called after shutdown and cleanup have completed.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Application.prototype.leave = function(onStopped) {
    this.exit(onStopped);
};

/**
 * Stops execution and completes final cleanup without choosing a return scene.
 * Repeated requests wait for the same shutdown. Screensaver inherits this path.
 *
 * @param {Function} [onDisposed] Called after application shutdown and cleanup.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Application.prototype.dispose = function(onDisposed) {
    this.exit(function() {
        if (typeof onDisposed === "function") onDisposed();
    });
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Attaches host input and focus listeners once for this application's lifetime.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_bindEvents = function() {
    if (this.m_exitBound) return;
    this.m_exitBound = true;
    this.m_events.add(window, "keydown", this.m_onKeyDown.bind(this), true);
    this.m_events.add(window, "keyup", this.m_onKeyUp.bind(this), true);
    this.m_events.add(window, "blur", this.m_onBlur.bind(this));
    this.m_events.add(window, "focus", this.m_onFocus.bind(this));
};

/**
 * Starts the host exit hold without forwarding Escape to the running application.
 *
 * @param {KeyboardEvent} event Host keyboard event.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_onKeyDown = function(event) {
    if (!this.m_isActive() || (event.key !== "Escape" && event.code !== "Escape" && event.keyCode !== 27)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.m_gamepadFocused || event.repeat) return;
    if (this.m_escapeElapsed === null) this.m_escapeElapsed = 0;
};

/**
 * Cancels the host exit hold when Escape is released.
 *
 * @param {KeyboardEvent} event Host keyboard event.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_onKeyUp = function(event) {
    if (!this.m_isActive() || (event.key !== "Escape" && event.code !== "Escape" && event.keyCode !== 27)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.m_escapeElapsed = null;
    this.m_updateExitIndicator();
};

/**
 * Suspends exit input and clears held shortcuts when the window loses focus.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_onBlur = function() {
    this.m_gamepadFocused = false;
    this.m_resetExitHolds();
};

/**
 * Resumes exit input with fresh hold timing when the window regains focus.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_onFocus = function() {
    this.m_gamepadFocused = true;
    this.m_resetExitHolds();
};

/**
 * Removes input, exit feedback and pending file loading before stopping execution.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_prepareExit = function() {
    this.m_finished = true;
    this.m_idle.dispose();
    if (this.m_exitIndicator) this.m_exitIndicator.restore();
    if (this.m_idleMessage) this.m_idleMessage.dispose();
    this.m_idleMessage = null;
    if (this.m_exitHint) this.m_exitHint.dispose();
    this.m_exitHint = null;
    this.m_events.dispose();
    this.m_resetExitHolds();
    if (this.m_exitIndicator) this.m_exitIndicator.dispose();
    this.m_exitIndicator = null;
    this.m_request = null;
    this.m_files.dispose();
};

/**
 * Stops execution once and completes cleanup after the SDK releases the screen.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_stopApplication = function() {
    var scene = this;
    var app = this.m_app;
    this.m_app = null;
    var restored = false;
    function restore() {
        if (restored) return;
        restored = true;
        if (scene.m_stopTimer !== null) {
            window.clearTimeout(scene.m_stopTimer);
            scene.m_stopTimer = null;
        }
        // Older SDK stop() stores its callback but never releases it.
        if (app && app.m_callback === restore) app.m_callback = null;
        scene.m_finishExit();
    }
    if (app && typeof app.stop === "function") {
        try {
            app.stop(restore);
            // Older SDK bundles dispose asynchronously but never invoke stop's callback.
            // Check after their queued disposal, before reclaiming the shared screen.
            if (!restored) {
                scene.m_waitForLegacyStop(app, restore);
            }
        } catch (error) {
            restore();
        }
    } else {
        restore();
    }
};

/**
 * Supports older SDK bundles that dispose asynchronously without calling back.
 *
 * @param {Object} app Application being stopped.
 * @param {Function} restore Shared once-only completion callback.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_waitForLegacyStop = function(app, restore) {
    var scene = this;
    this.m_stopTimer = window.setTimeout(function() {
        scene.m_stopTimer = null;
        if (app.m_time === null && app.m_screen === null) restore();
    }, 0);
};

/**
 * Releases owned resources before completing callbacks or returning to a scene.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_finishExit = function() {
    this.m_releaseApplication();
    var destination = this.m_returnScene;
    this.m_returnScene = null;
    this.m_stopped = true;
    var callbacks = this.m_onStopped;
    this.m_onStopped = [];
    if (callbacks.length > 0) {
        for (var i = 0; i < callbacks.length; i++) callbacks[i]();
    } else {
        this.m_returnToScene(destination);
    }
};

/**
 * Returns only if this application still owns the active scene.
 *
 * @param {runeos.scene.Scene} destination Previous scene, or null for Launcher.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_returnToScene = function(destination) {
    if (runeos.instance.scenes.current !== this) return;
    destination = destination || new runeos.scene.Launcher();
    runeos.instance.scenes.swap(destination);
    if (this.m_failureMessage && typeof destination.showError === "function") destination.showError(this.m_failureMessage);
};

/**
 * Updates the passive warning and uses the normal exit workflow on expiry.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {boolean}
 * @private
 */
runeos.scene.Application.prototype.m_updateIdle = function(step) {
    if (!this.m_exitOnIdle) return false;
    if (this.m_idle.update(step)) {
        this.exit();
        return true;
    }
    var remaining = this.m_idle["remaining"];
    if (!remaining) {
        if (this.m_idleMessage) this.m_idleMessage.dispose();
        this.m_idleMessage = null;
        return false;
    }
    if (this.m_exitHint) this.m_exitHint.dispose();
    if (!this.m_idleMessage) {
        this.m_idleMessage = new runeos.ui.GameMessage(runeos.system.Config.getGroup("notifications"),
            runeos.system.Config.getGroup("text").bodySizePx);
    }
    this.m_idleMessage.show(runeos.system.Config.getGroup("notifications").idleWarning.replace("{seconds}", String(remaining)));
    return false;
};

/**
 * Fetches the selected bundle, handling network, HTTP and compilation failures.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_fetchSourceCode = function() {
    var scene = this;
    try {
        var request = this.m_files.text(this.m_source, function(source) {
            scene.m_request = null;
            if (!scene.m_isActive()) return;
            if (!source) {
                scene.m_fail(new Error("Unable to load application: " + scene.m_source));
                return;
            }
            try {
                scene.m_boot(new Function(source));
            } catch (error) {
                scene.m_fail(error);
            }
        }, function(error) {
            scene.m_request = null;
            if (scene.m_isActive()) scene.m_fail(error);
        });
        // open/send failures can complete synchronously before text() returns.
        if (!this.m_finished && this.m_files["length"] > 0) this.m_request = request;
    } catch (error) {
        this.m_request = null;
        this.m_fail(error);
    }
};

/**
 * Executes a bundle and starts the application registered through
 * runeos.install.
 *
 * @param {Function} exec Compiled application bundle.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_boot = function(exec) {
    this.m_prepareBoot();
    this.m_execute(exec);
    this.m_startRegistered();
};

/**
 * Hides launch progress and selects the bundle's resource directory.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_prepareBoot = function() {
    if (this.m_exitOnIdle) this.m_idle.start();
    var indicator = this.m_returnScene && this.m_returnScene.launchIndicator;
    if (indicator) indicator.hide();
    this.m_resourceBase = new runeos.util.ResourceBase(runeos.util.Paths.directory(this.m_source));
};

/**
 * Executes the bundle and tracks its registration even when execution fails.
 *
 * @param {Function} exec Compiled application bundle.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_execute = function(exec) {
    runeos.app = null;
    var previousGlobals = Object.getOwnPropertyNames(window);
    try {
        exec();
    } finally {
        this.m_captureExports(previousGlobals);
    }
};

/**
 * Records newly introduced globals owned by the registered application namespace.
 *
 * @param {Array.<string>} previousGlobals Global names present before bundle execution.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_captureExports = function(previousGlobals) {
    this.m_namespace = runeos.app;
    var globals = Object.getOwnPropertyNames(window);
    for (var i = 0; i < globals.length; i++) {
        var name = globals[i];
        var descriptor = Object.getOwnPropertyDescriptor(window, name);
        if (previousGlobals.indexOf(name) === -1 && descriptor &&
            descriptor.value === this.m_namespace && this.m_namespace !== null) {
            this.m_exports.push(name);
        }
    }
};

/**
 * Starts the registered application and initializes the post-start exit hint.
 *
 * @returns {undefined}
 * @throws {Error} When registration or the returned application instance is missing.
 * @private
 */
runeos.scene.Application.prototype.m_startRegistered = function() {
    if (!runeos.app || typeof runeos.app.bootstrap !== "function") {
        throw new Error("Application bundle did not register a bootstrap function.");
    }
    this.m_app = runeos.app.bootstrap(function() {});
    if (!this.m_app) throw new Error("Application bootstrap returned no instance.");
    this.m_idle.reset();
    if (this.m_showExitHint) {
        this.m_exitHint = new runeos.ui.ExitHint(runeos.system.Config.getGroup("notifications"),
            runeos.system.Config.getGroup("text").bodySizePx);
    }
};

/**
 * Checks whether asynchronous work still belongs to the active scene.
 *
 * @returns {boolean} Whether this execution scene is active.
 * @protected
 */
runeos.scene.Application.prototype.m_isActive = function() {
    return !this.m_finished && runeos.instance.scenes.current === this;
};

/**
 * Stops a failed application before restoring the launcher and its shared
 * canvas.
 *
 * @param {Error} error Loading or execution error.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_fail = function(error) {
    if (this.m_finished) return;
    var messages = runeos.system.Config.getGroup("notifications");
    this.m_failureMessage = this.m_app ? messages.runtimeError : messages.startError;
    runeos.application.ApplicationLog.write(error, this.m_metadata, this.m_source, this.m_app ? "runtime" : "startup");
    console.warn("Application execution failed:", error);
    this.exit();
};

/**
 * Releases application registration, owned exports and unused Application display
 * state.
 * Existing globals or globals replaced by another owner are preserved.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_releaseApplication = function() {
    if (this.m_resourceBase) this.m_resourceBase.dispose();
    this.m_resourceBase = null;
    for (var i = 0; i < this.m_exports.length; i++) {
        var name = this.m_exports[i];
        var descriptor = Object.getOwnPropertyDescriptor(window, name);
        if (descriptor && descriptor.configurable && descriptor.value === this.m_namespace) {
            delete window[name];
        }
    }
    this.m_exports.length = 0;
    if (runeos.app === this.m_namespace) runeos.app = null;
    this.m_namespace = null;
    this.m_metadata = null;
    runeos.scene.Scene.prototype.dispose.call(this);
};

/**
 * Clears keyboard and controller progress when focus or execution changes.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_resetExitHolds = function() {
    this.m_escapeElapsed = null;
    this.m_gamepadHolds.length = 0;
    if (this.m_exitIndicator) this.m_exitIndicator.hide();
};

/**
 * Detects Escape held continuously for the configured exit duration.
 * Repeated keydown events do not restart the hold; keyup and focus changes do.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {boolean} Whether the keyboard exit hold is complete.
 * @private
 */
runeos.scene.Application.prototype.m_updateEscapeExit = function(step) {
    if (!this.m_gamepadFocused || this.m_escapeElapsed === null) return false;
    if (typeof step === "number" && isFinite(step) && step > 0) this.m_escapeElapsed += step;
    return this.m_escapeElapsed >= this.m_config.exitHoldMs;
};

/**
 * Detects Select + Start held on one controller for the configured duration. This narrow
 * shortcut stays active while normal OS navigation is suspended during Application.
 * Release, disconnect, device replacement, API failure and blur reset progress.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {boolean} Whether a controller completed the hold.
 * @private
 */
runeos.scene.Application.prototype.m_updateGamepadExit = function(step) {
    if (!this.m_gamepadFocused) return false;
    var states;
    try {
        states = typeof navigator !== "undefined" && typeof navigator.getGamepads === "function" ?
            navigator.getGamepads() : [];
    } catch (error) {
        states = [];
    }
    states = states || [];
    step = typeof step === "number" && isFinite(step) ? Math.max(0, step) : 0;
    this.m_gamepadHolds.length = states.length;
    for (var i = 0; i < states.length; i++) {
        var state = states[i];
        var buttons = state && state.buttons;
        if (!state || state.connected === false || !buttons ||
            !runeos.input.Gamepad.isButtonPressed(buttons[runeos.input.Gamepad.SELECT], this.m_config.buttonThreshold) ||
            !runeos.input.Gamepad.isButtonPressed(buttons[runeos.input.Gamepad.START], this.m_config.buttonThreshold)) {
            this.m_gamepadHolds[i] = null;
            continue;
        }
        var hold = this.m_gamepadHolds[i];
        if (!hold || hold.id !== state.id) {
            // The first sample establishes the start, not an already elapsed hold.
            hold = {
                id: state.id,
                elapsed: 0
            };
            this.m_gamepadHolds[i] = hold;
        } else {
            hold.elapsed += step;
        }
        if (hold.elapsed >= this.m_config.exitHoldMs) return true;
    }
    return false;
};

/**
 * Shows only a deliberate hold, using the longest independent input duration.
 * Keyboard and different controllers never add their elapsed times together.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Application.prototype.m_updateExitIndicator = function() {
    var elapsed = this.m_getExitHoldTime();
    if (this.m_finished || !this.m_exitIndicatorConfig.enabled || elapsed <= 0 ||
        elapsed < this.m_exitIndicatorConfig.delayMs || this.m_config.exitHoldMs <= 0) {
        if (this.m_exitIndicator) this.m_exitIndicator.hide();
        return;
    }
    if (!this.m_exitIndicator) this.m_exitIndicator = new runeos.ui.HoldIndicator({config: this.m_exitIndicatorConfig});
    this.m_exitIndicator.show(elapsed / this.m_config.exitHoldMs);
};

/**
 * Finds the most advanced active shortcut without combining independent holds.
 *
 * @returns {number} Longest active hold in milliseconds.
 * @private
 */
runeos.scene.Application.prototype.m_getExitHoldTime = function() {
    var elapsed = this.m_escapeElapsed === null ? 0 : this.m_escapeElapsed;
    for (var i = 0; i < this.m_gamepadHolds.length; i++) {
        var hold = this.m_gamepadHolds[i];
        if (hold) elapsed = Math.max(elapsed, hold.elapsed);
    }
    return elapsed;
};
