//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new CategoryEngine instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Pure relevance calculation and deterministic sorting, independent of UI
 * state.
 */
runeos.catalog.CategoryEngine = function() {

};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Calculates weighted tag relevance without changing game metadata.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {runeos.catalog.CategoryRegistry.Definition} category Category.
 *
 * @returns {number}
 */
runeos.catalog.CategoryEngine.prototype.calculateRelevance = function(game, category) {
    if (category.ranking) return this.m_calculateProfileScore(game, category.ranking);
    return this.m_calculateLegacyScore(game, category);
};

/**
 * Calculates the theoretical score ceiling for promotion normalization.
 *
 * @param {runeos.catalog.CategoryRegistry.Definition} category Category definition.
 *
 * @returns {number} Maximum attainable relevance.
 */
runeos.catalog.CategoryEngine.prototype.getMaximumRelevance = function(category) {
    if (category.ranking) return this.m_getProfileMaximum(category.ranking);
    return this.m_getLegacyMaximum(category);
};

/**
 * Filters before scoring; ties use name then ID with a locale-independent
 * ordering.
 *
 * @param {Array.<runeos.catalog.GameRegistry.Definition>} games Registered games.
 * @param {runeos.catalog.CategoryRegistry.Definition} category Category rules.
 * @param {number} minimum Default minimum relevance.
 *
 * @returns {Array.<Object>} Ranked game IDs and scores.
 */
runeos.catalog.CategoryEngine.prototype.rank = function(games, category, minimum) {
    var rows = this.m_collectScores(games, category, minimum);
    rows.sort(this.m_compareRows);
    if (category.limit !== undefined) rows = rows.slice(0, category.limit);
    return rows.map(function(row) {
        return {
            gameId: row.gameId,
            score: row.score
        };
    });
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Collects eligible game scores before ordering and category limits.
 *
 * @param {Array.<runeos.catalog.GameRegistry.Definition>} games Registered game definitions.
 * @param {runeos.catalog.CategoryRegistry.Definition} category Category rules.
 * @param {number} minimum Default minimum relevance.
 *
 * @returns {Array.<Object>} Scored rows retaining names for tie-breaking.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_collectScores = function(games, category, minimum) {
    var engine = this;
    var rows = [];
    var minimumScore = category.minimum_score === undefined ? minimum : category.minimum_score;
    games.forEach(function(game) {
        if (!engine.m_matchesCategory(game, category)) return;
        var score = engine.calculateRelevance(game, category);
        if (category.ranking || score >= minimumScore) {
            rows.push({
                gameId: runeos.catalog.GameRegistry.getId(game),
                score: score,
                name: game.name
            });
        }
    });

    return rows;
};

/**
 * Selects the membership rules belonging to the category format.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {runeos.catalog.CategoryRegistry.Definition} category Category rules.
 *
 * @returns {boolean} Whether the game meets the membership rules.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_matchesCategory = function(game, category) {
    if (category.ranking) return this.m_matchesEligibility(game, category.eligibility);
    return this.m_matchesLegacyFilters(game, category.filters || []);
};

/**
 * Orders scores descending, then names and IDs ascending without locale rules.
 *
 * @param {Object} first First scored row.
 * @param {Object} second Second scored row.
 *
 * @returns {number} Negative, zero or positive comparison result.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_compareRows = function(first, second) {
    if (first.score !== second.score) return second.score - first.score;
    if (first.name !== second.name) return first.name < second.name ? -1 : 1;
    if (first.gameId === second.gameId) return 0;
    return first.gameId < second.gameId ? -1 : 1;
};

/**
 * Calculates the score ceiling for the current independent ranking components.
 *
 * @param {runeos.catalog.CategoryRegistry.Ranking} ranking Profile ranking rules.
 *
 * @returns {number} Maximum attainable profile relevance.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_getProfileMaximum = function(ranking) {
    var playerMaximum = this.m_getMaximumPlayerScore(ranking.playerScores || []);
    var playerContribution = playerMaximum * ranking.playerWeight / 100;
    return ranking.baseWeight + ranking.modifierWeight + playerContribution;
};

/**
 * Preserves the older tag-budget ceiling and optional player contribution.
 *
 * @param {runeos.catalog.CategoryRegistry.Definition} category Legacy scoring rules.
 *
 * @returns {number} Maximum attainable legacy relevance.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_getLegacyMaximum = function(category) {
    var maximum = 0;
    var weights = category.weights;
    if (!weights) throw Error("Missing category weights");
    Object.keys(weights).forEach(function(tag) {
        maximum = Math.max(maximum, weights[tag]);
    });
    if (category.playerScoring) {
        var scoring = category.playerScoring;
        maximum += this.m_getMaximumPlayerScore(scoring.scores) * scoring.weight / 100;
    }

    return maximum;
};

/**
 * Combines the older shared tag budget with its optional player contribution.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {runeos.catalog.CategoryRegistry.Definition} category Legacy scoring rules.
 *
 * @returns {number} Weighted relevance.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_calculateLegacyScore = function(game, category) {
    var score = 0;
    Object.keys(/**
         * Legacy weights have already passed CategoryRegistry validation.
         * @type {!Object<string, number>}
         */ (category.weights)).forEach(function(tag) {
        score += (Object.prototype.hasOwnProperty.call(game.tags, tag) ? game.tags[tag] : 0) * category.weights[tag];
    });

    if (category.playerScoring) {
        var scoring = category.playerScoring;
        score += this.m_calculatePlayerScore(game, scoring.scores) * scoring.weight;
    }

    return score / 100;
};

