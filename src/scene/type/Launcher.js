//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Launcher instance.
 *
 * @constructor
 * @extends runeos.scene.Scene
 *
 * @param {runeos.scene.Launcher.Options} [options] Optional catalog, content provider and entrance settings.
 *
 * @class
 * @classdesc
 *
 * Coordinates tilemap navigation, the category header and launching the selected
 * application.
 */
runeos.scene.Launcher = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    runeos.scene.Scene.call(this);

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Catalog controller and shared registries.
     *
     * @type {runeos.launcher.CategoryTilemapManager}
     */
    this.catalog = null;

    /**
     * Content source shared with Boot; owned by Main.
     *
     * @type {runeos.library.Library}
     */
    this.library = options.library || (runeos.instance && runeos.instance.library) || null;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable selector settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("selector", options.config);

    /**
     * Immutable tiles settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_tileConfig = runeos.system.Config.getGroup("tiles", options.tileConfig);

    /**
     * Immutable tilemaps settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_tilemapConfig = runeos.system.Config.getGroup("tilemaps", options.tilemapConfig);

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
     * Immutable loading settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_loadingConfig = runeos.system.Config.getGroup("loading", options.loadingConfig);

    /**
     * Tilemap navigation viewport.
     *
     * @type {runeos.ui.tilemap.Tilemaps}
     * @private
     */
    this.m_tilemaps = null;

    /**
     * Fixed header showing the active tilemap name.
     *
     * @type {runeos.ui.CategoryHeader}
     * @private
     */
    this.m_categoryHeader = null;

    /**
     * Whether the first entrance has already been shown.
     *
     * @type {boolean}
     * @private
     */
    this.m_hasEntered = Boolean(options.booted);

    /**
     * Whether navigation is suspended while leaving the scene.
     *
     * @type {boolean}
     * @private
     */
    this.m_leaving = false;

    /**
     * Whether the exit animation has completed.
     *
     * @type {boolean}
     * @private
     */
    this.m_leaveFinished = false;

    /**
     * Scene-manager continuations waiting for the exit animation.
     *
     * @type {Array.<Function>}
     * @private
     */
    this.m_leaveCallbacks = [];

    /**
     * Temporary black overlay used only on the first entrance.
     *
     * @type {runeos.display.DisplayObject}
     * @private
     */
    this.m_startupOverlay = null;

    /**
     * Whether initial catalog loading has started.
     *
     * @type {boolean}
     * @private
     */
    this.m_catalogStarted = false;

    /**
     * Safe-boundary library refresh coordinator.
     *
     * @type {runeos.launcher.LibraryRefresh}
     * @private
     */
    this.m_libraryRefresh = null;

    /**
     * Whether catalog input and synchronization are suspended.
     *
     * @type {boolean}
     * @private
     */
    this.m_refreshing = false;

    /**
     * Whether an explicit online refresh owns the visible sync status.
     *
     * @type {boolean}
     * @private
     */
    this.m_manualSync = false;

    /**
     * Selects sync and empty-library messages independently of presentation.
     *
     * @type {runeos.launcher.LibraryStatus}
     * @private
     */
    this.m_libraryStatus = new runeos.launcher.LibraryStatus();

    /**
     * Application preparation and execution handoff, independent of presentation.
     *
     * @type {runeos.application.ApplicationLauncher}
     * @private
     */
    this.m_launcher = null;

    /**
     * Reusable navigation voice, created after resource loading.
     *
     * @type {runeos.media.Sound}
     * @private
     */
    this.m_navigateSound = null;

    /**
     * Translates keyboard and controller state into selector commands.
     *
     * @type {runeos.launcher.SelectorInput}
     * @private
     */
    this.m_selectorInput = new runeos.launcher.SelectorInput(this.m_config);

    /**
     * Game-launch confirmation voice.
     *
     * @type {runeos.media.Sound}
     * @private
     */
    this.m_startSound = null;

    /**
     * Return-from-game confirmation voice.
     *
     * @type {runeos.media.Sound}
     * @private
     */
    this.m_stopSound = null;

    /**
     * Waits for the OS audio channel to resume after Application.
     *
     * @type {boolean}
     * @private
     */
    this.m_stopSoundPending = false;

    /**
     * Whether the current exit should allow the start sound to finish.
     *
     * @type {boolean}
     * @private
     */
    this.m_launchSoundPlayed = false;

    /**
     * Whether navigation-audio loading has started.
     *
     * @type {boolean}
     * @private
     */
    this.m_soundStarted = false;

    /**
     * Lazily created, nonblocking error notification.
     *
     * @type {runeos.ui.Notification}
     * @private
     */
    this.m_notification = null;

    /**
     * Persistent empty-library guidance, independent of temporary errors.
     *
     * @type {runeos.ui.Notification}
     * @private
     */
    this.m_emptyNotification = null;

    /**
     * Whether catalog loading has completed with a usable document.
     *
     * @type {boolean}
     * @private
     */
    this.m_catalogReady = false;

    /**
     * Inactivity shading rendered above the entire Launcher interface.
     *
     * @type {runeos.ui.ScreenDimmer}
     * @private
     */
    this.m_screenDimmer = null;

    /**
     * Bufferless light fields drawn before all Launcher content.
     *
     * @type {runeos.ui.LauncherBackground}
     * @private
     */
    this.m_background = null;


    /**
     * Inactivity policy coordinating activity, dimming and automatic launches.
     *
     * @type {runeos.launcher.LauncherIdle}
     * @private
     */
    this.m_idle = null;

    /**
     * Permanent teardown flag for asynchronous resource callbacks.
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
    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.scene.Launcher.prototype = Object.create(runeos.scene.Scene.prototype);
runeos.scene.Launcher.prototype.constructor = runeos.scene.Launcher;

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Optional constructor settings and configuration overrides.
 *
 * @typedef {{
 *     audioConfig: (Object|undefined),
 *     backgroundConfig: (Object|undefined),
 *     booted: (boolean|undefined),
 *     catalog: (boolean|undefined),
 *     config: (Object|undefined),
 *     library: (runeos.library.Library|undefined),
 *     loadingConfig: (Object|undefined),
 *     textConfig: (Object|undefined),
 *     tileConfig: (Object|undefined),
 *     tilemapConfig: (Object|undefined)
 * }}
 */
