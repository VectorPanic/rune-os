//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Main instance.
 *
 * @param {Object} [options] Optional content provider and runtime configuration.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Coordinates OS startup, input, active-scene updates and shared-screen
 * rendering.
 */
runeos.system.Main = function(options) {
    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable runtime settings shared through explicit component groups.
     *
     * @type {runeos.system.Config}
     * @private
     */
    this.m_config = options.config instanceof runeos.system.Config ? options.config : new runeos.system.Config(options.config);

    /**
     * Content source shared by Boot and Launcher.
     *
     * @type {runeos.library.Library}
     * @private
     */
    this.m_library = options.library || new runeos.library.LocalLibrary({
        config: this.m_config.loading,
        rootUrl: options.libraryRootUrl || (window.runeosEnvironment && window.runeosEnvironment.libraryRootUrl) || "../library/local/"
    });

    /**
     * Camera rendering the active OS stage.
     *
     * @type {runeos.camera.Camera}
     * @private
     */
    this.m_camera = null;

    /**
     * Shared-canvas cover used while screensaver ownership changes.
     *
     * @type {runeos.ui.ScreenFade}
     * @private
     */
    this.m_screenFade = null;

    /**
     * Optional background synchronization; absent without an injected provider.
     *
     * @type {runeos.sync.LibrarySync}
     * @private
     */
    this.m_librarySync = null;

    /**
     * Committed local catalog waiting for a quiet Launcher frame.
     *
     * @type {Object}
     * @private
     */
    this.m_syncedCatalog = null;

    /**
     * Fully loaded managed provider waiting for a quiet UI handoff.
     *
     * @type {runeos.library.Library}
     * @private
     */
    this.m_syncedLibrary = null;

    /**
     * Optional API/installation adapter supplied at bootstrap.
     *
     * @type {runeos.sync.SyncProvider}
     * @private
     */
    this.m_syncProvider = options.syncProvider || null;

    /**
     * Input devices used by the OS scenes.
     *
     * @type {runeos.input.Inputs}
     * @private
     */
    this.m_inputs = null;

    /**
     * OS audio, independently suspended while SDK applications run.
     *
     * @type {runeos.media.Sounds}
     * @private
     */
    this.m_sounds = null;

    /**
     * Scene manager switching between OS scenes and application execution.
     *
     * @type {runeos.scene.Scenes}
     * @private
     */
    this.m_scenes = null;

    /**
     * Shared output canvas used by the OS and running applications.
     *
     * @type {runeos.display.Screen}
     * @private
     */
    this.m_screen = null;

    /**
     * Timestamp of the preceding frame; null before the first tick.
     *
     * @type {?number}
     * @private
     */
    this.m_lastTick = null;

    /**
     * Whether OS screen state has been restored since application execution.
     *
     * @type {boolean}
     * @private
     */
    this.m_renderingOS = false;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Constructs the objects owned by this instance.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Validated immutable runtime configuration.
 *
 * @member {(runeos.system.Config|Object)} config
 * @memberof runeos.system.Main
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.system.Main.prototype, "config", {
    /**
     * @this runeos.system.Main
     * @returns {(runeos.system.Config|Object)}
     * @ignore
     */
    get : function() {
        return this.m_config || runeos.system.Config.DEFAULTS;
    }
});

/**
 * Active content provider, independent of scenes and presentation.
 *
 * @member {runeos.library.Library} library
 * @memberof runeos.system.Main
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.system.Main.prototype, "library", {
    /**
     * @this runeos.system.Main
     * @returns {runeos.library.Library}
     * @ignore
     */
    get : function() {
        return this.m_library;
    }
});

/**
 * Input devices used by the OS.
 *
 * @member {runeos.input.Inputs} inputs
 * @memberof runeos.system.Main
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.system.Main.prototype, "inputs", {
    /**
     * @this runeos.system.Main
     * @returns {runeos.input.Inputs}
     * @ignore
     */
    get : function() {
        return this.m_inputs;
    }
});

/**
 * OS sound effects and music channels.
 *
 * @member {runeos.media.Sounds} sounds
 * @memberof runeos.system.Main
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.system.Main.prototype, "sounds", {
    /**
     * @this runeos.system.Main
     * @returns {runeos.media.Sounds}
     * @ignore
     */
    get : function() {
        return this.m_sounds;
    }
});

/**
 * Shared screen offered to hosted SDK applications.
 *
 * @member {runeos.display.Screen} screen
 * @memberof runeos.system.Main
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.system.Main.prototype, "screen", {
    /**
     * @this runeos.system.Main
     * @returns {runeos.display.Screen}
     * @ignore
     */
    get : function() {
        return this.m_screen;
    }
});

