//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates independent category validation without retaining catalog definitions.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Checks category metadata, membership and ranking against supplied vocabulary.
 * Reports invalid data by throwing; registration and diagnostics belong to the caller.
 */
runeos.catalog.CategoryValidation = function() {

};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Validates display metadata, scoring rules and optional category limits.
 *
 * @param {runeos.catalog.CategoryRegistry.Definition} category Category definition.
 * @param {Array.<string>} tags Allowed tag identifiers.
 * @param {Array.<string>} bases Allowed game-family identifiers.
 *
 * @returns {undefined}
 */
runeos.catalog.CategoryValidation.prototype.validate = function(category, tags, bases) {
    runeos.util.Validation.validateText(category.name, "name");
    if (category.description !== undefined && typeof category.description !== "string") throw Error("Invalid description");
    if (category.ranking !== undefined) {
        this.m_validateProfile(category, tags, bases);
    } else {
        this.m_validateLegacy(category, tags);
    }

    if (category.minimum_score !== undefined) this.score(category.minimum_score);
    if (category.columns !== undefined && !runeos.util.Validation.isInteger(category.columns, 1)) throw Error("Invalid columns");
    if (category.limit !== undefined && !runeos.util.Validation.isInteger(category.limit, 0)) throw Error("Invalid limit");
    this.m_validateLegacyFilters(category.filters, tags);
};

/**
 * Validates a finite score, strength threshold or component weight.
 *
 * @param {*} score Value on the zero-to-one-hundred scale.
 *
 * @returns {undefined}
 */
runeos.catalog.CategoryValidation.prototype.score = function(score) {
    if (typeof score !== "number" || !isFinite(score) || score < 0 || score > 100) {
        throw Error("Score must be between 0 and 100");
    }
};

/**
 * Validates reserve labels and prevents an ID collision with regular categories.
 *
 * @param {Object} fallback Reserve category definition.
 * @param {Array.<runeos.catalog.CategoryRegistry.Definition>} categories Registered categories.
 *
 * @returns {undefined}
 */
