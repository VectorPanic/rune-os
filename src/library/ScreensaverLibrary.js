//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ScreensaverLibrary instance.
 *
 * @constructor
 *
 * @param {Object} [options] Directory adapter, legacy JSON URL, content root and loading settings.
 *
 * @class
 * @classdesc
 *
 * Owns screensaver loading, validation, installed-content inspection and launch
 * rechecks. A failed refresh preserves the last usable definitions.
 */
runeos.library.ScreensaverLibrary = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};
    var environment = typeof window !== "undefined" && window.runeosEnvironment;

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Last successfully loaded definitions.
     *
     * @type {Array.<Object>}
     */
    this.items = [];

    /**
     * Current validation and content diagnostics.
     *
     * @type {Array.<string>}
     */
    this.errors = [];

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Absolute document URL.
     *
     * @type {string}
     * @private
     */
    this.m_url = runeos.util.Paths.resolve(options.url);

    /**
     * Root for executable paths, independent of the game catalog.
     *
     * @type {string}
     * @private
     */
    this.m_root = options.rootUrl || runeos.util.Paths.directory(this.m_url);

    /**
     * Shared transport for document ownership and cancellation.
     *
     * @type {runeos.util.FileLoader}
     * @private
     */
    this.m_files = new runeos.util.FileLoader({config: options.config});

    /**
     * Shared metadata-only installed-content checker.
     *
     * @type {runeos.library.ContentInspector}
     * @private
     */
    this.m_inspector = new runeos.library.ContentInspector({loadingConfig: options.config});

    /**
     * Last committed registry.
     *
     * @type {runeos.catalog.ScreensaverRegistry}
     * @private
     */
    this.m_registry = new runeos.catalog.ScreensaverRegistry();

    /**
     * Shared in-flight load.
     *
     * @type {Promise}
     * @private
     */
    this.m_pending = null;

    /**
     * Whether a document has been successfully loaded.
     *
     * @type {boolean}
     * @private
     */
    this.m_loaded = false;

    /**
     * Optional directory discovery provider, independent of the game catalog.
     *
     * @type {Function}
     * @private
     */
    this.m_listFolders = options.listFolders || (options.discover !== false && environment &&
        environment.listScreensaverFolders && environment.listScreensaverFolders.bind(environment, this.m_root)) || null;

    /**
     * Invalidates superseded loads and launch checks.
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

};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Loads a complete candidate before replacing the last valid screensaver list.
 *
 * @param {boolean} [force=false] Whether to refresh cached data.
 * @param {boolean} [strict=false] Whether incomplete updates must preserve the active list.
 *
 * @returns {Promise.<Array.<Object>>} Inspected definitions.
 */
runeos.library.ScreensaverLibrary.prototype.load = function(force, strict) {
    if (this.m_disposed) return Promise.reject(Error("ScreensaverLibrary is disposed."));
    if (!force && this.m_pending) return this.m_pending;
    if (!force && this.m_loaded) return Promise.resolve(this.items);
    this.m_cancel();
    var library = this;
    var generation = this.m_generation;
    this.m_pending = this.m_readDefinitions(generation).then(function(document) {
        library.m_assertCurrent(generation);
        var candidate = library.m_buildCandidate(document);
        return library.m_checkCandidate(candidate, strict, generation);
    }).then(function(candidate) {
        library.m_assertCurrent(generation);
        return library.m_activateCandidate(candidate);
    }).catch(function(error) {
        if (generation === library.m_generation) library.m_cancel();
        throw error;
    });
    return this.m_pending;
};

/**
 * Rechecks the executable and required files before automatic launch.
 *
 * @param {string} id Registered screensaver identifier.
 *
 * @returns {Promise.<string>} Ready executable URL.
 */
runeos.library.ScreensaverLibrary.prototype.prepare = function(id) {
    if (this.m_disposed) return Promise.reject(Error("ScreensaverLibrary is disposed."));
    var item = this.m_registry.get(id);
    if (!item || item.enabled === false || item.installed === false) return Promise.reject(Error("Screensaver is unavailable: " + id));
    var library = this;
    var generation = this.m_generation;
    return this.m_inspector.check(item, false).then(function(report) {
        library.m_assertCurrent(generation);
        item.installed = report.installed;
        if (!report.installed) throw Error(report.errors.join("; "));
        return item.binary;
    });
};

/**
 * Releases document and inspection requests and retained definitions.
 *
 * @returns {undefined}
 */
runeos.library.ScreensaverLibrary.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_cancel();
    this.m_files.dispose();
    this.m_inspector.dispose();
    this.m_registry = null;
    this.items = [];
    this.errors = [];
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Builds an isolated registry with resolved paths and metadata diagnostics.
 *
 * @param {Object} document Raw definitions and optional discovery errors.
 *
 * @returns {Object} Candidate registry and diagnostics.
 * @private
 */
