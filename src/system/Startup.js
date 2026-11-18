//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Startup instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Loads local OS settings before constructing the runtime and its components.
 * File settings use Config's existing schema and immutable defaults.
 */
runeos.system.Startup = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Loads library/config.json before starting the OS. Explicit config overrides
 * take precedence over file settings. Other bootstrap options are preserved.
 *
 * @param {Object} [options] Bootstrap options and optional configuration overrides.
 *
 * @returns {Promise.<runeos.system.Main>} Started runtime.
 */
runeos.system.Startup.start = function(options) {
    options = options || {};
    var environment = typeof window !== "undefined" && window.runeosEnvironment;
    var root = options.libraryRootUrl || (environment && environment.libraryRootUrl) || "../library/local/";
    var settingsRoot = options.libraryRootUrl || (environment && (environment["settingsRootUrl"] || environment.libraryRootUrl)) || "../library/";
    return runeos.system.Startup.m_loadConfig(settingsRoot).then(function(config) {
        var settings = options.config === undefined ? config : config.withOverrides(options.config);
        var launchOptions = {};
        Object.keys(options).forEach(function(key) { launchOptions[key] = options[key]; });
        launchOptions.libraryRootUrl = root;
        launchOptions.config = settings;
        return runeos.system.Startup.m_prepareHighscores(launchOptions, environment).then(function() {
            return runeos.system.Startup.m_prepareSync(launchOptions, environment);
        }).then(function() {
            return runeos.bootstrap(launchOptions);
        });
    });
};

//------------------------------------------------------------------------------
// Private static methods
//------------------------------------------------------------------------------

/**
 * Selects installed managed content using local state only. OS configuration
 * always remains in the original library, outside API ownership.
 *
 * @param {Object} options Prepared runtime options.
 * @param {Object} environment Optional native bridge.
 *
 * @returns {Promise} Local source readiness without waiting for a server.
 * @private
 */
runeos.system.Startup.m_prepareSync = function(options, environment) {
    if (!environment || typeof environment.configureSync !== "function" || options.library) return Promise.resolve();
    return environment.configureSync(options.config.sync).then(function(info) {
        if (!options.config.sync.apiEnabled || options.syncProvider) return;
        options.libraryRootUrl = info.rootUrl;
        options.syncProvider = new runeos.sync.ApiSyncProvider(environment, info.rootUrl);
    }).catch(function(error) {
        console.warn("API sync setup: " + error.message);
    });
};

/**
 * Configures the optional native highscore provider independently of library sync.
 *
 * @param {Object} options Prepared runtime options.
 * @param {Object} environment Optional native bridge.
 * @returns {Promise} Provider readiness without contacting the server.
 * @private
 */
runeos.system.Startup.m_prepareHighscores = function(options, environment) {
    if (!options.config.sync.highscoresEnabled || options.highscoreProvider || !environment ||
        typeof environment["configureHighscores"] !== "function" ||
        typeof environment["syncHighscores"] !== "function") return Promise.resolve();
    return environment["configureHighscores"](options.config.sync).then(function() {
        options.highscoreProvider = new runeos.sync.HighscoreApiProvider(environment);
    }).catch(function(error) {
        console.warn("Highscore sync setup: " + error.message);
    });
};

/**
 * Reads optional local settings, releasing the transport before runtime startup.
 * Missing files use defaults; malformed or unreadable files also warn with the
 * exact URL and reason. Invalid file settings never partially apply.
 *
 * @param {string} root Library root URL.
 *
 * @returns {Promise.<runeos.system.Config>} Validated file settings or defaults.
 * @private
 */
runeos.system.Startup.m_loadConfig = function(root) {
    var url = runeos.util.Paths.resolve("config.json", runeos.util.Paths.root(root));
    var files = new runeos.util.FileLoader({config: runeos.system.Config.DEFAULTS.loading});
    return new Promise(function(resolve, reject) {
        files.json(url, resolve, reject);
    }).then(function(document) {
        return new runeos.system.Config(document);
    }).catch(function(error) {
        if (error.status !== 404) {
            console.warn("Unable to load OS settings from " + url + "; using defaults:", error);
        }
        return new runeos.system.Config();
    }).then(function(config) {
        files.dispose();
        return config;
    }, function(error) {
        files.dispose();
        throw error;
    });
};
