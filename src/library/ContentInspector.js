//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ContentInspector instance.
 *
 * @constructor
 *
 * @param {Object} [options] Library and loading configuration.
 *
 * @class
 * @classdesc
 *
 * Checks executable bundles, declared required files and optional Tile atlases.
 * Bundle checks read file metadata only; execution belongs to Application.
 * Native requests and images belong to this inspector and are cancelled together.
 */
runeos.library.ContentInspector = function(options) {
    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Bounded catalog inspection settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("library", options.config);

    /**
     * Shared file and image timeout settings.
     *
     * @type {Object}
     * @private
     */
    this.m_loadingConfig = runeos.system.Config.getGroup("loading", options.loadingConfig);

    /**
     * Transport for bundles and declared resources.
     *
     * @type {runeos.util.FileLoader}
     * @private
     */
    this.m_files = new runeos.util.FileLoader({config: this.m_loadingConfig});

    /**
     * Pending native atlas checks.
     *
     * @type {Array.<Object>}
     * @private
     */
    this.m_images = [];

    /**
     * Generation invalidating cancelled work and queued checks.
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
 * Checks a collection with bounded concurrency and preserves input order.
 *
 * @param {Array.<runeos.catalog.GameRegistry.Definition>} games Validated game definitions.
 *
 * @param {boolean} [includeImage=true] Whether to inspect Tile images.
 *
 * @returns {Promise.<Array.<Object>>} Inspection reports.
 */
runeos.library.ContentInspector.prototype.checkAll = function(games, includeImage) {
    var inspector = this;
    var generation = this.m_generation;
    var next = 0;
    var reports = [];
    function work() {
        inspector.m_assertActive(generation);
        if (next >= games.length) return Promise.resolve();
        var index = next++;
        return inspector.check(games[index], includeImage).then(function(report) {
            reports[index] = report;
            return work();
        });
    }
    return Promise.resolve().then(function() {
        inspector.m_assertActive(generation);
        var workers = [];
        for (var i = 0; i < Math.min(games.length, inspector.m_config.inspectionConcurrency); i++) workers.push(work());
        return Promise.all(workers);
    }).then(function() {
        inspector.m_assertActive(generation);
        return reports;
    });
};

/**
 * Checks one game without executing it. Icons are optional startup work.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Validated game definition.
 * @param {boolean} [includeImage=true] Whether to inspect the optional atlas.
 *
 * @returns {Promise.<Object>} Installed flag, image availability and diagnostics.
 */
runeos.library.ContentInspector.prototype.check = function(game, includeImage) {
    var inspector = this;
    var generation = this.m_generation;
    var report = {
        installed: true,
        imageAvailable: game.imageAvailable !== false,
        errors: []
    };
    return Promise.resolve().then(function() {
        inspector.m_assertActive(generation);
        return inspector.m_checkBundle(game.binary);
    }).then(function() {
        inspector.m_assertActive(generation);
        return inspector.m_checkRequiredFiles(game, generation);
    }).catch(function(error) {
        inspector.m_assertActive(generation);
        report.installed = false;
        report.errors.push(game.name + ": " + error.message);
    }).then(function() {
        inspector.m_assertActive(generation);
        if (!report.installed || includeImage === false) return report;
        return inspector.m_checkImage(game.image).then(function(available) {
            inspector.m_assertActive(generation);
            report.imageAvailable = available;
            if (!available) report.errors.push(game.name + ": missing or invalid Tile atlas: " + game.image);
            return report;
        });
    });
};

/**
 * Cancels queued work and releases every pending native request and image.
 *
 * @returns {undefined}
 */
runeos.library.ContentInspector.prototype.clear = function() {
    this.m_generation++;
    this.m_files.clear();
    while (this.m_images.length > 0) this.m_images[0].cancel();
};

/**
 * Permanently releases inspection resources.
 *
 * @returns {undefined}
 */
runeos.library.ContentInspector.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.clear();
    this.m_files.dispose();
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Rejects stale work before publishing results or starting further requests.
 *
 * @param {number} generation Inspection generation.
 *
 * @returns {undefined}
 * @private
 */
runeos.library.ContentInspector.prototype.m_assertActive = function(generation) {
    if (this.m_disposed || generation !== this.m_generation) throw Error("Content inspection was cancelled.");
};

/**
 * Verifies bundle availability without loading or compiling the game.
 * Syntax validation belongs to Application when the game is actually launched.
 *
 * @param {string} url Bundle URL.
 *
 * @returns {Promise} Completion after a nonempty file is found.
 * @private
 */
runeos.library.ContentInspector.prototype.m_checkBundle = function(url) {
    var files = this.m_files;
    return new Promise(function(resolve, reject) {
        files.probe(url, resolve, reject);
    }).then(function(info) {
        if (info.size === 0) throw Error("Empty application bundle: " + url);
    });
};

/**
 * Checks declared game-relative resources sequentially to bound request count.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {number} generation Inspection generation.
 *
 * @returns {Promise} Completion after all required files are readable.
 * @private
 */
runeos.library.ContentInspector.prototype.m_checkRequiredFiles = function(game, generation) {
    var inspector = this;
    var root = runeos.util.Paths.directory(game.binary);
    return (game.requiredFiles || []).reduce(function(pending, file) {
        return pending.then(function() {
            inspector.m_assertActive(generation);
            var url = runeos.util.Paths.resolve(file, root);
            return new Promise(function(resolve, reject) {
                inspector.m_files.probe(url, resolve, reject);
            });
        });
    }, Promise.resolve());
};

/**
 * Decodes an atlas and validates the same dimensions required by Tile.
 *
 * @param {(string|undefined)} url Atlas URL.
 *
 * @returns {Promise.<boolean>} Whether the atlas is usable.
 * @private
 */
runeos.library.ContentInspector.prototype.m_checkImage = function(url) {
    if (typeof url !== "string" || !url) return Promise.resolve(false);
    var imageUrl = url;
    var inspector = this;
    return new Promise(function(resolve) {
        var image = new Image();
        var pending = {cancel: function() { finish(false); }};
        var timer = null;
        var finished = false;
        function finish(available) {
            if (finished) return;
            finished = true;
            image.onerror = null;
            image.onload = null;
            if (timer !== null) window.clearTimeout(timer);
            var index = inspector.m_images.indexOf(pending);
            if (index >= 0) inspector.m_images.splice(index, 1);
            image.src = "";
            resolve(available);
        }
        inspector.m_images.push(pending);
        image.onload = function() {
            finish(image.naturalWidth > 0 && image.naturalWidth % 2 === 0 && image.naturalHeight === image.naturalWidth * 2);
        };
        image.onerror = function() { finish(false); };
        if (inspector.m_loadingConfig.timeoutMs > 0) {
            timer = window.setTimeout(function() { finish(false); }, inspector.m_loadingConfig.timeoutMs);
        }
        try {
            image.src = runeos.util.Paths.resolve(imageUrl);
        } catch (error) {
            finish(false);
        }
    });
};