runeos.scene.Launcher.Options;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Tilemap manager used to populate the selector.
 *
 * @member {runeos.ui.tilemap.Tilemaps} tilemaps
 * @memberof runeos.scene.Launcher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Launcher.prototype, "tilemaps", {
    /**
     * @this runeos.scene.Launcher
     * @returns {runeos.ui.tilemap.Tilemaps}
     * @ignore
     */
    get : function() {
        return this.m_tilemaps;
    }
});

/**
 * Fixed header for the current tilemap.
 *
 * @member {runeos.ui.CategoryHeader} categoryHeader
 * @memberof runeos.scene.Launcher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Launcher.prototype, "categoryHeader", {
    /**
     * @this runeos.scene.Launcher
     * @returns {runeos.ui.CategoryHeader}
     * @ignore
     */
    get : function() {
        return this.m_categoryHeader;
    }
});

/**
 * Launch status shared with Application while its source is loading.
 *
 * @member {runeos.ui.Notification} launchIndicator
 * @memberof runeos.scene.Launcher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Launcher.prototype, "launchIndicator", {
    /**
     * @this runeos.scene.Launcher
     * @returns {runeos.ui.Notification}
     * @ignore
     */
    get : function() {
        return this.m_launcher.request && !this.m_launcher["automatic"] ? this.m_notification : null;
    }
});

/**
 * Whether background sync may begin work in this scene.
 *
 * @member {boolean} syncAllowed
 * @memberof runeos.scene.Launcher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Launcher.prototype, "syncAllowed", {
    /**
     * @this runeos.scene.Launcher
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return !this.m_disposed && !this.m_leaving && !this.m_refreshing && !this.m_launcher["busy"];
    }
});

/**
 * Application launch lifecycle and current request.
 *
 * @member {runeos.application.ApplicationLauncher} launcher
 * @memberof runeos.scene.Launcher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Launcher.prototype, "launcher", {
    /**
     * @this runeos.scene.Launcher
     * @returns {runeos.application.ApplicationLauncher}
     * @ignore
     */
    get : function() {
        return this.m_launcher;
    }
});