runeos.library.ScreensaverLibrary.prototype.m_buildCandidate = function(document) {
    if (!document || !Array.isArray(document.screensavers)) throw Error("Invalid screensavers document.");
    var library = this;
    var registry = new runeos.catalog.ScreensaverRegistry();
    registry.replace({screensavers: document.screensavers.map(function(item) { return library.m_resolve(item); })});
    return {registry: registry, errors: (document.errors || []).concat(registry.errors)};
};

/**
 * Inspects candidate files without changing the active definitions or diagnostics.
 *
 * @param {Object} candidate Isolated registry and diagnostics.
 * @param {boolean|undefined} strict Whether an incomplete update must be rejected.
 * @param {number} generation Generation captured before loading.
 *
 * @returns {Promise.<Object>} Inspected candidate ready for activation.
 * @private
 */
runeos.library.ScreensaverLibrary.prototype.m_checkCandidate = function(candidate, strict, generation) {
    var library = this;
    return this.m_inspector.checkAll(candidate.registry.items, false).then(function(reports) {
        library.m_assertCurrent(generation);
        if (strict && library.m_loaded && (candidate.errors.length ||
            reports.some(function(report) { return !report.installed; }))) {
            throw Error("Library update contains invalid or incomplete screensavers.");
        }
        candidate.registry.items.forEach(function(item, index) {
            item.installed = reports[index].installed;
            candidate.errors = candidate.errors.concat(reports[index].errors);
        });
        return candidate;
    });
};

/**
 * Commits a completed candidate as the active library and reports its diagnostics.
 *
 * @param {Object} candidate Inspected registry and diagnostics.
 *
 * @returns {Array.<Object>} Activated screensaver definitions.
 * @private
 */
runeos.library.ScreensaverLibrary.prototype.m_activateCandidate = function(candidate) {
    this.errors = candidate.errors;
    this.errors.forEach(function(message) { console.warn("Screensavers: " + message); });
    this.m_registry = candidate.registry;
    this.items = candidate.registry.items;
    this.m_pending = null;
    this.m_loaded = true;
    return this.items;
};

/**
 * Copies metadata and resolves the executable without modifying the JSON object.
 *
 * @param {Object} item Raw screensaver definition.
 *
 * @returns {Object} Copy with a launcher-ready executable path.
 * @private
 */
runeos.library.ScreensaverLibrary.prototype.m_resolve = function(item) {
    if (!item || typeof item !== "object") return item;
    var copy = {};
    Object.keys(item).forEach(function(key) { copy[key] = item[key]; });
    if (typeof copy.binary === "string" && copy.binary.trim()) {
        try { copy.binary = runeos.util.Paths.resolve(copy.binary, this.m_root); }
        catch (error) { copy.binary = null; }
    }
    return copy;
};

/**
 * Cancels only this provider's work, leaving the game catalog untouched.
 *
 * @returns {undefined}
 * @private
 */
runeos.library.ScreensaverLibrary.prototype.m_cancel = function() {
    this.m_generation++;
    this.m_files.clear();
    this.m_inspector.clear();
    this.m_pending = null;
};

/**
 * Rejects stale results after refresh or disposal.
 *
 * @param {number} generation Generation captured before asynchronous work.
 *
 * @returns {undefined}
 * @private
 */
runeos.library.ScreensaverLibrary.prototype.m_assertCurrent = function(generation) {
    if (this.m_disposed || generation !== this.m_generation) throw Error("Screensaver load was cancelled.");
};

/**
 * Reads discovered metadata or a legacy document with the owned transport.
 *
 * @param {number} generation Current load generation.
 *
 * @returns {Promise.<Object>} Screensaver definitions and discovery diagnostics.
 * @private
 */
runeos.library.ScreensaverLibrary.prototype.m_readDefinitions = function(generation) {
    var library = this;
    if (this.m_listFolders) {
        var folders = new runeos.library.ContentFolders(this.m_listFolders, function(url) {
            return library.m_read(url);
        }, this.m_root, {
            directory: "screensaver",
            prefix: "screensaver"
        });
        return folders.load(function() { library.m_assertCurrent(generation); }).then(function(document) {
            return {
                screensavers: document.items,
                errors: document.errors
            };
        });
    }
    return this.m_read(this.m_url).catch(function(error) {
        // A missing legacy document represents an empty screensaver library.
        if (error.status === 404 || (error.code === "NETWORK" && /^file:/i.test(library.m_url))) return {screensavers: []};
        throw error;
    });
};

/**
 * Reads one JSON document through the shared local/remote transport.
 *
 * @param {string} url Metadata URL.
 *
 * @returns {Promise.<Object>} Parsed metadata.
 * @private
 */
runeos.library.ScreensaverLibrary.prototype.m_read = function(url) {
    var files = this.m_files;
    return new Promise(function(resolve, reject) { files.json(url, resolve, reject); });
};
