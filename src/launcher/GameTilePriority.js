//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new GameTilePriority instance.
 *
 * @constructor
 *
 * @param {number} [seed] Stable random seed, shared by default for this OS session.
 * @param {Object} [config] Optional promotion settings.
 *
 * @class
 * @classdesc
 *
 * Chooses game-specific preferred Tile sizes using category relevance and
 * membership, without quotas or changes to relevance ordering. TileLayout
 * independently decides which requested sizes fit.
 */
runeos.launcher.GameTilePriority = function(seed, config) {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable promotion probabilities and category-exclusivity weight.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("priority", config);

    /**
     * Seed used with category and game IDs, independent of iteration order.
     * @type {number}
     * @private
     */
    this.m_seed = seed === undefined ? runeos.launcher.GameTilePriority.m_sessionSeed : seed;

};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Maximum chance of requesting Large.
 *
 * @type {number}
 * @const
 */
runeos.launcher.GameTilePriority.LARGE_CHANCE = runeos.system.Config.DEFAULTS.priority.largeChance;

/**
 * Maximum chance of requesting Wide.
 *
 * @type {number}
 * @const
 */
runeos.launcher.GameTilePriority.WIDE_CHANCE = runeos.system.Config.DEFAULTS.priority.wideChance;

//------------------------------------------------------------------------------
// Private static properties
//------------------------------------------------------------------------------

/**
 * Random seed shared by size selection throughout the OS session.
 *
 * @type {number}
 * @private
 */
runeos.launcher.GameTilePriority.m_sessionSeed = Math.floor(Math.random() * 4294967296);

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Normalizes relevance to the category's theoretical maximum. Exclusivity gives
 * a modest advantage: one category retains full strength, many approach 80%.
 *
 * @param {number} score Category relevance, never modified.
 * @param {number} maximum Highest category weight (maximum attainable score).
 * @param {number} memberships Number of category lists containing this game.
 *
 * @returns {number} Promotion strength between zero and one.
 */
runeos.launcher.GameTilePriority.prototype.getStrength = function(score, maximum, memberships) {
    var relevance = maximum > 0 ? Math.max(0, Math.min(1, score / maximum)) : 0;
    return relevance * (1 - this.m_config.exclusivityBonus + this.m_config.exclusivityBonus / Math.sqrt(Math.max(1, memberships)));
};

/**
 * Requests a size; the existing packer may reduce it when it cannot fit.
 * Normal remains possible even at maximum promotion strength.
 *
 * @param {string} categoryId Category identifier.
 * @param {string} gameId Game identifier.
 * @param {number} score Category relevance.
 * @param {number} maximum Maximum category relevance.
 * @param {number} memberships Category membership count.
 *
 * @returns {number} Zero (Normal), one (Wide) or two (Large).
 */
runeos.launcher.GameTilePriority.prototype.choose = function(categoryId, gameId, score, maximum, memberships) {
    var strength = this.getStrength(score, maximum, memberships);
    var random = this.m_random(categoryId, gameId);
    var large = this.m_config.largeChance * strength;
    var wide = this.m_config.wideChance * strength;
    if (random < large) return 2;
    if (random < large + wide) return 1;
    return 0;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Hashes an unambiguous ID pair using ES5 integer arithmetic.
 *
 * @param {string} categoryId Category identifier.
 * @param {string} gameId Game identifier.
 *
 * @returns {number} Stable value in [0, 1).
 * @private
 */
runeos.launcher.GameTilePriority.prototype.m_random = function(categoryId, gameId) {
    var key = JSON.stringify([this.m_seed, categoryId, gameId]);
    var hash = 2166136261;
    for (var i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
};