/**
 * Shared inactivity and input snapshot for presentation and background sync.
 *
 * @member {runeos.input.Activity} activity
 * @memberof runeos.scene.Launcher
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Launcher.prototype, "activity", {
    /**
     * @this runeos.scene.Launcher
     * @returns {runeos.input.Activity}
     * @ignore
     */
    get : function() {
        return this.m_idle["activity"];
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Replaces the borrowed content source after a complete snapshot reload.
 * Selection and Tile instances are reconciled separately through applyCatalog.
 *
 * @param {runeos.library.Library} library Ready local content source.
 *
 * @returns {undefined}
 */
runeos.scene.Launcher.prototype.setLibrary = function(library) {
    this.library = library;
    this.m_libraryRefresh = new runeos.launcher.LibraryRefresh(library,
        typeof window !== "undefined" ? window["runeosEnvironment"] : null);
    this.m_idle.start(library);
};

/**
 * Applies a validated local catalog through the existing Tile reuse pipeline.
 *
 * @param {Object} catalog Local games, categories and tags documents.
 *
 * @returns {undefined}
 */
runeos.scene.Launcher.prototype.applyCatalog = function(catalog) {
    if (this.m_disposed || !this.catalog) return;
    this.catalog.setData(catalog.games, catalog.categories, catalog.tags);
    this.m_catalogReady = true;
    this.m_updateEmptyLibraryMessage();
    this.m_idle.recheckScreensavers();
    this.m_updateCategoryHeader();
};

/**
 * Shows a short error without interrupting navigation or selection.
 *
 * @param {string} message User-facing message.
 *
 * @returns {undefined}
 */
runeos.scene.Launcher.prototype.showError = function(message) {
    if (this.m_disposed) return;
    this.m_showMessage(message);
};

/**
 * Launches the selected tile when it has an application source URL.
 *
 * @returns {boolean} Whether a launch request was accepted.
 */
runeos.scene.Launcher.prototype.launchSelected = function() {
    if (runeos.instance && runeos.instance.screenFade && runeos.instance.screenFade.active) return false;
    if (this.m_refreshing) return false;
    if (runeos.instance && runeos.instance.librarySync && runeos.instance.librarySync.publishing) return false;
    var tile = this.m_tilemaps["selection"].tile;
    if (!tile) return false;
    return this.m_launcher.launch({
        source: tile.source,
        id: tile.gameId,
        data: tile.data,
        library: this.library,
        scenes: runeos.instance.scenes,
        kind: "application"
    });
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * @inheritDoc
 *
 * @param {runeos.scene.Scene} [previousScene] Previous scene, used for return audio.
 */
runeos.scene.Launcher.prototype.init = function(previousScene) {
    if (this.m_disposed) return;
    this.m_background.start();
    this.m_launcher.resume();
    if (this.m_notification) this.m_notification.hide();
    if (previousScene instanceof runeos.scene.Application) this.m_stopSoundPending = true;
    this.m_constructSounds();
    this.m_loadCatalog();
    if (this.m_libraryRefresh.watching && (previousScene instanceof runeos.scene.Application)) this.m_refreshLibrary(false);
    else this.m_reveal();
};

/**
 * Updates the scene and processes one directional input per frame.
 *
 * @param {number} step Current time step.
 *
 * @returns {undefined}
 */
runeos.scene.Launcher.prototype.update = function(step) {
    if (this.m_disposed || this.m_refreshing) {
        this.m_selectorInput.reset();
        return;
    }
    this.m_updateSyncMessage();
    this.m_updateCategoryHeader();
    runeos.scene.Scene.prototype.update.call(this, step);
    this.m_updateEmptyLibraryMessage();
    if (!this.m_canHandleInput(step)) {
        this.m_selectorInput.reset();
        return;
    }
    this.m_playPendingStopSound();
    this.m_handleInput(step);
};

/**
 * Checks whether navigation and shortcuts may run during this frame.
 * Keeps idle updates suspended during fades and library publication.
 *
 * @param {number} step Elapsed frame time.
 *
 * @returns {boolean}
 * @private
 */
runeos.scene.Launcher.prototype.m_canHandleInput = function(step) {
    var instance = runeos.instance;
    if (instance && instance.screenFade && instance.screenFade.active) return false;
    if (instance && instance.librarySync && instance.librarySync.publishing) return false;
    if (this.m_idle.update(step, instance && instance.inputs)) return false;
    return !this.m_leaving && !this.m_launcher["busy"];
};

/**
 * Plays deferred return audio once the selector becomes available.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_playPendingStopSound = function() {
    var sounds = runeos.instance && this.sounds;
    if (this.m_stopSoundPending && this.m_stopSound && sounds && sounds.enabled) {
        this.m_stopSoundPending = false;
        this.m_stopSound.play(true);
    }
};

/**
 * Executes at most one selector command, after scene availability checks.
 *
 * @param {number} step Elapsed frame time in milliseconds.
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_handleInput = function(step) {
    var command = this.m_selectorInput.read(step, this["keyboard"], this["gamepads"]);
    if (command === "refresh") this.m_refreshLibrary(true);
    else if (command === "launch") this.launchSelected();
    else if (command) this.m_tilemaps.navigate(command);
};

/**
 * Fades the interface out before the scene manager gives the canvas to Application.
 * Later scene requests share the same animation instead of restarting it.
 *
 * @param {Function} onStopped Scene-manager continuation.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.scene.Launcher.prototype.leave = function(onStopped) {
    if (this.m_disposed) {
        runeos.scene.Scene.prototype.leave.call(this, onStopped);
        return;
    }
    
    if (this.m_prepareLeave()) {
        this.m_leaveImmediately(onStopped);
        return;
    }
    
    this.m_leaveWithFade(onStopped);
};

/**
 * Releases catalog loading, animations and display resources.
 *
 * @param {Function} [onDisposed] Called after final resource cleanup.
 *
 * @returns {undefined}
 */
runeos.scene.Launcher.prototype.dispose = function(onDisposed) {
    if (this.m_disposed) {
        runeos.scene.Scene.prototype.dispose.call(this, onDisposed);
        return;
    }
    
    this.m_disposed = true;
    this.m_idle.dispose();
    this.m_launcher.dispose();
    if (this.m_navigateSound) this.m_navigateSound.dispose();
    if (this.m_startSound) this.m_startSound.dispose();
    if (this.m_stopSound) this.m_stopSound.dispose();
    this.m_stopSoundPending = false;
    this.m_stopSound = null;
    this.m_navigateSound = null;
    this.m_startSound = null;
    if (this.catalog) this.catalog.dispose();
    runeos.scene.Scene.prototype.dispose.call(this, onDisposed);
};

//------------------------------------------------------------------------------
// Protected prototype methods
//------------------------------------------------------------------------------

/**
 * Runs the initialization steps owned by this instance.
 *
 * @param {Object} [options] Constructor settings.
 *
 * @returns {undefined}
 * @protected
 */
runeos.scene.Launcher.prototype.m_construct = function(options) {
    this.m_constructContent(options || {});
    this.m_constructLauncher();
    this.m_constructIdle();
    this.m_libraryRefresh = new runeos.launcher.LibraryRefresh(this.library,
        typeof window !== "undefined" ? window["runeosEnvironment"] : null);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------
/**
 * Starts catalog loading once, independently of later scene reactivation.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_loadCatalog = function() {
    if (!this.catalog || this.m_catalogStarted) return;
    this.m_catalogStarted = true;
    if (this.library) this.m_loadLibraryCatalog();
    else this.m_loadLegacyCatalog();
};

/**
 * Applies a cached library catalog immediately or waits for its shared load.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_loadLibraryCatalog = function() {
    if (this.library.catalog) {
        this.applyCatalog(this.library.catalog);
        return;
    }
    var scene = this;
    this.library.loadCatalog().then(function(catalog) {
        scene.applyCatalog(catalog);
    }).catch(function(error) {
        if (scene.m_disposed) return;
        scene.showError(runeos.system.Config.getGroup("notifications").libraryError);
        console.warn("Library loading: " + error.message);
    });
};

/**
 * Loads legacy documents through the catalog manager when no library is supplied.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_loadLegacyCatalog = function() {
    var scene = this;
    this.catalog.load(this.m_loadingConfig.gamesUrl, this.m_loadingConfig.categoriesUrl, this.m_loadingConfig.tagsUrl).then(function(loaded) {
        if (!loaded || scene.m_disposed) return;
        scene.m_catalogReady = true;
        scene.m_updateEmptyLibraryMessage();
    });
};

/**
 * Suspends background work and launch requests before handing off the scene.
 *
 * @returns {boolean} Whether the pending launch is automatic.
 * @private
 */
runeos.scene.Launcher.prototype.m_prepareLeave = function() {
    this.m_background.stop();
    this.m_idle.stop();
    var automatic = this.m_launcher["automatic"];
    this.m_launcher.suspend();
    return automatic;
};

/**
 * Hands off automatic launches without an animated input gap.
 *
 * @param {Function} onStopped Scene-manager continuation.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_leaveImmediately = function(onStopped) {
    // Automatic launch hands off immediately, without a wake-input gap.
    this.m_leaveFinished = true;
    this.m_leaving = true;
    this.m_idle.reset();
    onStopped();
};

/**
 * Queues scene continuations behind a single outgoing animation.
 *
 * @param {Function} onStopped Scene-manager continuation.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_leaveWithFade = function(onStopped) {
    if (this.m_notification && !this.m_launcher.request) this.m_notification.hide();
    this.m_stopSoundPending = false;
    if (this.m_stopSound) this.m_stopSound.stop();
    if (this.m_leaveFinished) {
        onStopped();
        return;
    }
    
    this.m_leaveCallbacks.push(onStopped);
    if (this.m_leaving) return;
    this.m_leaving = true;
    this.m_idle.reset();
    this.m_fadeOut();
};

/**
 * Animates the menu away before completing the scene handoff.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_fadeOut = function() {
    this["tweens"].replace({
        target: this.m_categoryHeader,
        args: {alpha: 0},
        duration: this.m_config.menuFadeOutMs,
        transition: runeos.tween.Quad.easeIn
    });
    this["tweens"].replace({
        target: this.m_tilemaps,
        args: {
            alpha: 0,
            y: this.m_config.exitOffsetYPx
        },
        duration: this.m_leaveDuration(),
        transition: runeos.tween.Quad.easeIn,
        scope: this,
        onDispose: this.m_finishLeave
    });
};

/**
 * Keeps the outgoing animation within configured bounds when launch audio plays.
 *
 * @returns {number} Fade duration in milliseconds.
 * @private
 */
runeos.scene.Launcher.prototype.m_leaveDuration = function() {
    if (!this.m_launchSoundPlayed || !this.m_startSound) return this.m_config.fadeOutMs;
    return Math.max(this.m_config.launchFadeMinMs, Math.min(this.m_config.launchFadeMaxMs,
        this.m_startSound["duration"] * 1000 + this.m_config.launchSoundMarginMs));
};

/**
 * Releases launch feedback before completing the waiting scene requests.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_finishLeave = function() {
    if (this.m_startSound) this.m_startSound.stop();
    this.m_launchSoundPlayed = false;
    this.m_clearStartupOverlay();
    this.m_leaveFinished = true;
    var callbacks = this.m_leaveCallbacks;
    this.m_leaveCallbacks = [];
    for (var i = 0; i < callbacks.length; i++) callbacks[i]();
};

/**
 * Keeps catalog changes behind the existing canvas fade. Native change checks
 * run only on return. Online manual requests keep the Launcher visible.
 *
 * @param {boolean} force Whether the user explicitly requested a scan.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_refreshLibrary = function(force) {
    if (this.m_refreshing || this.m_disposed) return;
    var sync = runeos.instance && runeos.instance.librarySync;
    if (force && sync && runeos.system.Config.getGroup("sync").enabled) {
        this.m_requestSync(sync);
        return;
    }
    this.m_reloadLibrary(force);
};

/**
 * Requests online synchronization while keeping the current catalog visible.
 *
 * @param {runeos.sync.LibrarySync} sync Active synchronization process.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_requestSync = function(sync) {
    if (this.m_manualSync) return;
    this.m_manualSync = true;
    if (this.m_emptyNotification) this.m_emptyNotification.hide();
    sync.request();
    this.m_showMessage(runeos.system.Config.getGroup("notifications").syncingLibrary, {persistent: true});
};

/**
 * Starts local reloading behind the canvas fade for explicit refresh requests.
 *
 * @param {boolean} force Whether the user explicitly requested a scan.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_reloadLibrary = function(force) {
    this.m_refreshing = true;
    var scene = this;
    var reload = function() { scene.m_reloadCatalog(force); };
    var fade = runeos.instance && runeos.instance.screenFade;
    if (force && fade) fade.cover(reload);
    else reload();
};

/**
 * Applies locally refreshed content and reveals the scene after completion or failure.
 *
 * @param {boolean} force Whether to force a local catalog scan.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_reloadCatalog = function(force) {
    this.m_tilemaps.alpha = 0;
    this.m_categoryHeader.alpha = 0;
    var scene = this;
    this.m_libraryRefresh.refresh(force).then(function(catalog) {
        if (!scene.m_disposed && catalog) scene.applyCatalog(catalog);
    }).catch(function(error) {
        if (!scene.m_disposed) scene.showError(runeos.system.Config.getGroup("notifications").libraryError);
        console.warn("Library refresh: " + error.message);
    }).then(function() {
        if (scene.m_disposed) return;
        scene.m_refreshing = false;
        scene.m_reveal();
    });
};

/**
 * Keeps manual sync feedback visible until checking, activation or failure settles.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_updateSyncMessage = function() {
    if (!this.m_manualSync) return;
    var sync = runeos.instance && runeos.instance.librarySync;
    var status = this.m_libraryStatus.manual(sync, runeos.system.Config.getGroup("notifications"));
    this.m_manualSync = status.pending;
    var empty = this.m_catalogReady && this.catalog && this.m_tilemaps["navigableCount"] === 0;
    if (!status.message || (!status.pending && empty)) {
        if (this.m_notification) this.m_notification.hide();
        return;
    }
    if (!status.pending || !this.m_notification || !this.m_notification.visible || this.m_notification["message"] !== status["message"]) {
        this.m_showMessage(status.message, {persistent: status.persistent});
    }
};

/**
 * Resumes navigation and animates a fully reconciled catalog into view.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_reveal = function() {
    this.m_updateEmptyLibraryMessage();
    this.m_tilemaps.refresh(false);
    this.m_updateCategoryHeader();
    this.m_idle.start(this.library);
    this.m_enter();
    if (runeos.instance && runeos.instance.screenFade) runeos.instance.screenFade.reveal();
};

/**
 * Preloads reusable navigation and launch voices without delaying the
 * interface.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_constructSounds = function() {
    var sounds = runeos.instance && this.sounds;
    if (!sounds || this.m_soundStarted || this.m_disposed) return;
    this.m_soundStarted = true;
    var scene = this;
    [
        {
            name: "runeos_sound_navigate",
            key: "selection",
            field: "m_navigateSound",
            preservesPitch: false
        },
        {
            name: "runeos_sound_start",
            key: "start",
            field: "m_startSound",
            preservesPitch: true
        },
        {
            name: "runeos_sound_stop",
            key: "stop",
            field: "m_stopSound",
            preservesPitch: true
        }
    ].forEach(function(resource) {
        var config = scene.m_audioConfig[resource.key];
        if (!config.enabled && !(resource.key === "selection" && scene.m_audioConfig.categoryChange.enabled)) return;
        sounds.load(resource.name, config.url).then(function() {
            if (scene.m_disposed) return;
            var sound = sounds["sound"].get(resource.name);
            sound.preservesPitch = resource.preservesPitch;
            sound.volume = config.volume;
            scene[resource.field] = sound;
        }).catch(function(error) {
            if (!scene.m_disposed) console.warn("Launcher audio: " + error.message);
        });
    });
};

/**
 * Confirms a prepared launch once, before the exit transition starts.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_playStartSound = function() {
    if (!this.m_startSound || this.m_launchSoundPlayed) return;
    if (this.m_navigateSound) this.m_navigateSound.stop();
    if (this.m_stopSound) this.m_stopSound.stop();
    this.m_stopSoundPending = false;
    this.m_launchSoundPlayed = true;
    this.m_startSound.play(true);
};

/**
 * Animates the interface without changing selected maps, tiles or scroll
 * offsets.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_enter = function() {
    this.m_leaving = false;
    this.m_leaveFinished = false;
    this.m_leaveCallbacks = [];
    this.m_clearStartupOverlay();
    this.m_tilemaps.alpha = 0;
    this.m_tilemaps.y = this.m_config.enterOffsetYPx;
    this.m_categoryHeader.alpha = 0;
    this["tweens"].replace({
        target: this.m_tilemaps,
        args: {
            alpha: 1,
            y: 0
        },
        duration: this.m_config.fadeInMs,
        transition: runeos.tween.Quad.easeOut
    });
    this["tweens"].replace({
        target: this.m_categoryHeader,
        args: {alpha: 1},
        duration: this.m_config.menuFadeInMs,
        transition: runeos.tween.Quad.easeOut
    });
    if (!this.m_hasEntered) {
        this.m_hasEntered = true;
        var overlay = new runeos.display.DisplayObject(
            0, 0, runeos.display.Screen.DEFAULT_WIDTH, runeos.display.Screen.DEFAULT_HEIGHT
        );
        this.m_startupOverlay = overlay;
        overlay.backgroundColor = runeos.system.Config.getGroup("boot").backgroundColor;
        this["stage"].addChild(overlay);
        this["tweens"].create({
            target: overlay,
            args: {alpha: 0},
            duration: this.m_config.startupFadeMs,
            transition: runeos.tween.Quad.easeOut,
            scope: this,
            onDispose: this.m_clearStartupOverlay
        });
    }
};

/**
 * Releases the initial black overlay and its pixel buffer after use.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_clearStartupOverlay = function() {
    if (!this.m_startupOverlay) return;
    this["tweens"].removeFrom(this.m_startupOverlay);
    this["stage"].removeChild(this.m_startupOverlay);
    this.m_startupOverlay.dispose();
    this.m_startupOverlay = null;
};

/**
 * Constructs the reusable notification only when a message is needed.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_constructNotification = function() {
    this.m_notification = new runeos.ui.Notification({
        width: this.m_tilemaps.width,
        height: this.m_tilemaps.height,
        textConfig: this.m_textConfig
    });
};

/**
 * Constructs persistent guidance using the shared canvas notification component.
 * Temporary errors and inactivity shading remain above this message.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_constructEmptyNotification = function() {
    this.m_emptyNotification = new runeos.ui.Notification({
        width: this.m_tilemaps.width,
        height: this.m_tilemaps.height,
        textConfig: this.m_textConfig,
        config: {maxWidthPx: this.m_tilemaps.width}
    });
    this["stage"].addChild(this.m_emptyNotification);
    if (this.m_notification) {
        this["stage"].removeChild(this.m_notification);
        this["stage"].addChild(this.m_notification);
    }
    this["stage"].removeChild(this.m_screenDimmer);
    this["stage"].addChild(this.m_screenDimmer);
};

/**
 * Keeps actionable guidance visible until the catalog contains selectable games.
 * Pending or failed loads retain their own loading/error presentation.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_updateEmptyLibraryMessage = function() {
    if (this.m_manualSync) {
        if (this.m_emptyNotification) this.m_emptyNotification.hide();
        return;
    }
    if (!this.m_catalogReady || !this.catalog) return;
    if (this.m_tilemaps["navigableCount"] > 0) {
        if (this.m_emptyNotification) this.m_emptyNotification.hide();
        return;
    }
    var message = this.m_getEmptyLibraryMessage();
    if (!this.m_emptyNotification) this.m_constructEmptyNotification();
    if (this.m_emptyNotification.visible && this.m_emptyNotification["message"] === message) return;
    this.m_emptyNotification.show(message, {
        persistent: true
    });
};

/**
 * Chooses empty-library guidance for the configured and available content source.
 * Filtering keeps its own message regardless of the source.
 *
 * @returns {string} Local, online or filtered-library guidance.
 * @private
 */
runeos.scene.Launcher.prototype.m_getEmptyLibraryMessage = function() {
    return this.m_libraryStatus.empty(
        this.catalog.games.items.length > 0,
        runeos.instance && runeos.instance.librarySync,
        runeos.system.Config.getGroup("sync"),
        runeos.system.Config.getGroup("notifications")
    );
};


/**
 * Reuses the status component and places it above the scene content.
 *
 * @param {string} message User-facing status.
 * @param {runeos.scene.Launcher.Options} [options] Notification timing options.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_showMessage = function(message, options) {
    if (!this.m_notification) this.m_constructNotification();
    this["stage"].removeChild(this.m_notification);
    this["stage"].addChild(this.m_notification);
    this["stage"].removeChild(this.m_screenDimmer);
    this["stage"].addChild(this.m_screenDimmer);
    this.m_notification.show(message, options);
};

/**
 * Constructs the display objects owned by this instance.
 *
 * @param {Object} options Configuration supplied to the constructor.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_constructContent = function(options) {
    this.m_background = new runeos.ui.LauncherBackground({config: options.backgroundConfig});
    this["stage"].addChild(this.m_background);
    this.m_tilemaps = new runeos.ui.tilemap.Tilemaps({
        tweens: this["tweens"],
        config: this.m_tilemapConfig,
        tileConfig: this.m_tileConfig,
        textConfig: this.m_textConfig
    });
    this["stage"].addChild(this.m_tilemaps);
    this.m_categoryHeader = new runeos.ui.CategoryHeader({
        width: this.m_tilemaps.width,
        config: this.m_config,
        textConfig: this.m_textConfig
    });
    this["stage"].addChild(this.m_categoryHeader);
    this.m_screenDimmer = new runeos.ui.ScreenDimmer({
        width: this.m_tilemaps.width,
        height: this.m_tilemaps.height,
        opacity: this.m_config.idleOpacity,
        duration: this.m_config.idleFadeMs
    });
    this["stage"].addChild(this.m_screenDimmer);

    // Reserve header space without clipping the scrolling viewport.
    this.m_tilemaps.contentTop = this.m_categoryHeader.height + this.m_config.headerGapPx;
    this["stage"].backgroundColor = this.m_config.backgroundColor;
    this.m_tilemaps.onSelectionChange = this.m_onSelectionChange.bind(this);
    this.catalog = options.catalog === false ? null : new runeos.launcher.CategoryTilemapManager(this.m_tilemaps, {
        config: this.m_tileConfig,
        textConfig: this.m_textConfig,
        explanationConfig: this.m_config,
        libraryConfig: runeos.system.Config.getGroup("library")
    });
};

/**
 * Connects the launcher to presentation without sharing its internal state.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_constructLauncher = function() {
    this.m_launcher = new runeos.application.ApplicationLauncher({
        returnScene: this,
        onChange: this.m_onLaunchChange.bind(this)
    });
};

/**
 * Connects inactivity policy to the scene-owned overlay and launch service.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_constructIdle = function() {
    this.m_idle = new runeos.launcher.LauncherIdle({
        config: this.m_config,
        dimmer: this.m_screenDimmer,
        launcher: this.m_launcher,
        onScreensaver: this.m_startScreensaver.bind(this)
    });
};

/**
 * Supplies scene-manager context to an automatic launch request.
 *
 * @param {Object} request Prepared screensaver launch metadata.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_startScreensaver = function(request) {
    request.scenes = runeos.instance.scenes;
    var launcher = this.m_launcher;
    var start = function() { launcher.launch(request); };
    if (runeos.instance && runeos.instance.screenFade) runeos.instance.screenFade.cover(start);
    else start();
};

/**
 * Presents launch progress while the launcher owns all asynchronous work.
 *
 * @param {string} state Launch event.
 * @param {Object} request Named launch request.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_onLaunchChange = function(state, request) {
    if (this.m_disposed) return;
    if ((state === "failed" || state === "cancelled") && runeos.instance.screenFade) runeos.instance.screenFade.reveal();
    if (state === "accepted" && request.kind !== "screensaver") {
        this.m_idle.reset();
        var messages = runeos.system.Config.getGroup("notifications");
        this.m_showMessage(messages.starting, {
            delayMs: messages.startDelayMs,
            persistent: true
        });
    } else if (state === "ready" && request.kind !== "screensaver") {
        this.m_playStartSound();
    } else if (state === "cancelled") {
        this.m_idle.reset();
        if (this.m_notification) this.m_notification.hide();
    } else if (state === "failed") {
        this.m_showLaunchError(request);
    }
};

/**
 * Refreshes changed availability and presents failures for manual launches.
 *
 * @param {Object} request Failed launch metadata.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_showLaunchError = function(request) {
    this.m_idle.reset();
    if (this.catalog && request.data && request.data.installed === false) {
        this.catalog.refresh();
        this.m_updateCategoryHeader();
    }
    if (request.kind !== "screensaver") this.showError(runeos.system.Config.getGroup("notifications").startError);
};

/**
 * Presents a committed selection. Only navigation changes play a selection sound;
 * catalog refreshes and programmatic selection changes remain silent.
 *
 * @param {?runeos.ui.tilemap.Tilemap} map Current map.
 * @param {?runeos.ui.tilemap.Tile} tile Current Tile.
 * @param {Object} previous Previous selection snapshot.
 * @param {string} reason Change reason.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_onSelectionChange = function(map, tile, previous, reason) {
    if (this.m_disposed || this.m_refreshing) return;
    this.m_updateCategoryHeader();
    if (reason !== "navigation" || !tile || !this.m_navigateSound) return;
    var effect = map !== previous.tilemap ? this.m_audioConfig.categoryChange : this.m_audioConfig.selection;
    if (!effect.enabled) return;
    this.m_navigateSound.volume = effect.volume;
    this.m_navigateSound.rate = effect.playbackRate * (1 - effect.pitchVariation + Math.random() * effect.pitchVariation * 2);
    this.m_navigateSound.play(true);
};

/**
 * Supplies the header with the selected category and its centered content span.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Launcher.prototype.m_updateCategoryHeader = function() {
    var tilemaps = this.m_tilemaps;
    var header = this.m_categoryHeader;
    var selected = tilemaps["selection"].tilemap;
    if (!selected) {
        header.setCategory("", "", tilemaps["navigableIndex"], tilemaps["navigableCount"]);
        header.setContentBounds(0, header.width);
        return;
    }
    var centeredOffset = (tilemaps.width - selected.width) / 2;
    var contentLeft = tilemaps.x + centeredOffset - header.x;
    header.setCategory(
        selected.name,
        selected.description,
        tilemaps["navigableIndex"],
        tilemaps["navigableCount"],
        selected.length
    );
    header.setContentBounds(contentLeft, selected.width);
};
