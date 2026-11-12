//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new CategoryTilemapManager instance.
 *
 * @constructor
 *
 * @param {runeos.ui.tilemap.Tilemaps} tilemaps Existing viewport.
 * @param {runeos.launcher.CategoryTilemapManager.Options} [options] Optional Tile, text and promotion settings.
 *
 * @class
 * @classdesc
 *
 * Loads catalog documents and synchronizes the existing Tilemaps navigation
 * system.
 */
runeos.launcher.CategoryTilemapManager = function(tilemaps, options) {
    options = options || {};

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Existing navigation viewport populated by this manager.
     *
     * @type {runeos.ui.tilemap.Tilemaps}
     */
    this.tilemaps = tilemaps;

    /**
     * Validated category rules and their shared tag vocabulary.
     *
     * @type {runeos.catalog.CategoryRegistry}
     */
    this.categories = new runeos.catalog.CategoryRegistry();

    /**
     * Shared game definitions available to the category engine.
     *
     * @type {runeos.catalog.GameRegistry}
     */
    this.games = new runeos.catalog.GameRegistry([]);

    /**
     * Relevance calculator independent of Tile rendering.
     *
     * @type {runeos.catalog.CategoryEngine}
     */
    this.engine = new runeos.catalog.CategoryEngine();

    /**
     * Session-stable size preferences, separate from relevance scoring.
     *
     * @type {runeos.launcher.GameTilePriority}
     */
    this.priorities = new runeos.launcher.GameTilePriority(undefined, options.priorityConfig);

    /**
     * Validation diagnostics for the latest operation.
     *
     * @type {Array.<string>}
     */
    this.errors = [];

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Normalized component settings inherited from the target viewport.
     *
     * @type {runeos.ui.tilemap.TilemapOptions}
     * @private
     */
    this.m_options = runeos.ui.tilemap.TilemapOptions.resolve(options, "tiles", tilemaps.settings);

    /**
     * Immutable tiles settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = this.m_options.tiles;

    var inputConfig = runeos.system.Config.getGroup("input", options.inputConfig);

    /**
     * Visibility policy applied before category ranking and reserve membership.
     *
     * @type {runeos.catalog.GameAvailability}
     * @private
     */
    this.m_availability = new runeos.catalog.GameAvailability({
        stages: runeos.system.Config.getGroup("library", options.libraryConfig).stages,
        useKeyboard: inputConfig.useKeyboard,
        useGamepads: inputConfig.useGamepads
    });

    /**
     * Category distribution calculated independently of Tilemap presentation.
     *
     * @type {runeos.catalog.CategorySelection}
     * @private
     */
    this.m_categorySelection = new runeos.catalog.CategorySelection();

    /**
     * Temporary local provider used by compatibility loading.
     *
     * @type {runeos.library.LocalLibrary}
     * @private
     */
    this.m_loader = null;

    /**
     * Category-specific labels derived from the active taxonomy.
     *
     * @type {runeos.launcher.MatchExplanation}
     * @private
     */
    this.m_explanations = null;

    /**
     * Explicit settings shared with the composing Launcher.
     *
     * @type {Object}
     * @private
     */
    this.m_explanationConfig = runeos.system.Config.getGroup("selector", options.explanationConfig);

    /**
     * Generation used to ignore superseded asynchronous results.
     *
     * @type {number}
     * @private
     */
    this.m_generation = 0;

    /**
     * Whether this instance has been permanently released.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

};

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Optional constructor settings and configuration overrides.
 *
 * @typedef {{
 *     explanationConfig: (Object|undefined),
 *     inputConfig: (Object|undefined),
 *     libraryConfig: (Object|undefined),
 *     priorityConfig: (Object|undefined),
 *     tiles: (runeos.ui.tilemap.TilemapOptions|undefined)
 * }}
 */
runeos.launcher.CategoryTilemapManager.Options;

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Validates the three documents and rebuilds category content. Input definitions remain
 * unchanged.
 *
 * @param {Object} games Parsed games document.
 * @param {Object} categories Parsed categories document.
 * @param {Object} tags Parsed independent tags document.
 *
 * @returns {Array.<string>} Validation diagnostics.
 */
runeos.launcher.CategoryTilemapManager.prototype.setData = function(games, categories, tags) {
    if (this.m_disposed) return [];
    this.m_cancelRequests();
    var vocabulary = new runeos.catalog.TagRegistry();
    if (vocabulary.replace(tags).length) {
        this.errors = vocabulary.errors;
        return this.errors;
    }
    this.m_explanations = new runeos.launcher.MatchExplanation(vocabulary.items, {config: this.m_explanationConfig});
    this.categories.tags = vocabulary.ids;
    this.categories.baseTags = vocabulary.baseIds;
    this.categories.replace(categories);
    this.games.allowedTags = vocabulary.ids;
    this.games.allowedBaseTags = vocabulary.baseIds;
    this.games.replace(games);
    this.errors = this.categories.errors.concat(this.games.errors);
    this.refresh();
    for (var i = 0; i < this.errors.length; i++) console.warn("Catalog: " + this.errors[i]);
    return this.errors;
};

/**
 * Reconciles ranked Tiles by category and game ID, preserving retained instances.
 *
 * @returns {undefined}
 */
runeos.launcher.CategoryTilemapManager.prototype.refresh = function() {
    if (this.m_disposed) return;
    var viewport = this.tilemaps;
    var existing = Object.create(null);
    viewport.tilemaps.forEach(function(map) {
        existing[map.id] = map;
    });
    var self = this;
    var games = this.m_availability.filter(this.games.items);
    var distribution = this.m_categorySelection.select(games, this.categories, this.engine);
    var maps = distribution.groups.map(function(group) {
        return self.m_updateMap(existing[group.category.id], group, distribution.memberships);
    });
    viewport.setTilemaps(maps);
};

/**
 * Loads both documents. Failed or superseded requests cannot replace the
 * current UI.
 * LocalLibrary resolves game paths against its content root.
 *
 * @param {string} gamesUrl Games JSON URL.
 * @param {string} categoriesUrl Categories JSON URL.
 * @param {string} [tagsUrl] Tags JSON URL.
 *
 * @returns {Promise.<boolean>} Whether a complete catalog was applied.
 */
runeos.launcher.CategoryTilemapManager.prototype.load = function(gamesUrl, categoriesUrl, tagsUrl) {
    this.m_cancelRequests();
    if (this.m_disposed) return Promise.resolve(false);
    var generation = this.m_generation;
    var self = this;
    var loader = new runeos.library.LocalLibrary({
        gamesUrl: gamesUrl,
        categoriesUrl: categoriesUrl,
        tagsUrl: tagsUrl
    });
    this.m_loader = loader;
    return loader.loadCatalog().then(function(documents) {
        if (self.m_disposed || generation !== self.m_generation) return false;
        self.m_loader = null;
        loader.dispose();
        self.setData(documents.games, documents.categories, documents.tags);
        return true;
    }).catch(function(error) {
        if (self.m_disposed || generation !== self.m_generation) return false;
        self.errors = ["Catalog loading: " + error.message];
        console.warn(self.errors[0]);
        self.m_cancelRequests();
        return false;
    });
};

/**
 * Releases the resources owned by this instance.
 *
 * @returns {undefined}
 */
runeos.launcher.CategoryTilemapManager.prototype.dispose = function() {
    this.m_disposed = true;
    this.m_cancelRequests();
    this.games.clear();
    this.categories.clear();
    this.m_explanations = null;
    this.m_availability = null;
    this.m_categorySelection = null;
    this.tilemaps = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Reuses a category map and reconciles its ranked game tiles.
 *
 * @param {runeos.ui.tilemap.Tilemap} map Existing map, if present.
 * @param {Object} group Category and ranked rows from category selection.
 * @param {Object} memberships Displayed category count by game ID.
 *
 * @returns {runeos.ui.tilemap.Tilemap} Updated category map.
 * @private
 */
runeos.launcher.CategoryTilemapManager.prototype.m_updateMap = function(map, group, memberships) {
    var category = group.category;
    map = map || new runeos.ui.tilemap.Tilemap({id: category.id, settings: this.m_options});
    map.name = category.name;
    map.description = category.description || "";
    map.columns = category.columns === undefined ? this.m_config.columns : category.columns;
    var previous = Object.create(null);
    for (var i = 0; i < map.length; i++) {
        var tile = map.getTileAt(i);
        previous[tile.gameId] = tile;
    }
    var self = this;
    var tiles = group.rows.map(function(row) {
        return self.m_updateTile(previous[row.gameId], row, group, memberships[row.gameId]);
    });
    map.setTiles(tiles);
    return map;
};

/**
 * Updates one game's presentation and priority while preserving its tile instance.
 *
 * @param {runeos.ui.tilemap.Tile} tile Existing tile, if present.
 * @param {Object} row Ranked game ID and relevance score.
 * @param {Object} group Category and maximum relevance from category selection.
 * @param {number} memberships Displayed category count for this game.
 *
 * @returns {runeos.ui.tilemap.Tile} Updated game tile.
 * @private
 */
runeos.launcher.CategoryTilemapManager.prototype.m_updateTile = function(tile, row, group, memberships) {
    var game = this.games.get(row.gameId);
    if (!game) throw Error("Unknown ranked game: " + row.gameId);
    tile = tile || new runeos.ui.tilemap.Tile({id: row.gameId, settings: this.m_options});
    tile.setLabels(runeos.launcher.GamePresentation.create(game, this.m_explanations.describe(game, group.category)));
    tile.source = game.binary;
    tile.data = game;
    tile.backgroundColor = game.backgroundColor || this.m_config.backgroundColor;
    tile.imageUrl = game.imageAvailable === false ? "" : game.image || "";
    tile.relevance = row.score;
    tile.priority = this.priorities.choose(group.category.id, row.gameId, row.score, group.maximumRelevance, memberships);
    return tile;
};

/**
 * Invalidates pending results and aborts outstanding catalog requests.
 *
 * @returns {undefined}
 * @private
 */
runeos.launcher.CategoryTilemapManager.prototype.m_cancelRequests = function() {
    this.m_generation++;
    if (this.m_loader) this.m_loader.dispose();
    this.m_loader = null;
};
