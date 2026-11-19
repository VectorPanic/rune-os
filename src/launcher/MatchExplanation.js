//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new MatchExplanation instance.
 *
 * @constructor
 *
 * @param {Array.<Object>} tags Taxonomy definitions with display names.
 * @param {Object} [options] Optional selector presentation settings.
 *
 * @class
 * @classdesc
 *
 * Produces short category-specific explanations from actual membership rules
 * and ranking traits. It owns no UI state and never changes game metadata.
 */
runeos.launcher.MatchExplanation = function(tags, options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable explanation presentation settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("selector", options.config);

    /**
     * Taxonomy labels indexed by identifier.
     *
     * @type {Object}
     * @private
     */
    this.m_names = Object.create(null);

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Indexes the vocabulary used by category explanations.
     */
    this.m_construct(tags);
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Explains why one game belongs to the supplied category.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Validated game definition.
 * @param {runeos.catalog.CategoryRegistry.Definition} category Category rules or reserve definition.
 *
 * @returns {string} Up to the configured number of concise reasons.
 */
runeos.launcher.MatchExplanation.prototype.describe = function(game, category) {
    if (!this.m_config.showMatchReasons) return "";
    if (!category.ranking && !category.weights) return this.m_config.fallbackReason;
    var reasons = [];
    var rule = category.eligibility || {};
    if (rule.requiredMode === "coop") reasons.push(this.m_config.coopReason);
    if (rule.requiredMode === "versus") reasons.push(this.m_config.versusReason);
    if (rule.maximumMinPlayers === 1) reasons.push(this.m_config.soloReason);
    this.m_addMembershipReasons(reasons, game, rule);
    this.m_addModifiers(reasons, game, category);
    if (category.ranking) this.m_addStrongest(reasons, game.baseTags, category.ranking.baseAny, this.m_config.reasonMinStrength);
    return reasons.slice(0, this.m_config.reasonMaxTerms).join(", ");
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Indexes labels from the supplied JSON vocabulary.
 *
 * @param {Array.<Object>} tags Tag definitions.
 *
 * @returns {undefined}
 * @private
 */
runeos.launcher.MatchExplanation.prototype.m_construct = function(tags) {
    var names = this.m_names;
    tags.forEach(function(tag) { names[tag.id] = tag.name; });
};

/**
 * Adds qualifying family and modifier labels from regular or alternative rules.
 * Missing traits never contribute a reason for the selected game.
 *
 * @param {Array.<string>} reasons Collected labels.
 * @param {runeos.catalog.GameRegistry.Definition} game Game profile.
 * @param {runeos.catalog.CategoryRegistry.Eligibility} rule Membership criteria.
 *
 * @returns {undefined}
 * @private
 */
runeos.launcher.MatchExplanation.prototype.m_addMembershipReasons = function(reasons, game, rule) {
    var explanation = this;
    [rule].concat(rule.anyOf || []).forEach(function(criteria) {
        explanation.m_addStrongest(reasons, game.baseTags, criteria.baseAny, criteria.baseMinimum);
        explanation.m_addStrongest(reasons, game.tags, criteria.tagsAny, criteria.tagMinimum);
    });
};

/**
 * Adds the strongest qualifying membership or base-ranking trait.
 *
 * @param {Array.<string>} reasons Collected labels.
 * @param {(Object|undefined)} strengths Game strengths.
 * @param {(Array.<string>|undefined)} ids Relevant identifiers.
 * @param {(number|undefined)} minimum Minimum meaningful strength.
 *
 * @returns {undefined}
 * @private
 */
runeos.launcher.MatchExplanation.prototype.m_addStrongest = function(reasons, strengths, ids, minimum) {
    var best = null;
    var highest = 0;
    (ids || []).forEach(function(id) {
        var value = runeos.catalog.GameRegistry.getStrength(strengths, id);
        if (value >= minimum && value > highest) {
            best = id;
            highest = value;
        }
    });
    if (best) this.m_addLabel(reasons, best);
};

/**
 * Adds complementary traits ordered by their actual ranking contribution.
 *
 * @param {Array.<string>} reasons Collected labels.
 * @param {runeos.catalog.GameRegistry.Definition} game Game profile.
 * @param {runeos.catalog.CategoryRegistry.Definition} category Category rules.
 *
 * @returns {undefined}
 * @private
 */
runeos.launcher.MatchExplanation.prototype.m_addModifiers = function(reasons, game, category) {
    var weights = category.ranking ? category.ranking.modifierWeights || {} : category.weights;
    if (category.ranking && category.ranking.modifierWeight === 0) return;
    var minimum = this.m_config.reasonMinStrength;
    var traits = Object.keys(/**
         * Legacy weights have already passed category validation.
         * @type {!Object<string, number>}
         */ (weights)).filter(function(id) {
        return weights[id] > 0 && runeos.catalog.GameRegistry.getStrength(game.tags, id) >= minimum;
    });
    traits.sort(function(a, b) {
        var difference = runeos.catalog.GameRegistry.getStrength(game.tags, b) * weights[b] - runeos.catalog.GameRegistry.getStrength(game.tags, a) * weights[a];
        return difference || (a < b ? -1 : a > b ? 1 : 0);
    });
    for (var i = 0; i < traits.length && reasons.length < this.m_config.reasonMaxTerms; i++) this.m_addLabel(reasons, traits[i]);
};

/**
 * Adds one known taxonomy label without duplicates.
 *
 * @param {Array.<string>} reasons Collected labels.
 * @param {string} id Taxonomy identifier.
 *
 * @returns {undefined}
 * @private
 */
runeos.launcher.MatchExplanation.prototype.m_addLabel = function(reasons, id) {
    var name = this.m_names[id];
    if (name && reasons.indexOf(name) < 0 && reasons.length < this.m_config.reasonMaxTerms) reasons.push(name);
};