/**
 * Finds the highest score in a player-count preference table.
 *
 * @param {(Array.<Object>|undefined)} scores Player-count thresholds.
 *
 * @returns {number} Highest score, or zero for an empty table.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_getMaximumPlayerScore = function(scores) {
    var maximum = 0;
    scores.forEach(function(row) {
        maximum = Math.max(maximum, row.score);
    });

    return maximum;
};

/**
 * Applies the older numeric player/tag filters before legacy scoring.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {Array.<Object>} filters Category filters.
 *
 * @returns {boolean} Whether the game is eligible.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_matchesLegacyFilters = function(game, filters) {
    return filters.every(function(filter) {
        var path = filter.field.split(".");
        var value = game[path[0]] && game[path[0]][path[1]];
        if (typeof value !== "number" || !isFinite(value)) return false;
        return filter.operator === "lte" ? value <= filter.value : value >= filter.value;
    });
};

/**
 * Resolves the highest matching simultaneous-player threshold.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {(Array.<Object>|undefined)} scores Ascending player-count thresholds.
 *
 * @returns {number} Player-count score from zero to one hundred.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_calculatePlayerScore = function(game, scores) {
    var count = game.players && game.players.max;
    var score = 0;
    if (typeof count !== "number" || !isFinite(count)) return score;

    scores.forEach(function(row) {
        if (count >= row.min) score = row.score;
    });

    return score;
};

/**
 * Finds the strongest relevant family or modifier, with missing values at zero.
 *
 * @param {(Object|undefined)} strengths Independent strengths.
 * @param {(Array.<string>|undefined)} ids Relevant identifiers.
 *
 * @returns {number} Strongest matching value.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_getStrongestStrength = function(strengths, ids) {
    var score = 0;
    if (!ids || !strengths) return score;
    ids.forEach(function(id) { score = Math.max(score, runeos.catalog.GameRegistry.getStrength(strengths, id)); });

    return score;
};

/**
 * Determines category membership without consulting ranking points.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {(runeos.catalog.CategoryRegistry.Eligibility|undefined)} rule Membership criteria.
 *
 * @returns {boolean} Whether all configured criteria pass.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_matchesEligibility = function(game, rule) {
    rule = rule || {};
    if (!this.m_matchesStrengths(game, rule)) return false;
    if (!this.m_matchesAlternatives(game, rule.anyOf)) return false;
    if (rule.requiredMode && (!game.modes || game.modes[rule.requiredMode] !== true)) return false;

    return this.m_matchesPlayerCount(game.players, rule);
};

/**
 * Requires all configured strength thresholds within one membership rule.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {runeos.catalog.CategoryRegistry.StrengthRule} rule Strength criteria.
 *
 * @returns {boolean} Whether the family and modifier requirements pass.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_matchesStrengths = function(game, rule) {
    if (rule.baseAny && this.m_getStrongestStrength(game.baseTags, rule.baseAny) < rule.baseMinimum) return false;
    if (rule.tagsAny && this.m_getStrongestStrength(game.tags, rule.tagsAny) < rule.tagMinimum) return false;

    return true;
};

/**
 * Accepts any complete alternative without weakening parent membership rules.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {(Array.<runeos.catalog.CategoryRegistry.StrengthRule>|undefined)} rules Alternative strength criteria.
 *
 * @returns {boolean} Whether an alternative passes, or none are configured.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_matchesAlternatives = function(game, rules) {
    if (!rules) return true;
    var engine = this;

    return rules.some(function(rule) { return engine.m_matchesStrengths(game, rule); });
};

/**
 * Combines family, complementary traits and player suitability for ordering.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {runeos.catalog.CategoryRegistry.Ranking} ranking Component weights and trait preferences.
 *
 * @returns {number} Relevance on a zero-to-one-hundred scale.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_calculateProfileScore = function(game, ranking) {
    var baseScore = this.m_getStrongestStrength(game.baseTags, ranking.baseAny);
    var modifierScore = this.m_calculateModifierScore(game, ranking.modifierWeights || {});
    var playerScore = ranking.playerWeight > 0 ? this.m_calculatePlayerScore(game, ranking.playerScores) : 0;
    var weightedScore = baseScore * ranking.baseWeight + modifierScore * ranking.modifierWeight + playerScore * ranking.playerWeight;
    return weightedScore / 100;
};

/**
 * Combines explicitly assigned strengths with category modifier preferences.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {!Object} weights Normalized modifier preferences.
 *
 * @returns {number} Modifier suitability on the zero-to-one-hundred scale.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_calculateModifierScore = function(game, weights) {
    var score = 0;
    Object.keys(weights).forEach(function(id) {
        score += runeos.catalog.GameRegistry.getStrength(game.tags, id) * weights[id] / 100;
    });

    return score;
};

/**
 * Checks category player bounds, requiring finite declared counts when constrained.
 *
 * @param {(Object|undefined)} players Optional supported player range.
 * @param {(runeos.catalog.CategoryRegistry.Eligibility|undefined)} rule Category membership criteria.
 *
 * @returns {boolean} Whether the supported range meets both configured bounds.
 * @private
 */
runeos.catalog.CategoryEngine.prototype.m_matchesPlayerCount = function(players, rule) {
    var minimum = players && players.min;
    var maximum = players && players.max;
    if (rule.minimumMaxPlayers !== undefined && (typeof maximum !== "number" ||
        !isFinite(maximum) || maximum < rule.minimumMaxPlayers)) return false;
    if (rule.maximumMinPlayers !== undefined && (typeof minimum !== "number" ||
        !isFinite(minimum) || minimum > rule.maximumMinPlayers)) return false;
    if (rule.maximumMaxPlayers !== undefined && (typeof maximum !== "number" ||
        !isFinite(maximum) || maximum > rule.maximumMaxPlayers)) return false;
    return true;
};
