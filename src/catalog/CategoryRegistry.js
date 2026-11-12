//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new CategoryRegistry instance.
 *
 * @constructor
 *
 * @param {Array.<string>} [tags] Allowed identifiers from TagRegistry.
 * @param {Array.<string>} [baseTags] Game-family identifiers.
 * @param {runeos.catalog.CategoryValidation} [validation] Independent category rules.
 *
 * @class
 * @classdesc
 *
 * Stores category rules validated against an explicitly supplied DNA vocabulary.
 */
runeos.catalog.CategoryRegistry = function(tags, baseTags, validation) {

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Validated definitions in their original input order.
     *
     * @type {Array.<runeos.catalog.CategoryRegistry.Definition>}
     */
    this.items = [];

    /**
     * Allowed Game DNA vocabulary supplied independently of category weights.
     *
     * @type {Array.<string>}
     */
    this.tags = tags ? tags.slice() : [];

    /**
     * Allowed game-family identifiers.
     *
     * @type {Array.<string>}
     */
    this.baseTags = baseTags ? baseTags.slice() : [];

    /**
     * Validation diagnostics for the latest operation.
     *
     * @type {Array.<string>}
     */
    this.errors = [];

    /**
     * Default inclusive relevance threshold for categories.
     *
     * @type {number}
     */
    this.minimumScore = 5;

    /**
     * Optional automatic category for games without a displayed membership.
     *
     * @type {Object}
     */
    this.fallback = null;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Validates definitions without owning registration or error collection.
     *
     * @type {runeos.catalog.CategoryValidation}
     * @private
     */
    this.m_validation = validation || new runeos.catalog.CategoryValidation();

};

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Family and modifier thresholds that form one complete strength alternative.
 *
 * @typedef {{
 *     baseAny: (Array<string>|undefined),
 *     baseMinimum: (number|undefined),
 *     tagsAny: (Array<string>|undefined),
 *     tagMinimum: (number|undefined)
 * }}
 */
runeos.catalog.CategoryRegistry.StrengthRule;

/**
 * Optional membership rules read from categories.json.
 *
 * @typedef {{
 *     baseAny: (Array<string>|undefined),
 *     baseMinimum: (number|undefined),
 *     tagsAny: (Array<string>|undefined),
 *     tagMinimum: (number|undefined),
 *     anyOf: (Array<runeos.catalog.CategoryRegistry.StrengthRule>|undefined),
 *     requiredMode: (string|undefined),
 *     minimumMaxPlayers: (number|undefined),
 *     maximumMinPlayers: (number|undefined),
 *     maximumMaxPlayers: (number|undefined)
 * }}
 */
runeos.catalog.CategoryRegistry.Eligibility;

/**
 * Independent relevance contributions for profile categories.
 *
 * @typedef {{
 *     baseWeight: number,
 *     modifierWeight: number,
 *     playerWeight: number,
 *     baseAny: (Array<string>|undefined),
 *     modifierWeights: (Object<string, number>|undefined),
 *     playerScores: (Array<Object>|undefined)
 * }}
 */
runeos.catalog.CategoryRegistry.Ranking;

/**
 * Category metadata supporting profile and legacy rules.
 *
 * @typedef {{
 *     id: string,
 *     name: string,
 *     description: (string|undefined),
 *     eligibility: (runeos.catalog.CategoryRegistry.Eligibility|undefined),
 *     ranking: (runeos.catalog.CategoryRegistry.Ranking|undefined),
 *     weights: (Object<string, number>|undefined),
 *     minimum_score: (number|undefined),
 *     limit: (number|undefined),
 *     playerScoring: (Object|undefined),
 *     filters: (Array<Object>|undefined)
 * }}
 */
runeos.catalog.CategoryRegistry.Definition;

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Validates category definitions against the supplied DNA vocabulary.
 *
 * @param {Object} document Parsed categories.json.
 *
 * @returns {Array.<string>} Errors.
 */
runeos.catalog.CategoryRegistry.prototype.replace = function(document) {
    var registry = this;
    var scoringError = this.m_readMinimumScore(document);
    var result = runeos.util.Validation.validateRecords(document, "categories", function(category) {
        if (scoringError) throw Error(scoringError);
        registry.m_validation.validate(category, registry.tags, registry.baseTags);
    });
    this.items = result.items;
    this.errors = result.errors;
    this.m_readFallback(document);
    return this.errors;
};

/**
 * Releases category definitions and resets the retained tag vocabulary.
 *
 * @returns {undefined}
 */
runeos.catalog.CategoryRegistry.prototype.clear = function() {
    this.items = [];
    this.tags = [];
    this.baseTags = [];
    this.errors = [];
    this.minimumScore = 5;
    this.fallback = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Reads the shared score threshold, preserving per-category error reporting.
 *
 * @param {Object} document Category document.
 *
 * @returns {?string} Threshold validation error, or null.
 * @private
 */
runeos.catalog.CategoryRegistry.prototype.m_readMinimumScore = function(document) {
    var minimum = document && document.scoring && document.scoring.minimum_score;
    this.minimumScore = minimum === undefined ? 5 : minimum;
    try {
        this.m_validation.score(this.minimumScore);
        return null;
    } catch (error) {
        return error.message;
    }
};

/**
 * Reads the optional reserve category and reports its errors independently.
 *
 * @param {Object} document Category document.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.CategoryRegistry.prototype.m_readFallback = function(document) {
    this.fallback = null;
    if (!document || document.fallback === undefined) return;
    try {
        this.m_validation.fallback(document.fallback, this.items);
        this.fallback = document.fallback;
    } catch (error) {
        this.errors.push("fallback: " + error.message);
    }
};