/**
 * Scene manager used to switch between the selector and application execution.
 *
 * @member {runeos.scene.Scenes} scenes
 * @memberof runeos.system.Main
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.system.Main.prototype, "scenes", {
    /**
     * @this runeos.system.Main
     * @returns {runeos.scene.Scenes}
     * @ignore
     */
    get : function() {
        return this.m_scenes;
    }
});

/**
 * Optional background synchronization controller, or null in local-only mode.
 *
 * @member {runeos.sync.LibrarySync} librarySync
 * @memberof runeos.system.Main
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.system.Main.prototype, "librarySync", {
    /**
     * @this runeos.system.Main
     * @returns {runeos.sync.LibrarySync}
     * @ignore
     */
    get : function() {
        return this.m_librarySync;
    }
});

/**
 * Shared cover for asynchronous screensaver scene changes.
 *
 * @member {runeos.ui.ScreenFade} screenFade
 * @memberof runeos.system.Main
 * @instance
 */
Object.defineProperty(runeos.system.Main.prototype, "screenFade", {
    /**
     * @this runeos.system.Main
     * @returns {runeos.ui.ScreenFade}
     * @ignore
     */
    get : function() {
        return this.m_screenFade;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Renders OS scenes, restoring shared screen state when returning from Application.
 *
 * @returns {undefined}
 */
runeos.system.Main.prototype.render = function() {
    if (this.m_screenFade) this.m_screenFade.restore();
    var scene = this.m_scenes.current;
    var loadingStage = scene && scene.loadingStage;
    if (scene && (scene.renderToScreen || loadingStage)) {
        if (!this.m_renderingOS) {
            this.m_screen.restore();
        }
        this.m_camera.input = loadingStage || scene.stage;
        this.m_camera.render();
        this.m_renderingOS = true;
    } else {
        this.m_renderingOS = false;
    }
    if (scene && typeof scene.render === "function") scene.render(this.m_screen.canvas);
    if (this.m_screenFade) this.m_screenFade.render(this.m_screen.canvas);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Registers OS startup and exposes this instance through runeos.instance.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_construct = function() {
    runeos.instance = this;
    this.m_constructLibrarySync();
    this.m_waitForDocument();
};

/**
 * Starts immediately when the document is ready or waits for its load event.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_waitForDocument = function() {
    if (document.readyState === "complete") {
        this.m_startRuntime();
        return;
    }
    var main = this;
    window.addEventListener("load", function() { main.m_startRuntime(); }, {once: true});
};

/**
 * Constructs runtime components in dependency order and starts frame timing last.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_startRuntime = function() {
    this.m_constructScreen();
    this.m_constructInputs();
    this.m_constructSounds();
    this.m_constructScenes();
    this.m_constructCamera();
    this.m_constructTime();
};

/**
 * Connects an optional provider without adding any work to Boot's readiness gate.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_constructLibrarySync = function() {
    if (!this.m_syncProvider) return;
    var main = this;
    this.m_librarySync = new runeos.sync.LibrarySync({
        config: this.config.sync,
        provider: this.m_syncProvider,
        onPublished: function() { return main.m_reloadPublishedLibrary(); }
    });
};

/**
 * Reloads a committed root as one candidate. Existing content stays usable
 * until games, categories, tags and independent screensavers are all ready.
 *
 * @returns {Promise} Candidate readiness or retryable local reload failure.
 * @private
 */
runeos.system.Main.prototype.m_reloadPublishedLibrary = function() {
    var root = typeof this.m_syncProvider.getRootUrl === "function" ? this.m_syncProvider.getRootUrl() : null;
    var library = root ? new runeos.library.LocalLibrary({rootUrl: root, config: this.config.loading}) : this.library;
    var main = this;
    var savers = typeof library.loadScreensavers === "function" ? library.loadScreensavers(true) : Promise.resolve();
    return Promise.all([library.loadCatalog(true), savers]).then(function(catalogs) {
        if (root) {
            if (main.m_syncedLibrary) main.m_syncedLibrary.dispose();
            main.m_syncedLibrary = library;
        }
        main.m_syncedCatalog = catalogs[0];
    }).catch(function(error) {
        if (root) library.dispose();
        throw error;
    });
};

/**
 * Prepares content during play and applies committed content only in a quiet Launcher.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_syncLibrary = function(step) {
    if (!this.m_librarySync) return;
    var scene = this.m_scenes.current;
    var activity = scene instanceof runeos.scene.Launcher ? scene.activity : null;
    var focused = activity ? activity.focused : !document.hidden &&
        (typeof document.hasFocus !== "function" || document.hasFocus());
    var allowed = !!activity && focused && scene.syncAllowed;
    var background = focused && (scene instanceof runeos.scene.Application ||
        (scene instanceof runeos.scene.Launcher && !allowed));
    if (background) {
        this.m_librarySync.prepare(step);
    } else {
        this.m_librarySync.update(step, allowed, activity ? activity.active : false);
    }
    if (scene instanceof runeos.scene.Launcher && allowed && this.m_librarySync.quiet && this.m_syncedCatalog) {
        this.m_applyLibrary(scene);
    }
};

/**
 * Applies the prepared library and catalog before releasing the previous library.
 * Called only when Launcher is quiet and a complete catalog is ready.
 *
 * @param {runeos.scene.Launcher} scene Launcher receiving the prepared content.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_applyLibrary = function(scene) {
    var previous = this.m_library;
    if (this.m_syncedLibrary) {
        this.m_library = this.m_syncedLibrary;
        this.m_syncedLibrary = null;
        scene.setLibrary(this.m_library);
    }
    scene.applyCatalog(this.m_syncedCatalog);
    this.m_syncedCatalog = null;
    if (previous !== this.m_library) previous.dispose();
};

/**
 * Creates and attaches the shared screen canvas.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_constructScreen = function() {
    if (this.m_screen == null) {
        this.m_screen = new runeos.display.Screen();
        this.m_screen.appendTo(document.body);
        this.m_screenFade = new runeos.ui.ScreenFade(this.m_config.screensaverTransition);
    }
};

/**
 * Creates the scene manager and opens the initial Boot sequence.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_constructScenes = function() {
    if (this.m_scenes == null) {
        this.m_scenes = new runeos.scene.Scenes();
        this.m_scenes.swap(new runeos.scene.Boot({config: this.config.boot}));
    }
};

/**
 * Connects the OS camera to the shared screen.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_constructCamera = function() {
    if (this.m_camera == null) {
        this.m_camera = new runeos.camera.Camera(
            null,
            this.m_screen
        );
    }
};

/**
 * Binds the animation-frame handler and starts the OS loop.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_constructTime = function() {
    this.m_tick = this.m_tick.bind(this);
    window.requestAnimationFrame(this.m_tick);
};

/**
 * Advances scene tweens and input, updates the active scene, then renders.
 *
 * @param {number} timestamp Animation-frame timestamp in milliseconds.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_tick = function(timestamp) {
    var now = typeof timestamp === "number" && isFinite(timestamp) ? timestamp : Date.now();
    var step = this.m_lastTick == null ? 0 : Math.max(0, now - this.m_lastTick);
    this.m_lastTick = now;
    if (this.m_screenFade) {
        this.m_screenFade.restore();
        this.m_screenFade.update(step);
    }
    var scene = this.m_scenes.current;
    if (scene && scene.renderToScreen && scene.tweens) {
        scene.tweens.update(step);
    }
    this.m_syncInputs();
    this.m_syncSounds();
    if (this.m_sounds) this.m_sounds.update(step);
    this.m_inputs.update();
    this.m_scenes.update(step);
    this.m_syncInputs();
    this.m_syncSounds();
    this.m_syncLibrary(step);
    this.render();
    window.requestAnimationFrame(this.m_tick);
};

/**
 * Creates the OS input subsystem.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_constructInputs = function() {
    if (!this.m_inputs) {
        this.m_inputs = new runeos.input.Inputs({config: this.config.input});
    }
};

/**
 * Enables OS input only while an OS scene owns the display.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_syncInputs = function() {
    var scene = this.m_scenes.current;
    var enabled = Boolean(scene && scene.renderToScreen);
    this.m_inputs.keyboard.enabled = enabled;
    if (this.m_inputs.gamepads) this.m_inputs.gamepads.enabled = enabled;
};

/**
 * Creates the audio system without creating a native context until playback.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_constructSounds = function() {
    if (!this.m_sounds) this.m_sounds = new runeos.media.Sounds({
        config: this.config.audio,
        loadingConfig: this.config.loading
    });
};

/**
 * Silences OS voices during Application and resumes previous playback on return.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Main.prototype.m_syncSounds = function() {
    if (this.m_sounds) {
        var scene = this.m_scenes.current;
        this.m_sounds.enabled = Boolean(scene && scene.renderToScreen);
    }
};
