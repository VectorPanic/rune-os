//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new GamePresentation instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Formats catalog game metadata into ready-to-display label strings. Owns no
 * display objects and does not change or retain the game definition.
 */
runeos.launcher.GamePresentation = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Creates a label snapshot for a game and its category-specific explanation.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game metadata.
 * @param {string} [description] Category match explanation.
 *
 * @returns {Object} Title, subtitle, metadataText, badgeText and description.
 */
runeos.launcher.GamePresentation.create = function(game, description) {
    return {
        title: typeof game.name === "string" ? game.name : "",
        subtitle: typeof game.developer === "string" ? game.developer.trim() : "",
        metadataText: runeos.launcher.GamePresentation.m_getMetadata(game),
        badgeText: game.stage === "alpha" ? "ALPHA" : game.stage === "beta" ? "BETA" : "",
        description: description || ""
    };
};

//------------------------------------------------------------------------------
// Private static methods
//------------------------------------------------------------------------------

/**
 * Formats a release year and player count, omitting absent or invalid values.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game metadata.
 *
 * @returns {string} English metadata line.
 * @private
 */
runeos.launcher.GamePresentation.m_getMetadata = function(game) {
    var year = runeos.launcher.GamePresentation.m_isPositiveInteger(game.year) ? String(game.year) : "";
    var players = game.players;
    var count = "";
    if (players && runeos.launcher.GamePresentation.m_isPositiveInteger(players.min) &&
        runeos.launcher.GamePresentation.m_isPositiveInteger(players.max) && players.max >= players.min) {
        count = players.min === players.max ? String(players.min) : players.min + "-" + players.max;
        count += players.max === 1 ? " player" : " players";
    }
    return year && count ? year + " (" + count + ")" : year || count;
};

/**
 * Tests release-year and player-count values without accepting numeric strings.
 *
 * @param {*} value Candidate numeric value.
 *
 * @returns {boolean} Whether the value is a finite positive integer.
 * @private
 */
runeos.launcher.GamePresentation.m_isPositiveInteger = function(value) {
    return typeof value === "number" && isFinite(value) && value > 0 && Math.floor(value) === value;
};
