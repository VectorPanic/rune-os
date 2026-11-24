//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Config instance.
 *
 * @constructor
 *
 * @param {Object} [options] Partial overrides of the documented default groups.
 *
 * @class
 * @classdesc
 *
 * Validates and freezes an independent runtime configuration. Unknown keys and
 * invalid values fail before startup. Defaults and caller-owned objects are
 * never changed. Components receive only the groups relevant to their work.
 */
runeos.system.Config = function(options) {
    
    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------
    
    var copies = new runeos.system.config.Values();
    var values = copies.merge(runeos.system.Config.DEFAULTS, options, "config");
    new runeos.system.config.Validation().validate(values);
    copies.freeze(values);

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Boot logo, animation and preparation settings.
     *
     * @type {Object}
     */
    this.boot = values.boot;

    /**
     * Launcher appearance and scene-transition settings.
     *
     * @type {Object}
     */
    this.selector = values.selector;

    /**
     * Subtle light fields behind Launcher content.
     *
     * @type {Object}
     */
    this.launcherBackground = values.launcherBackground;

    /**
     * Tile dimensions, selection effects and labels.
     *
     * @type {Object}
     */
    this.tiles = values.tiles;

    /**
     * Category spacing, transitions and inactive opacity.
     *
     * @type {Object}
     */
    this.tilemaps = values.tilemaps;

    /**
     * Typography, contrast and text-scrolling settings.
     *
     * @type {Object}
     */
    this.text = values.text;

    /**
     * Master controls and per-event sound settings.
     *
     * @type {Object}
     */
    this.audio = values.audio;

    /**
     * Controller navigation thresholds and exit hold time.
     *
     * @type {Object}
     */
    this.input = values.input;

    /**
     * Hosted-game inactivity and warning durations.
     *
     * @type {Object}
     */
    this.applicationIdle = values.applicationIdle;

    /**
     * Delayed progress overlay shown while holding an application exit shortcut.
     *
     * @type {Object}
     */
    this.exitIndicator = values.exitIndicator;

    /**
     * Shared-canvas fade durations when entering and waking screensavers.
     *
     * @type {Object}
     */
    this.screensaverTransition = values.screensaverTransition;

    /**
     * Timed screensaver attribution in the lower-left corner.
     *
     * @type {Object}
     */
    this.screensaverCredits = values.screensaverCredits;

    /**
     * Catalog URLs and file-loading timeouts.
     *
     * @type {Object}
     */
    this.loading = values.loading;

    /**
     * Development stages included in the visible catalog.
     *
     * @type {Object}
     */
    this.library = values.library;

    /**
     * Background catalog synchronization scheduling.
     *
     * @type {Object}
     */
    this.sync = values.sync;

    /**
     * User-facing messages and temporary notification presentation.
     *
     * @type {Object}
     */
    this.notifications = values.notifications;

    /**
     * Size-promotion probabilities and category-exclusivity weight.
     *
     * @type {Object}
     */
    this.priority = values.priority;

    /**
     * Bounded layout-search settings.
     *
     * @type {Object}
     */
    this.advanced = values.advanced;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Prevents replacing validated groups after startup.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Complete defaults preserving the established appearance and behavior.
 * Durations use milliseconds, lengths use logical pixels, and opacity, volume
 * and probability use the range zero to one. These defaults are immutable.
 *
 * @constant {!Object}
 */
runeos.system.Config.DEFAULTS = new runeos.system.config.Values().freeze({
    boot: {
        logoUrl: "../asset/png/runeos_image_logo.png",
        logoSizePx: 256,
        backgroundColor: "#000000",
        fadeInMs: 350,
        holdMs: 450,
        fadeOutMs: 250,
        imageTimeoutMs: 5000,
        pulseEnabled: true,
        pulsePeriodMs: 1600,
        pulseAmount: 0.04
    },
    selector: {
        glitch: false,
        refreshHoldMs: 3000,
        navigationRepeatDelayMs: 500,
        navigationRepeatIntervalMs: 200,
        idleEnabled: true,
        idleDelayMs: 15000,
        idleOpacity: 0.5,
        idleFadeMs: 500,
        screensaverEnabled: true,
        screensaverDelayMs: 30000,
        backgroundColor: "#101722",
        menuBarHeightPx: 68,
        headerGapPx: 12,
        fadeInMs: 250,
        fadeOutMs: 150,
        menuFadeInMs: 200,
        menuFadeOutMs: 100,
        enterOffsetYPx: 16,
        exitOffsetYPx: 8,
        startupFadeMs: 250,
        launchFadeMinMs: 150,
        launchFadeMaxMs: 1000,
        launchSoundMarginMs: 40,
        showMatchReasons: true,
        reasonMaxTerms: 3,
        reasonMinStrength: 40,
        coopReason: "Co-op",
        versusReason: "Versus",
        soloReason: "Solo",
        fallbackReason: "More to discover"
    },
    launcherBackground: {
        enabled: true,
        fieldOpacity: 0.12,
        periodMs: 90000,
        radiusRatio: 0.7,
        travelRatio: 0.12,
        color: "#31577f",
        secondaryColor: "#28476b"
    },
    tiles: {
        sizePx: 216,
        paddingPx: 10,
        columns: 3,
        backgroundColor: "#26354a",
        selectedScale: 1.25,
        selectionTransitionMs: 200,
        selectionOvershoot: 1.2,
        breathingEnabled: true,
        breathingPeriodMs: 2800,
        breathingAmount: 0.015,
        breathingSettleMs: 60,
        focusScalePadding: 0.015,
        inactiveOpacity: 0.65,
        borderWidthPx: 4,
        borderColor: "#ffffff",
        shadowOpacity: 0.2,
        shadowOffsetXPx: 8,
        shadowOffsetYPx: 10,
        iconFadeMs: 300,
        labelPaddingPx: 16,
        titleBottomPaddingPx: 16,
        metadataBottomPaddingPx: 18,
        labelGapPx: 2,
        labelGradientOpacity: 0.75,
        labelGradientPaddingPx: 24,
        labelImageTextColor: "#ffffff",
        labelAccentColor: "#ff7078",
        stageBackgroundColor: "#000000",
        stagePaddingPx: 6,
        labelShadowColor: "rgba(0,0,0,0.65)",
        labelShadowBlurPx: 2,
        labelShadowOffsetYPx: 1
    },
    tilemaps: {
        gapPx: 150,
        bottomPaddingPx: 48,
        transitionMs: 250,
        inactiveOpacity: 0.5
    },
    text: {
        color: "#ffffff",
        defaultOpacity: 1,
        shadowColor: "transparent",
        shadowBlurPx: 0,
        shadowOffsetXPx: 0,
        shadowOffsetYPx: 0,
        headingFontUrl: "../asset/otf/runeos_font_header.otf",
        headingFamily: "\"RuneOS Heading\", sans-serif",
        bodyFamily: "sans-serif",
        titleSizePx: 30,
        gameSizePx: 28,
        bodySizePx: 20,
        positionSizePx: 16,
        detailSizePx: 16,
        studioSizePx: 13,
        metadataSizePx: 14,
        stageSizePx: 13,
        reasonSizePx: 12,
        detailDelayMs: 200,
        detailFadeInMs: 200,
        reasonOpacity: 0.8,
        reasonScrollSpeedPxPerSecond: 20,
        metadataOpacity: 0.65,
        studioOpacity: 0.85,
        stageOpacity: 1,
        descriptionOpacity: 0.75,
        positionOpacity: 0.6,
        countOpacity: 0.75,
        scrollSpeedPxPerSecond: 30,
        scrollPauseMs: 1200,
        titleScrollPauseMs: 1500,
        scrollGapPx: 48,
        scrollStartVariationMs: 3000,
        studioScrollSpeedPxPerSecond: 20,
        studioScrollPauseMs: 1800,
        descriptionScrollSpeedPxPerSecond: 20,
        brightnessThreshold: 0.75
    },
    audio: {
        masterVolume: 1,
        muted: false,
        boot: {
            enabled: true,
            url: "../asset/wav/runeos_sound_boot.wav",
            volume: 1
        },
        selection: {
            enabled: true,
            url: "../asset/wav/runeos_sound_navigate.wav",
            volume: 1,
            playbackRate: 1,
            pitchVariation: 0.12
        },
        categoryChange: {
            enabled: true,
            volume: 1,
            playbackRate: 0.7,
            pitchVariation: 0.3
        },
        start: {
            enabled: true,
            url: "../asset/wav/runeos_sound_start.wav",
            volume: 1
        },
        stop: {
            enabled: true,
            url: "../asset/wav/runeos_sound_stop.wav",
            volume: 1
        }
    },
    input: {
        useKeyboard: true,
        useGamepads: true,
        navigationStick: "right",
        stickEngage: 0.55,
        stickRelease: 0.35,
        buttonThreshold: 0.5,
        exitHoldMs: 1500
    },
    applicationIdle: {
        enabled: true,
        delayMs: 30000,
        warningMs: 5000
    },
    screensaverTransition: {
        coverMs: 300,
        revealMs: 400,
        creditsDelayMs: 500,
        rotationIntervalMs: 300000
    },
    screensaverCredits: {
        enabled: true,
        minFontSizePx: 12,
        fadeInMs: 2500,
        holdMs: 5000,
        fadeOutMs: 2500,
        backgroundOpacity: 0.7,
        marginPx: 24,
        paddingPx: 8,
        maxWidthPx: 720
    },
    exitIndicator: {
        enabled: true,
        delayMs: 200,
        sizePx: 44,
        strokeWidthPx: 3,
        marginPx: 28,
        color: "#ffffff",
        backgroundColor: "#000000",
        backgroundOpacity: 0.65,
        trackOpacity: 0.2
    },
    loading: {
        gamesUrl: "../library/games.json",
        categoriesUrl: "../library/categories.json",
        tagsUrl: "../library/tags.json",
        screensaversUrl: "../library/screensavers.json",
        timeoutMs: 15000,
        audioTimeoutMs: 15000
    },
    sync: {
        enabled: true,
        apiEnabled: false,
        highscoresEnabled: false,
        baseUrl: "http://localhost:8888/rune-cloud/v1/",
        timeoutMs: 15000,
        maxFiles: 10000,
        maxManifestSizeBytes: 2097152,
        maxFileSizeBytes: 268435456,
        maxTotalSizeBytes: 536870912,
        initialDelayMs: 1500,
        idleDelayMs: 5000,
        intervalMs: 900000,
        retryMs: 60000
    },
    library: {
        stages: ["gold", "beta", "alpha"],
        inspectionConcurrency: 4
    },
    notifications: {
        idleWarning: "Press a button to keep playing. Menu in {seconds}s.",
        exitHint: "Hold ESC or SELECT + START to exit",
        exitHintHoldMs: 5000,
        starting: "Starting...",
        startDelayMs: 400,
        startError: "Unable to start the game.",
        runtimeError: "The game stopped unexpectedly.",
        libraryError: "Unable to load the game library.",
        emptyLibrary: "No games found. Add games, then press F5 or hold SELECT.",
        emptySyncedLibrary: "No games available yet. Games sync automatically.",
        syncingLibrary: "Syncing...",
        updatingLibrary: "Updating library...",
        libraryUpToDate: "Library is up to date",
        syncError: "Game sync failed. Retrying automatically.",
        noAvailableGames: "No games available. Check the library settings.",
        backgroundColor: "#151c28",
        textColor: "#ffffff",
        backgroundOpacity: 0.94,
        maxWidthPx: 600,
        paddingPx: 16,
        marginPx: 24,
        fadeInMs: 150,
        holdMs: 4000,
        fadeOutMs: 250
    },
    priority: {
        largeChance: 0.15,
        wideChance: 0.3,
        exclusivityBonus: 0.2
    },
    advanced: {
        layoutMaxTiles: 100,
        layoutMaxAttempts: 20000
    }
});

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Resolves a component group from the active runtime or immutable defaults.
 * Explicit component overrides are validated against the same schema.
 *
 * @param {string} name Known configuration group.
 * @param {Object} [options] Optional partial overrides for this group.
 *
 * @returns {Object} Immutable configuration group.
 */
runeos.system.Config.getGroup = function(name, options) {
    var root = runeos.instance && runeos.instance.config || runeos.system.Config.DEFAULTS;
    if (!Object.prototype.hasOwnProperty.call(runeos.system.Config.DEFAULTS, name)) {
        throw new Error("Unknown configuration group: " + name);
    }
    if (options === undefined || options === root[name]) return root[name];
    var groups = {};
    Object.keys(root).forEach(function(key) { groups[key] = root[key]; });
    var copies = new runeos.system.config.Values();
    groups[name] = copies.merge(root[name], options, "config." + name);
    new runeos.system.config.Validation().validate(groups);
    return copies.freeze(groups[name]);
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Creates independent settings by applying partial overrides to this snapshot.
 * Uses the same schema, validation and freezing rules as initial construction.
 *
 * @param {Object} [options] Partial configuration overrides.
 *
 * @returns {runeos.system.Config} New immutable configuration.
 */
runeos.system.Config.prototype.withOverrides = function(options) {
    return new runeos.system.Config(new runeos.system.config.Values().merge(this, options, "config"));
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Prevents replacing validated groups after startup.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.Config.prototype.m_construct = function() {
    Object.freeze(this);
};
