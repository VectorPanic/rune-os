//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Boot instance.
 *
 * @constructor
 *
 * @param {runeos.scene.Boot.Options} [options] Optional boot, text and audio configuration groups.
 * @extends runeos.scene.Scene
 *
 * @class
 * @classdesc
 *
 * Creates the initial logo sequence and preparation stage.
 */
runeos.scene.Boot = function(options) {
    options = options || {};

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    runeos.scene.Scene.call(this);

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable transport settings used while preparing heading fonts.
     *
     * @type {Object}
     * @private
     */
    this.m_loadingConfig = runeos.system.Config.getGroup("loading", options.loadingConfig);

    /**
     * Immutable boot settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("boot", options.config);

    /**
     * Immutable text settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_textConfig = runeos.system.Config.getGroup("text", options.textConfig);

    /**
     * Immutable audio settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_audioConfig = runeos.system.Config.getGroup("audio", options.audioConfig);

    /**
     * Owned startup logo.
     *
     * @type {runeos.ui.BootLogo}
     * @private
     */
    this.m_logo = null;

    /**
     * Current animation phase.
     *
     * @type {string}
     * @private
     */
    this.m_phase = "idle";

    /**
     * Milliseconds spent holding the visible logo.
     *
     * @type {number}
     * @private
     */
    this.m_hold = 0;

    /**
     * Whether asynchronous preparation has completed.
     *
     * @type {boolean}
     * @private
     */
    this.m_ready = false;

    /**
     * Loaded boot voice, owned by this scene.
     *
     * @type {runeos.media.Sound}
     * @private
     */
    this.m_bootSound = null;

    /**
     * Prevents repeated boot playback.
     *
     * @type {boolean}
     * @private
     */
    this.m_soundPlayed = false;

    /**
     * Prevents late preparation/image callbacks from reviving Boot.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Constructs the objects owned by this instance.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.scene.Boot.prototype = Object.create(runeos.scene.Scene.prototype);
runeos.scene.Boot.prototype.constructor = runeos.scene.Boot;

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Optional constructor settings and configuration overrides.
 *
 * @typedef {{
 *     audioConfig: (Object|undefined),
 *     config: (Object|undefined),
 *     loadingConfig: (Object|undefined),
 *     textConfig: (Object|undefined)
 * }}
 */
runeos.scene.Boot.Options;

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Loads the active Library catalog. Additional startup tasks can join this
 * Promise.
 * Boot holds the visible logo until preparation settles.
 *
 * @returns {Promise} Preparation completion.
 */
runeos.scene.Boot.prototype.prepare = function() {
    var library = runeos.instance && runeos.instance.library;
    var failure = null;
    var catalog = library ? library.loadCatalog().catch(function(error) {
        failure = error;
    }) : Promise.resolve();
    var tasks = [catalog];
    if (library && typeof library.loadScreensavers === "function") {
        tasks.push(library.loadScreensavers().catch(function(error) {
            console.warn("Screensaver loading: " + error.message);
        }));
    }
    // Canvas labels are measured only after the configured heading is ready.
    tasks.push(runeos.text.FontLoader.load(this.m_textConfig.headingFamily, this.m_textConfig.headingFontUrl, this.m_loadingConfig).catch(function(error) {
        console.warn("Heading font: " + error.message);
    }));
    return Promise.all(tasks).then(function() {
        if (failure) throw failure;
    });
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * @inheritDoc
 */
runeos.scene.Boot.prototype.init = function() {
    if (this.m_phase !== "idle" || this.m_disposed) return;
    this.m_phase = "loading";
    this.m_loadSound();
    this.m_prepare();
    this.m_loadLogo();
};

/**
 * Advances the logo pulse and starts fade-out after preparation and the hold.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 */
runeos.scene.Boot.prototype.update = function(step) {
    if (this.m_disposed) return;
    runeos.scene.Scene.prototype.update.call(this, step);
    if (this.m_phase !== "hold") return;
    if (typeof step === "number" && isFinite(step) && step > 0) this.m_hold += step;
    if (this.m_hold < this.m_config.holdMs || !this.m_ready) return;
    this.m_phase = "fadeOut";
    var scene = this;
    this["tweens"].create({
        target: this.m_logo,
        args: {alpha: 0},
        duration: this.m_config.fadeOutMs,
        transition: runeos.tween.Sine.easeInOut,
        onDispose: function() {
            if (!scene.m_disposed && runeos.instance.scenes.current === scene) {
                runeos.instance.scenes.swap(new runeos.scene.Launcher({
                    booted: true,
                    library: runeos.instance.library
                }));
            }
        }
    });
};

/**
 * Boot is temporary; release resources before the next scene is initialized.
 *
 * @param {Function} onStopped Scene manager continuation.
 *
 * @returns {undefined}
 */
runeos.scene.Boot.prototype.leave = function(onStopped) {
    this.dispose();
    onStopped();
};

/**
 * Releases the resources owned by this instance.
 *
 * @param {Function} [onDisposed] Called after final resource cleanup.
 *
 * @returns {undefined}
 */
runeos.scene.Boot.prototype.dispose = function(onDisposed) {
    if (this.m_disposed) {
        runeos.scene.Scene.prototype.dispose.call(this, onDisposed);
        return;
    }
    this.m_disposed = true;
    if (this.m_bootSound) this.m_bootSound.dispose();
    this.m_bootSound = null;
    runeos.scene.Scene.prototype.dispose.call(this, onDisposed);
};

//------------------------------------------------------------------------------
// Protected prototype methods
//------------------------------------------------------------------------------

/**
 * Runs the initialization steps owned by this instance.
 *
 * @param {Object} [options] Optional construction settings.
 *
 * @returns {undefined}
 * @protected
 */
runeos.scene.Boot.prototype.m_construct = function(options) {
    this.m_constructLogo();
};


//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------
/**
 * Loads optional boot audio without delaying preparation or the logo.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Boot.prototype.m_loadSound = function() {
    var scene = this;
    var sounds = runeos.instance && this.sounds;
    if (sounds && this.m_audioConfig.boot.enabled) {
        sounds.load("runeos_sound_boot", this.m_audioConfig.boot.url).then(function() {
            if (scene.m_disposed) return;
            scene.m_bootSound = sounds["sound"].get("runeos_sound_boot");
            scene.m_bootSound.volume = scene.m_audioConfig.boot.volume;
            scene.m_playBootSound();
        }).catch(function(error) {
            if (!scene.m_disposed) console.warn("Boot audio: " + error.message);
        });
    }
};

/**
 * Prepares startup content, allowing Boot to continue after a reported failure.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Boot.prototype.m_prepare = function() {
    var scene = this;
    Promise.resolve().then(function() {
        if (!scene.m_disposed) return scene.prepare();
    }).then(function() {
        if (!scene.m_disposed) scene.m_ready = true;
    }).catch(function(error) {
        if (scene.m_disposed) return;
        console.warn("Boot preparation: " + error.message);
        scene.m_ready = true;
    });
};

/**
 * Loads the logo with a timeout and a shared completion path.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Boot.prototype.m_loadLogo = function() {
    var scene = this;
    this.m_logo.load(function() {
        if (!scene.m_disposed && scene.m_phase === "loading") scene.m_fadeIn();
    });
};

/**
 * Fades in the logo and starts the hold phase when the animation completes.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Boot.prototype.m_fadeIn = function() {
    var scene = this;
    scene.m_phase = "fadeIn";
    scene.m_playBootSound();
    scene["tweens"].create({
        target: scene.m_logo,
        args: {alpha: 1},
        duration: scene.m_config.fadeInMs,
        transition: runeos.tween.Sine.easeInOut,
        onDispose: function() {
            scene.m_phase = "hold";
            scene.m_hold = 0;
        }
    });
};

/**
 * Plays once when both the logo and audio are ready, without delaying Boot.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Boot.prototype.m_playBootSound = function() {
    if (this.m_disposed || this.m_soundPlayed || !this.m_bootSound || !this.m_logo["loaded"] ||
        (this.m_phase !== "fadeIn" && this.m_phase !== "hold")) return;
    this.m_soundPlayed = true;
    this.m_bootSound.play(true);
};

/**
 * Constructs the display objects owned by this instance.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Boot.prototype.m_constructLogo = function() {
    this["stage"].backgroundColor = this.m_config.backgroundColor;
    this.m_logo = new runeos.ui.BootLogo(this.m_config, {
        width: runeos.display.Screen.DEFAULT_WIDTH,
        height: runeos.display.Screen.DEFAULT_HEIGHT
    });
    this["stage"].addChild(this.m_logo);
};
