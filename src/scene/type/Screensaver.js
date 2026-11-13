//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Screensaver instance.
 *
 * @constructor
 * @extends runeos.scene.Application
 *
 * @param {string} source Executable bundle URL.
 * @param {runeos.scene.Scene} returnScene Scene restored on wake or failure.
 * @param {runeos.scene.Screensaver.Options} [options] Execution settings, metadata and credit presentation.
 *
 * @class
 * @classdesc
 *
 * Executes a Rune application using the normal shared-canvas lifecycle, but
 * consumes wake input and stops before returning control to the same Launcher.
 */
runeos.scene.Screensaver = function(source, returnScene, options) {

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    runeos.scene.Application.call(this, source, returnScene, options);
    this.m_showExitHint = false;
    this.m_exitOnIdle = false;

    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Whether wake listeners have already been registered.
     *
     * @type {boolean}
     * @private
     */
    this.m_wakeBound = false;

    /**
     * Whether user input has already requested a covered departure.
     *
     * @type {boolean}
     * @private
     */
    this.m_waking = false;

    /**
     * Whether the hosted application has completed an update.
     *
     * @type {boolean}
     * @private
     */
    this.m_hasFrame = false;

    /**
     * Time since the hosted output became ready.
     *
     * @type {number}
     * @private
     */
    this.m_arrivalElapsed = 0;

    /**
     * Delay covering arrival and a short quiet interval before attribution.
     *
     * @type {number}
     * @private
     */
    this.m_arrivalDelay = runeos.system.Config.getGroup("screensaverTransition").revealMs +
        runeos.system.Config.getGroup("screensaverTransition").creditsDelayMs;

    /**
     * Attribution copied from the screensaver metadata, independent of its owner.
     *
     * @type {string}
     * @private
     */
    this.m_creditsText = "";

    /**
     * Immutable attribution settings.
     *
     * @type {Object}
     * @private
     */
    this.m_creditsConfig = runeos.system.Config.getGroup("screensaverCredits", options.creditsConfig);

    /**
     * Owned timed message, allocated on the first application render.
     *
     * @type {runeos.ui.Notification}
     * @private
     */
    this.m_credits = null;

    /**
     * Logical font size used by the current message, recalculated after resizing.
     *
     * @type {number}
     * @private
     */
    this.m_creditsFontSize = 0;

    /**
     * Attribution time since its first rendered frame, preserved across resizing.
     *
     * @type {number}
     * @private
     */
    this.m_creditsElapsed = 0;

    /**
     * Owned pixel restoration shared with other in-application feedback.
     *
     * @type {runeos.display.CanvasRegion}
     * @private
     */
    this.m_creditsRegion = null;

    /**
     * Independent running-time policy and replacement preparation.
     *
     * @type {runeos.application.ScreensaverRotation}
     * @private
     */
    this.m_rotation = new runeos.application.ScreensaverRotation({
        library: runeos.instance && runeos.instance.library,
        currentId: options.metadata ? runeos.catalog.ScreensaverRegistry.getId(options.metadata) : this.m_source,
        intervalMs: runeos.system.Config.getGroup("screensaverTransition").rotationIntervalMs,
        onReady: this.m_rotate.bind(this),
        onError: this.m_rotationFailed.bind(this)
    });

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.scene.Screensaver.prototype = Object.create(runeos.scene.Application.prototype);
runeos.scene.Screensaver.prototype.constructor = runeos.scene.Screensaver;

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Optional constructor settings and configuration overrides.
 *
 * @typedef {{
 *     config: (Object|undefined),
 *     exitIndicatorConfig: (Object|undefined),
 *     loadingConfig: (Object|undefined),
 *     creditsConfig: (Object|undefined),
 *     metadata: (Object|undefined)
 * }}
 */
runeos.scene.Screensaver.Options;

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Installs wake listeners before the application can register its own input.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Screensaver.prototype.init = function() {
    if (this.m_finished) return;
    if (this.m_wakeBound) {
        runeos.scene.Application.prototype.init.call(this);
        return;
    }
    this.m_wakeBound = true;
    var scene = this;
    var wake = function(event) {
        if (!scene.m_isActive()) return;
        if (event.preventDefault) event.preventDefault();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        scene.m_wake();
    };
    ["keydown", "pointerdown", "pointermove", "wheel"].forEach(function(type) {
        scene.m_events.add(window, type, wake, true);
    });
    // Wake input takes precedence over Application's held Escape shortcut.
    runeos.scene.Application.prototype.init.call(this);
};

/**
 * Wakes on any controller before driving the application's next frame.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Screensaver.prototype.update = function(step) {
    if (this.m_finished) return;
    if (this.m_creditsRegion) this.m_creditsRegion.restore();
    if (this.m_hasControllerActivity()) {
        this.m_wake();
        return;
    }
    runeos.scene.Application.prototype.update.call(this, step);
    if (this.m_app && !this.m_waking) this.m_hasFrame = true;
    if (this.m_hasFrame) this.m_arrivalElapsed += Math.max(0, step || 0);
    this.m_updateCredits(step);
    if (this.m_hasFrame && !this.m_waking) this.m_rotation.update(step);
};

/**
 * Draws attribution after the screensaver has produced its frame.
 *
 * @param {runeos.display.Canvas} canvas Shared output canvas.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Screensaver.prototype.render = function(canvas) {
    runeos.scene.Application.prototype.render.call(this, canvas);
    if (this.m_hasFrame && !this.m_waking && runeos.instance.screenFade) runeos.instance.screenFade.reveal();
    if (this.m_waking && !this.m_credits) return;
    if (runeos.instance.screenFade && this.m_arrivalElapsed < this.m_arrivalDelay) return;
    if (this.m_finished || !this.m_app || !this.m_creditsText || !this.m_creditsConfig.enabled ||
        this.m_creditsElapsed >= this.m_creditsConfig.fadeInMs + this.m_creditsConfig.holdMs + this.m_creditsConfig.fadeOutMs) return;
    this.m_renderCredits(canvas);
};

/**
 * Restores attribution pixels before stopping the borrowed application output.
 *
 * @param {Function} [onStopped] Optional scene-change continuation.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Screensaver.prototype.exit = function(onStopped) {
    this.m_rotation.dispose();
    this.m_releaseCredits();
    runeos.scene.Application.prototype.exit.call(this, onStopped);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Copies display metadata and defers all rendering resources until needed.
 *
 * @param {Object} [options] Optional metadata and credit presentation settings.
 *
 * @returns {undefined}
 * @protected
 */
runeos.scene.Screensaver.prototype.m_construct = function(options) {

    this.m_creditsText = this.m_formatCredits(options.metadata);

};

/**
 * Constructs a left-aligned message using the standard Notification/TextField path.
 *
 * @param {runeos.display.Canvas} canvas Shared output used for text measurement.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Screensaver.prototype.m_constructCredits = function(canvas) {
    this.m_releaseCredits();
    var config = this.m_creditsConfig;
    var scale = canvas.height / runeos.display.Screen.DEFAULT_HEIGHT;
    this.m_creditsFontSize = this.m_getCreditsFontSize(canvas);
    var fontScale = this.m_creditsFontSize / runeos.system.Config.getGroup("text").bodySizePx;
    this.m_creditsRegion = new runeos.display.CanvasRegion();
    this.m_credits = new runeos.ui.Notification({
        width: canvas.width / scale,
        height: runeos.display.Screen.DEFAULT_HEIGHT,
        align: "left",
        textConfig: {bodySizePx: this.m_creditsFontSize},
        config: {
            fadeInMs: config.fadeInMs,
            holdMs: config.holdMs,
            fadeOutMs: config.fadeOutMs,
            backgroundOpacity: config.backgroundOpacity,
            marginPx: config.marginPx,
            paddingPx: config.paddingPx,
            maxWidthPx: config.maxWidthPx * fontScale
        }
    });
    this.m_credits.show(this.m_creditsText, {canvas: canvas});
    this.m_credits.update(0);
    var elapsed = this.m_creditsElapsed;
    this.m_creditsElapsed = 0;
    this.m_updateCredits(elapsed);
};

/**
 * Keeps the normal OS text size, but guarantees readable native glyphs when a
 * low-resolution canvas would otherwise shrink them to only a few pixels.
 *
 * @param {runeos.display.Canvas} canvas Shared application output.
 *
 * @returns {number} Logical font size with the native pixel minimum applied.
 * @private
 */
runeos.scene.Screensaver.prototype.m_getCreditsFontSize = function(canvas) {
    var scale = canvas.height / runeos.display.Screen.DEFAULT_HEIGHT;
    var normalSize = runeos.system.Config.getGroup("text").bodySizePx;
    return Math.max(normalSize, this.m_creditsConfig.minFontSizePx / scale);
};

/**
 * Builds a plain attribution without separators for absent optional metadata.
 *
 * @param {(Object|undefined)} metadata Validated screensaver metadata, if available.
 *
 * @returns {string} Name, optional author and optional year.
 * @private
 */
runeos.scene.Screensaver.prototype.m_formatCredits = function(metadata) {
    if (!metadata || !metadata.name) return "";
    var text = metadata.name;
    if (metadata.author) text += " - " + metadata.author;
    if (metadata.year !== undefined) text += " (" + metadata.year + ")";
    return text;
};

/**
 * Saves only the message region, then draws into the game's shared output.
 *
 * @param {runeos.display.Canvas} canvas Shared output canvas.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Screensaver.prototype.m_renderCredits = function(canvas) {
    if (canvas.width <= 0 || canvas.height <= 0) return;
    if (!this.m_credits || this.m_creditsFontSize !== this.m_getCreditsFontSize(canvas)) this.m_constructCredits(canvas);
    var scale = canvas.height / runeos.display.Screen.DEFAULT_HEIGHT;
    var note = this.m_credits;
    note.setViewport(canvas.width / scale, runeos.display.Screen.DEFAULT_HEIGHT, canvas);
    var bounds = {
        x: note.x * scale - 1,
        y: note.y * scale - 1,
        width: note.width * scale + 2,
        height: note.height * scale + 2
    };
    if (!this.m_creditsRegion.capture(canvas, bounds)) return;
    var context = canvas["context"];
    context.save();
    try {
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
        context.filter = "none";
        context.shadowColor = "transparent";
        context.shadowBlur = 0;
        note.drawTo(canvas);
    } finally {
        context.restore();
    }
};

/**
 * Advances entrance, readable hold and exit separately so a long frame crossing their
 * boundary never restarts or extends the display interval.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Screensaver.prototype.m_updateCredits = function(step) {
    if (!this.m_credits || typeof step !== "number" || !isFinite(step) || step <= 0) return;
    var config = this.m_creditsConfig;
    var holdEnd = config.fadeInMs + config.holdMs;
    var end = holdEnd + config.fadeOutMs;
    var target = Math.min(this.m_creditsElapsed + step, end);
    var boundaries = [config.fadeInMs, holdEnd, end];
    for (var i = 0; i < boundaries.length; i++) {
        var next = Math.min(target, boundaries[i]);
        var duration = next - this.m_creditsElapsed;
        if (duration > 0) {
            // Close phase boundaries despite fractional frame-time rounding.
            this.m_credits.update(duration + (next === boundaries[i] ? 0.000001 : 0));
            this.m_creditsElapsed = next;
        }
    }
    if (this.m_creditsElapsed >= end) this.m_releaseCredits();
};

/**
 * Restores covered pixels and releases message resources on completion or exit.
 * The elapsed display time is retained so resizing cannot show finished credits.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Screensaver.prototype.m_releaseCredits = function() {
    if (this.m_creditsRegion) this.m_creditsRegion.dispose();
    if (this.m_credits) this.m_credits.dispose();
    this.m_creditsRegion = null;
    this.m_credits = null;
};

/**
 * Samples controllers directly while ordinary OS input is suspended by Application.
 *
 * @returns {boolean} Whether a connected controller reports wake input.
 * @private
 */
runeos.scene.Screensaver.prototype.m_hasControllerActivity = function() {
    if (!this.m_gamepadFocused) return false;
    var states;
    try {
        states = typeof navigator !== "undefined" && typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    } catch (error) {
        return false;
    }
    for (var i = 0; states && i < states.length; i++) {
        if (runeos.input.Gamepad.isActive(states[i], this.m_config)) return true;
    }
    return false;
};

/**
 * Consumes wake input once and stops the application only after covering it.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Screensaver.prototype.m_wake = function() {
    if (this.m_waking || this.m_finished) return;
    this.m_waking = true;
    var scene = this;
    if (runeos.instance && runeos.instance.screenFade) runeos.instance.screenFade.cover(function() { scene.exit(); });
    else this.exit();
};

/**
 * Covers the old output, waits for shutdown, then starts the replacement directly.
 * The same Launcher remains the return destination throughout the rotation.
 *
 * @param {string} source Prepared executable URL.
 * @param {Object} metadata Replacement screensaver metadata.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Screensaver.prototype.m_rotate = function(source, metadata) {
    if (this.m_finished || this.m_waking) return;
    var scene = this;
    var replace = function() {
        if (scene.m_finished) return;
        if (scene.m_waking) {
            scene.exit();
            return;
        }
        var destination = scene.m_returnScene;
        scene.exit(function() {
            if (runeos.instance.scenes.current !== scene) return;
            runeos.instance.scenes.swap(new runeos.scene.Screensaver(source, destination, {metadata: metadata}));
        });
    };
    if (runeos.instance.screenFade) runeos.instance.screenFade.cover(replace);
    else replace();
};

/**
 * Returns to Launcher after preparation fails instead of retrying continuously.
 *
 * @param {Error} error Preparation failure.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Screensaver.prototype.m_rotationFailed = function(error) {
    console.warn("Screensaver rotation: " + error.message);
    this.m_wake();
};
