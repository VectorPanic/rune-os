//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new LocalLibrary instance.
 *
 * @constructor
 * @extends runeos.library.Library
 *
 * @param {runeos.library.LocalLibrary.Options} [options] Optional catalog URLs, root and loading settings.
 *
 * @class
 * @classdesc
 *
 * Reads local JSON and resolves existing local game URLs without an API
 * service.
 */
runeos.library.LocalLibrary = function(options) {

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    runeos.library.Library.call(this);

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Games document URL, relative to the launcher.
     *
     * @type {string}
     */
    this.gamesUrl = "";

    /**
     * Categories document URL, relative to the launcher.
     *
     * @type {string}
     */
    this.categoriesUrl = "";

    /**
     * Independent DNA vocabulary document URL.
     *
     * @type {string}
     */
    this.tagsUrl = "";

    /**
     * Independent screensaver document URL.
     *
     * @type {string}
     */
    this.screensaversUrl = "";

    /**
     * Latest inspection report per internal game identifier.
     *
     * @type {Object}
     */
    this.installations = Object.create(null);

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable loading settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("loading", options.config);

    /**
     * Optional content root for portable game and icon paths.
     *
     * @type {string}
     * @private
     */
    this.m_rootUrl = "";

    /**
     * Validated games available for launching.
     *
     * @type {runeos.catalog.GameRegistry}
     * @private
     */
    this.m_games = null;

    /**
     * Independent screensaver loading and launch ownership.
     *
     * @type {runeos.library.ScreensaverLibrary}
     * @private
     */
    this.m_screensaverLibrary = null;

    /**
     * Category rules for the currently published catalog.
     *
     * @type {runeos.catalog.CategoryRegistry}
     * @private
     */
    this.m_categories = new runeos.catalog.CategoryRegistry();

    /**
     * Shared local/remote transport owned by this content provider.
     *
     * @type {runeos.util.FileLoader}
     * @private
     */
    this.m_files = new runeos.util.FileLoader({config: this.m_config});

    /**
     * Owned checker for installed game content.
     *
     * @type {runeos.library.ContentInspector}
     * @private
     */
    this.m_inspector = new runeos.library.ContentInspector({loadingConfig: this.m_config});

    /**
     * Shared in-flight catalog load.
     *
     * @type {Promise}
     * @private
     */
    this.m_pending = null;

    /**
     * Optional published-directory provider; explicit catalogs retain compatibility.
     *
     * @type {Function}
     * @private
     */
    this.m_listGameFolders = null;

    /**
     * Invalidates cancelled or superseded responses.
     *
     * @type {number}
     * @private
     */
    this.m_generation = 0;

    /**
     * Permanent teardown flag.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    this.m_construct(options);

};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.library.LocalLibrary.prototype = Object.create(runeos.library.Library.prototype);
runeos.library.LocalLibrary.prototype.constructor = runeos.library.LocalLibrary;

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Optional local document URLs and native folder discovery capabilities.
 *
 * @typedef {{
 *     config: (Object|undefined),
 *     rootUrl: (string|undefined),
 *     gamesUrl: (string|undefined),
 *     categoriesUrl: (string|undefined),
 *     tagsUrl: (string|undefined),
 *     screensaversUrl: (string|undefined),
 *     listGameFolders: (Function|undefined),
 *     listScreensaverFolders: (Function|undefined)
 * }}
 */
runeos.library.LocalLibrary.Options;

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * @inheritDoc
 *
 * @param {boolean} [force=false] Whether to refresh the cached catalog.
 * @param {boolean} [strict=false] Whether incomplete updates must preserve the active list.
 */
runeos.library.LocalLibrary.prototype.loadCatalog = function(force, strict) {
    if (this.m_disposed) return Promise.reject(new Error("Library is disposed."));
    if (!force && this.m_pending) return this.m_pending;
    if (!force && this.catalog) return Promise.resolve(this.catalog);
    this.m_cancelRequests();
    var generation = this.m_generation;
    var library = this;
    this.m_pending = Promise.all([this.m_readGames(generation), this.m_read(this.categoriesUrl), this.m_read(this.tagsUrl)]).then(function(documents) {
        return library.m_prepareCatalog(documents, generation, strict);
    }).catch(function(error) {
        if (generation === library.m_generation) library.m_cancelRequests();
        throw error;
    });
    return this.m_pending;
};

/**
 * Rechecks startup requirements before returning the registered executable URL.
 *
 * @param {string} gameId Registered game ID.
 *
 * @returns {Promise.<string>} Local bundle URL.
 */
runeos.library.LocalLibrary.prototype.prepareGame = function(gameId) {
    if (this.m_disposed) return Promise.reject(new Error("Library is disposed."));
    var game = this.m_games && this.m_games.get(gameId);
    if (!game) return Promise.reject(new Error("Unknown game: " + gameId));
    if (game.installed === false) return Promise.reject(new Error("Game is not installed: " + game.name));
    var library = this;
    var generation = this.m_generation;
    return this.m_inspector.check(game, false).then(function(report) {
        library.m_assertCurrent(generation);
        if (!report.installed) {
            library.m_storeInspection(/**
                 * The registered definition was checked before starting inspection.
                 * @type {!runeos.catalog.GameRegistry.Definition}
                 */ (game), report);
            library.errors = library.errors.concat(report.errors);
            throw Error(report.errors.join("; "));
        }
        return game.binary;
    });
};

/**
 * Loads screensavers separately, preserving independent rules and diagnostics.
 *
 * @param {boolean} [force=false] Whether to refresh the screensaver document.
 * @param {boolean} [strict=false] Whether incomplete updates must preserve the active list.
 *
 * @returns {Promise.<Array.<Object>>} Inspected screensaver definitions.
 */
runeos.library.LocalLibrary.prototype.loadScreensavers = function(force, strict) {
    if (this.m_disposed) return Promise.reject(Error("Library is disposed."));
    var library = this;
    return this.m_screensaverLibrary.load(force, strict).then(function(items) {
        if (library.m_disposed) throw Error("Library is disposed.");
        library.screensavers = items;
        return items;
    });
};

/**
 * Prepares a screensaver through its independent content provider.
 *
 * @param {string} id Registered screensaver identifier.
 *
 * @returns {Promise.<string>} Ready executable URL.
 */
runeos.library.LocalLibrary.prototype.prepareScreensaver = function(id) {
    if (this.m_disposed) return Promise.reject(Error("Library is disposed."));
    return this.m_screensaverLibrary.prepare(id);
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * @inheritDoc
 */
runeos.library.LocalLibrary.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_cancelRequests();
    this.m_files.dispose();
    this.m_inspector.dispose();
    this.m_screensaverLibrary.dispose();
    this.installations = Object.create(null);
    this.m_games = null;
    this.m_categories = null;
    runeos.library.Library.prototype.dispose.call(this);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Initializes document locations and owned library components.
 *
 * @param {Object} [options] Catalog URLs, content root and loading settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.library.LocalLibrary.prototype.m_construct = function(options) {
    var settings = this.m_config;
    var root = options.rootUrl ? runeos.util.Paths.root(options.rootUrl) : "";
    var defaults = runeos.system.Config.DEFAULTS.loading;

    this.gamesUrl = this.m_resolveDocumentUrl("games", options, settings, root);
    this.categoriesUrl = this.m_resolveDocumentUrl("categories", options, settings, root);
    this.tagsUrl = this.m_resolveDocumentUrl("tags", options, settings, root);
    this.screensaversUrl = this.m_resolveDocumentUrl("screensavers", options, settings, root);
    this.m_rootUrl = root || (runeos.util.Paths.BASE_URL ? runeos.util.Paths.directory(this.gamesUrl) : "");

    this.m_screensaverLibrary = new runeos.library.ScreensaverLibrary({
        url: this.screensaversUrl,
        rootUrl: this.m_rootUrl,
        config: this.m_config,
        listFolders: options.listScreensaverFolders,
        discover: options.screensaversUrl === undefined && settings.screensaversUrl === defaults.screensaversUrl
    });

    var environment = typeof window !== "undefined" && window.runeosEnvironment;
    this.m_listGameFolders = options.listGameFolders || (options.gamesUrl === undefined && settings.gamesUrl === defaults.gamesUrl &&
        environment && environment.listGameFolders && environment.listGameFolders.bind(environment, this.m_rootUrl)) || null;

};

/**
 * Resolves an explicit URL before configured and library-root defaults.
 * Custom URLs remain relative to the launcher; only default documents use root.
 *
 * @param {string} name Document name without extension.
 * @param {Object} options Explicit library options.
 * @param {Object} settings Resolved loading settings.
 * @param {string} root Normalized library root, or an empty string.
 *
 * @returns {string} Selected document URL.
 * @private
 */
runeos.library.LocalLibrary.prototype.m_resolveDocumentUrl = function(name, options, settings, root) {
    var key = name + "Url";
    if (options[key] !== undefined) return options[key];
    var url = settings[key];
    if (root && url === runeos.system.Config.DEFAULTS.loading[key]) return root + name + ".json";
    return url;
};

/**
 * Prepares a candidate without changing the active catalog.
 *
 * @param {Array.<!Object>} documents Games, categories and tags documents.
 * @param {number} generation Catalog generation.
 * @param {boolean} [strict=false] Whether incomplete candidates must be rejected.
 *
 * @returns {Promise.<Object>} Published catalog.
 * @private
 */
runeos.library.LocalLibrary.prototype.m_prepareCatalog = function(documents, generation, strict) {
    this.m_assertCurrent(generation);
    var candidate = this.m_validateCatalog(documents);
    return this.m_inspectCatalog(candidate, generation, strict);
};

/**
 * Builds independent registries and resolves paths for a candidate catalog.
 * Invalid documents reject the candidate; invalid records remain diagnostics.
 *
 * @param {Array.<!Object>} documents Games, categories and tags documents.
 *
 * @returns {Object} Validated catalog, registries and metadata diagnostics.
 * @private
 */
runeos.library.LocalLibrary.prototype.m_validateCatalog = function(documents) {
    if (!documents[0] || !Array.isArray(documents[0].games) ||
        !documents[1] || !Array.isArray(documents[1].categories) ||
        !documents[2] || !Array.isArray(documents[2].tags)) throw Error("Invalid catalog documents.");
    var document = this.m_resolveGames(documents[0]);
    var tags = new runeos.catalog.TagRegistry();
    if (tags.replace(documents[2]).length) throw Error("Invalid tags document: " + tags.errors.join("; "));
    var categories = new runeos.catalog.CategoryRegistry(tags.ids, tags.baseIds);
    categories.replace(documents[1]);
    var games = new runeos.catalog.GameRegistry(tags.ids, tags.baseIds);
    games.replace(document);
    document.games = games.items;
    return {
        catalog: {
            games: document,
            categories: documents[1],
            tags: documents[2]
        },
        games: games,
        categories: categories,
        errors: (documents[0].errors || []).concat(categories.errors, games.errors)
    };
};

/**
 * Waits for content inspection before publishing the candidate.
 *
 * @param {Object} candidate Validated candidate and registries.
 * @param {number} generation Catalog generation.
 * @param {boolean} [strict=false] Whether incomplete candidates must be rejected.
 *
 * @returns {Promise.<Object>} Published catalog.
 * @private
 */
runeos.library.LocalLibrary.prototype.m_inspectCatalog = function(candidate, generation, strict) {
    var library = this;
    return this.m_inspector.checkAll(candidate.games.items).then(function(reports) {
        library.m_assertCurrent(generation);
        if (strict && library.catalog && (candidate.errors.length || reports.some(function(report) { return !report.installed; }))) {
            throw Error("Library update contains invalid or incomplete games.");
        }
        return library.m_publishCatalog(candidate, reports);
    });
};

/**
 * Commits the inspected candidate and its diagnostics as the active catalog.
 *
 * @param {Object} candidate Validated candidate and registries.
 * @param {Array.<Object>} reports Inspection reports in game order.
 *
 * @returns {Object} Published catalog.
 * @private
 */
runeos.library.LocalLibrary.prototype.m_publishCatalog = function(candidate, reports) {
    this.m_publishInspections(candidate.games.items, reports);
    this.errors = candidate.errors;
    var library = this;
    reports.forEach(function(report) {
        library.errors = library.errors.concat(report.errors);
        report.errors.forEach(function(message) { console.warn("Library: " + message); });
    });
    this.m_games = candidate.games;
    this.m_categories = candidate.categories;
    this.catalog = candidate.catalog;
    this.m_pending = null;
    return this.catalog;
};

/**
 * Stores availability on copied definitions and publishes inspection reports.
 *
 * @param {Array.<runeos.catalog.GameRegistry.Definition>} games Validated game definitions.
 * @param {Array.<Object>} reports Inspection reports in game order.
 *
 * @returns {undefined}
 * @private
 */
runeos.library.LocalLibrary.prototype.m_publishInspections = function(games, reports) {
    this.installations = Object.create(null);
    var library = this;
    games.forEach(function(game, index) { library.m_storeInspection(game, reports[index]); });
};

/**
 * Updates the shared definition and its installed-content report together.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Copied game definition.
 * @param {Object} report Inspection report.
 *
 * @returns {undefined}
 * @private
 */
runeos.library.LocalLibrary.prototype.m_storeInspection = function(game, report) {
    game.installed = report.installed;
    game.imageAvailable = report.imageAvailable;
    this.installations[runeos.catalog.GameRegistry.getId(game)] = report;
};

/**
 * Rejects catalog work superseded by refresh or disposal.
 *
 * @param {number} generation Catalog generation.
 *
 * @returns {undefined}
 * @private
 */
runeos.library.LocalLibrary.prototype.m_assertCurrent = function(generation) {
    if (this.m_disposed || generation !== this.m_generation) throw Error("Catalog load was cancelled.");
};

/**
 * Reads and parses one JSON document with timeout and cancellation.
 *
 * @param {string} url Local document URL.
 *
 * @returns {Promise.<Object>}
 * @private
 */
runeos.library.LocalLibrary.prototype.m_read = function(url) {
    var files = this.m_files;
    return new Promise(function(resolve, reject) {
        files.json(url, resolve, reject);
    });
};

/**
 * Invalidates pending results and aborts outstanding catalog requests.
 *
 * @returns {undefined}
 * @private
 */
runeos.library.LocalLibrary.prototype.m_cancelRequests = function() {
    this.m_generation++;
    this.m_files.clear();
    this.m_inspector.clear();
    this.m_pending = null;
};

/**
 * Copies game metadata and resolves content paths against the supplied root.
 *
 * @param {!Object} document Parsed games document.
 *
 * @returns {Object} Catalog with launcher-ready resource paths.
 * @private
 */
runeos.library.LocalLibrary.prototype.m_resolveGames = function(document) {
    var library = this;
    var resolved = {};
    Object.keys(document).forEach(function(key) { resolved[key] = document[key]; });
    resolved.games = document.games.map(function(game) {
        if (!game || typeof game !== "object") return game;
        var copy = {};
        Object.keys(game || {}).forEach(function(key) { copy[key] = game[key]; });
        copy.binary = library.m_resolvePath(game.binary);
        copy.image = library.m_resolvePath(game.image);
        return copy;
    });
    return resolved;
};

/**
 * Normalizes a content URL using the library root.
 *
 * @param {*} value Catalog path.
 *
 * @returns {*} Resolved path, or invalid input for record-level validation.
 * @private
 */
runeos.library.LocalLibrary.prototype.m_resolvePath = function(value) {
    if (typeof value !== "string" || !value.trim()) return value;
    try {
        return runeos.util.Paths.resolve(value, this.m_rootUrl);
    } catch (error) {
        return null;
    }
};

/**
 * Selects directory discovery or an explicitly supplied legacy manifest.
 *
 * @param {number} generation Active catalog generation.
 *
 * @returns {Promise.<Object>} Games document.
 * @private
 */
runeos.library.LocalLibrary.prototype.m_readGames = function(generation) {
    if (!this.m_listGameFolders) return this.m_read(this.gamesUrl);
    var library = this;
    var folders = new runeos.library.ContentFolders(this.m_listGameFolders, function(url) {
        return library.m_read(url);
    }, this.m_rootUrl, {
        directory: "games",
        prefix: "game",
        image: true
    });
    return folders.load(function() { library.m_assertCurrent(generation); }).then(function(document) {
        return {
            games: document.items,
            errors: document.errors
        };
    });
};
