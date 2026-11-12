//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new CategorySelection instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Distributes visible games across category rules and an optional reserve.
 * Produces ranked groups and membership counts without creating UI objects or
 * retaining catalog definitions between calls.
 */
runeos.catalog.CategorySelection = function() {

};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Ranks each regular category once, counts displayed memberships after limits,
 * then appends unlisted games to the reserve. Empty regular groups are retained
 * so callers can reuse their presentation objects. Inputs are never modified.
 *
 * @param {Array.<runeos.catalog.GameRegistry.Definition>} games Visible, validated game definitions.
 * @param {runeos.catalog.CategoryRegistry} categories Validated category rules.
 * @param {runeos.catalog.CategoryEngine} [engine] Borrowed relevance calculator.
 *
 * @returns {Object} Category groups and game-ID membership counts.
 */
runeos.catalog.CategorySelection.prototype.select = function(games, categories, engine) {
    engine = engine || new runeos.catalog.CategoryEngine();
    var groups = this.m_rankCategories(games, categories, engine);
    var memberships = this.m_countMemberships(groups);
    this.m_appendFallback(groups, memberships, games, categories.fallback);
    return {
        groups: groups,
        memberships: memberships
    };
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Preserves category order and attaches ranked rows and their score ceiling.
 *
 * @param {Array.<runeos.catalog.GameRegistry.Definition>} games Visible game definitions.
 * @param {runeos.catalog.CategoryRegistry} categories Validated category rules.
 * @param {runeos.catalog.CategoryEngine} engine Borrowed relevance calculator.
 *
 * @returns {Array.<Object>} Regular groups containing category, rows and maximumRelevance.
 * @private
 */
runeos.catalog.CategorySelection.prototype.m_rankCategories = function(games, categories, engine) {
    return categories.items.map(function(category) {
        return {
            category: category,
            rows: engine.rank(games, category, categories.minimumScore),
            maximumRelevance: engine.getMaximumRelevance(category)
        };
    });
};

/**
 * Counts actual appearances after ranking and category limits.
 *
 * @param {Array.<Object>} groups Ranked regular categories.
 *
 * @returns {Object} Game-ID counts without inherited keys.
 * @private
 */
runeos.catalog.CategorySelection.prototype.m_countMemberships = function(groups) {
    var memberships = Object.create(null);
    groups.forEach(function(group) {
        group.rows.forEach(function(row) {
            memberships[row.gameId] = (memberships[row.gameId] || 0) + 1;
        });
    });
    return memberships;
};

/**
 * Adds the reserve only when enabled and visible games remain unlisted.
 * Reserve rows have zero relevance and one displayed membership.
 *
 * @param {Array.<Object>} groups Ranked groups to extend.
 * @param {Object} memberships Displayed game-ID counts to extend.
 * @param {Array.<runeos.catalog.GameRegistry.Definition>} games Visible game definitions.
 * @param {?Object} fallback Optional reserve category definition.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategorySelection.prototype.m_appendFallback = function(groups, memberships, games, fallback) {
    if (!fallback) return;
    var rows = games.filter(function(game) {
        return !memberships[runeos.catalog.GameRegistry.getId(game)];
    }).map(function(game) {
        return {
            gameId: runeos.catalog.GameRegistry.getId(game),
            name: game.name,
            score: 0
        };
    });
    if (!rows.length) return;
    rows.sort(this.m_compareReserveRows);
    rows.forEach(function(row) { memberships[row.gameId] = 1; });
    groups.push({
        category: fallback,
        rows: rows,
        maximumRelevance: 0
    });
};

/**
 * Orders reserve games by name, then ID, independently of the current locale.
 *
 * @param {Object} first First reserve row.
 * @param {Object} second Second reserve row.
 *
 * @returns {number} Negative, zero or positive comparison result.
 * @private
 */
runeos.catalog.CategorySelection.prototype.m_compareReserveRows = function(first, second) {
    if (first.name !== second.name) return first.name < second.name ? -1 : 1;
    if (first.gameId === second.gameId) return 0;
    return first.gameId < second.gameId ? -1 : 1;
};