runeos.catalog.CategoryValidation.prototype.fallback = function(fallback, categories) {
    runeos.util.Validation.validateText(fallback && fallback.id, "fallback.id");
    runeos.util.Validation.validateText(fallback.name, "fallback.name");
    var duplicate = categories.some(function(category) { return category.id === fallback.id; });
    if (duplicate) throw Error("Duplicate fallback category ID");
    if (fallback.description !== undefined && typeof fallback.description !== "string") throw Error("Invalid fallback description");
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Validates the older shared tag budget and optional player scoring.
 *
 * @param {runeos.catalog.CategoryRegistry.Definition} category Legacy category.
 * @param {Array.<string>} tags Allowed tag identifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateLegacy = function(category, tags) {
    var playerScoring = category.playerScoring;
    this.m_validatePlayerScoring(playerScoring);
    var playerWeight = playerScoring === undefined ? 0 : playerScoring.weight;
    var tagWeight = 100 - playerWeight;
    runeos.catalog.TagRegistry.validateWeights(category.weights, tags, tagWeight);
};

/**
 * Validates an optional player-count contribution and its ascending thresholds.
 *
 * @param {(Object|undefined)} scoring Player scoring settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validatePlayerScoring = function(scoring) {
    var validation = this;
    if (scoring === undefined) return;
    if (!scoring || typeof scoring !== "object") throw Error("Invalid playerScoring");
    validation.score(scoring.weight);
    if (!Array.isArray(scoring.scores) || !scoring.scores.length) throw Error("Missing playerScoring scores");
    var previous = 0;
    scoring.scores.forEach(function(row) {
        if (!row || !runeos.util.Validation.isInteger(row.min, previous + 1)) throw Error("Player thresholds must be ascending integers");
        validation.score(row.score);
        previous = row.min;
    });
};

/**
 * Rejects unknown fields and invalid option objects before rules are evaluated.
 *
 * @param {(Object|undefined)} value Rule object.
 * @param {Array.<string>} fields Supported field names.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateFields = function(value, fields) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Expected category rule object");
    Object.keys(value).forEach(function(key) {
        if (fields.indexOf(key) < 0) throw Error("Unknown category rule field: " + key);
    });
};

/**
 * Validates a nonempty, unique list of identifiers from one taxonomy layer.
 *
 * @param {(Array.<string>|undefined)} ids Referenced identifiers.
 * @param {Array.<string>} allowed Allowed identifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateTagIds = function(ids, allowed) {
    if (!Array.isArray(ids) || !ids.length) throw Error("Expected category tag list");
    ids.forEach(function(id, index) {
        if (allowed.indexOf(id) < 0 || ids.indexOf(id) !== index) throw Error("Invalid category tag: " + id);
    });
};

/**
 * Validates membership criteria independently of ranking contributions.
 *
 * @param {(runeos.catalog.CategoryRegistry.Eligibility|undefined)} rule Eligibility settings.
 * @param {Array.<string>} bases Allowed game families.
 * @param {Array.<string>} modifiers Allowed modifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateEligibility = function(rule, bases, modifiers) {
    this.m_validateFields(rule, [
        "baseAny", "baseMinimum", "tagsAny", "tagMinimum", "anyOf",
        "requiredMode", "minimumMaxPlayers", "maximumMinPlayers", "maximumMaxPlayers"
    ]);
    this.m_validateStrengths(rule, bases, modifiers);
    this.m_validateAlternatives(rule.anyOf, bases, modifiers);
    this.m_validateMode(rule.requiredMode);
    this.m_validatePlayerRules(rule);
};

/**
 * Validates family and modifier requirements within one strength rule.
 *
 * @param {(runeos.catalog.CategoryRegistry.StrengthRule|undefined)} rule Tag requirements after object validation.
 * @param {Array.<string>} bases Allowed game families.
 * @param {Array.<string>} modifiers Allowed modifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateStrengths = function(rule, bases, modifiers) {
    this.m_validateMembershipTags(rule.baseAny, rule.baseMinimum, bases);
    this.m_validateMembershipTags(rule.tagsAny, rule.tagMinimum, modifiers);
};

/**
 * Validates the optional required multiplayer mode.
 *
 * @param {(string|undefined)} mode Required mode.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateMode = function(mode) {
    if (mode !== undefined && ["coop", "versus"].indexOf(mode) < 0) {
        throw Error("Invalid required mode");
    }
};

/**
 * Validates supplied player count boundaries in their original priority order.
 *
 * @param {runeos.catalog.CategoryRegistry.Eligibility} rule Membership settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validatePlayerRules = function(rule) {
    ["minimumMaxPlayers", "maximumMinPlayers", "maximumMaxPlayers"].forEach(function(key) {
        if (rule[key] !== undefined && !runeos.util.Validation.isInteger(rule[key], 1)) {
            throw Error("Invalid player membership rule");
        }
    });
};

/**
 * Validates alternative strength rules. At least one complete alternative must
 * match; mode and player requirements remain on the parent eligibility rule.
 * Nested alternatives are excluded to keep category definitions straightforward.
 *
 * @param {(Array.<runeos.catalog.CategoryRegistry.StrengthRule>|undefined)} rules Alternative strength criteria.
 * @param {Array.<string>} bases Allowed game families.
 * @param {Array.<string>} modifiers Allowed complementary tags.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateAlternatives = function(rules, bases, modifiers) {
    var validation = this;
    if (rules === undefined) return;
    if (!Array.isArray(rules) || !rules.length) throw Error("Expected category alternatives");
    rules.forEach(function(rule) {
        validation.m_validateAlternative(rule, bases, modifiers);
    });
};

/**
 * Validates one complete strength alternative without allowing nested rules.
 *
 * @param {runeos.catalog.CategoryRegistry.StrengthRule} rule Alternative tag requirements.
 * @param {Array.<string>} bases Allowed game families.
 * @param {Array.<string>} modifiers Allowed modifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateAlternative = function(rule, bases, modifiers) {
    this.m_validateFields(rule, ["baseAny", "baseMinimum", "tagsAny", "tagMinimum"]);
    if (!rule.baseAny && !rule.tagsAny) throw Error("Category alternatives require strength criteria");
    this.m_validateStrengths(rule, bases, modifiers);
};

/**
 * Validates profile ranking with independently normalized component weights.
 *
 * @param {runeos.catalog.CategoryRegistry.Definition} category Category definition.
 * @param {Array.<string>} tags All taxonomy identifiers.
 * @param {Array.<string>} bases Game-family identifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateProfile = function(category, tags, bases) {
    if (category.weights !== undefined || category.minimum_score !== undefined || category.playerScoring !== undefined || category.filters !== undefined) {
        throw Error("Profile categories use eligibility and ranking instead of legacy rules");
    }
    var modifiers = tags.filter(function(id) { return bases.indexOf(id) < 0; });
    this.m_validateEligibility(category.eligibility, bases, modifiers);
    this.m_validateRanking(category.ranking, bases, modifiers);
};

/**
 * Validates a taxonomy layer and its positive membership threshold together.
 *
 * @param {(Array.<string>|undefined)} ids Optional relevant tag identifiers.
 * @param {(number|undefined)} minimum Optional minimum strength.
 * @param {Array.<string>} allowed Allowed identifiers for this layer.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateMembershipTags = function(ids, minimum, allowed) {
    if (ids === undefined && minimum === undefined) return;
    this.m_validateTagIds(ids, allowed);
    this.score(minimum);
    if (minimum <= 0) throw Error("Membership strengths must be positive");
};

/**
 * Validates family, modifier and player contributions to category ordering.
 *
 * @param {(runeos.catalog.CategoryRegistry.Ranking|undefined)} ranking Ranking rules.
 * @param {Array.<string>} bases Allowed game-family identifiers.
 * @param {Array.<string>} modifiers Allowed complementary tag identifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateRanking = function(ranking, bases, modifiers) {
    this.m_validateFields(ranking, ["baseWeight", "modifierWeight", "playerWeight", "baseAny", "modifierWeights", "playerScores"]);
    this.m_validateRankingWeights(ranking);
    if (ranking.baseWeight > 0 || ranking.baseAny !== undefined) this.m_validateTagIds(ranking.baseAny, bases);
    runeos.catalog.TagRegistry.validateWeights(ranking.modifierWeights || {}, modifiers, ranking.modifierWeight > 0 ? 100 : 0);
    if (ranking.playerWeight > 0 || ranking.playerScores !== undefined) {
        this.m_validatePlayerScoring({
            weight: ranking.playerWeight,
            scores: ranking.playerScores
        });
    }
};

/**
 * Requires valid component percentages with a shared total of one hundred.
 *
 * @param {(runeos.catalog.CategoryRegistry.Ranking|undefined)} ranking Ranking rules.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateRankingWeights = function(ranking) {
    var validation = this;
    ["baseWeight", "modifierWeight", "playerWeight"].forEach(function(key) {
        validation.score(ranking[key]);
    });
    var total = ranking.baseWeight + ranking.modifierWeight + ranking.playerWeight;
    if (Math.abs(total - 100) > 0.000001) throw Error("Ranking component weights must sum to 100");
};

/**
 * Validates optional numeric filters used by older category definitions.
 *
 * @param {(Array.<Object>|undefined)} filters Optional legacy filters.
 * @param {Array.<string>} tags Allowed tag identifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateLegacyFilters = function(filters, tags) {
    if (filters === undefined) return;
    if (!Array.isArray(filters)) throw Error("Expected filters array");
    var registry = this;
    filters.forEach(function(filter) { registry.m_validateLegacyFilter(filter, tags); });
};

/**
 * Validates one player-count or tag-strength comparison.
 *
 * @param {Object} filter Legacy numeric filter.
 * @param {Array.<string>} tags Allowed tag identifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryValidation.prototype.m_validateLegacyFilter = function(filter, tags) {
    var path = filter && typeof filter.field === "string" ? filter.field.split(".") : [];
    var playerField = path.length === 2 && path[0] === "players" && ["min", "max"].indexOf(path[1]) >= 0;
    var tagField = path.length === 2 && path[0] === "tags" && tags.indexOf(path[1]) >= 0;
    if (!playerField && !tagField) throw Error("Invalid category filter");
    if (["gte", "lte"].indexOf(filter.operator) < 0) throw Error("Invalid category filter");
    if (typeof filter.value !== "number" || !isFinite(filter.value) || filter.value <= 0) throw Error("Invalid category filter");
    if (playerField && !runeos.util.Validation.isInteger(filter.value, 1)) throw Error("Invalid category filter");
    if (tagField && filter.value > 100) throw Error("Invalid category filter");
};
