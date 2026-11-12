//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new GameRegistry instance.
 *
 * @constructor
 *
 * @param {Array.<string>} tags Allowed identifiers from TagRegistry.
 * @param {Array.<string>} [baseTags] Game-family identifiers.
 *
 * @class
 * @classdesc
 *
 * Stores validated games by ID. Definitions are shared by all category Tiles.
 */
runeos.catalog.GameRegistry = function(tags, baseTags) {

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Allowed Game DNA tags used to validate registered definitions.
     *
     * @type {Array.<string>}
     */
    this.allowedTags = tags;

    /**
     * Explicit game-family identifiers, separate from modifiers.
     *
     * @type {Array.<string>}
     */
    this.allowedBaseTags = baseTags || [];

    /**
     * Validated definitions in their original input order.
     *
     * @type {Array.<runeos.catalog.GameRegistry.Definition>}
     */
    this.items = [];

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
     * Lookup table of shared game definitions by internal identifier.
     *
     * @type {!Object<string, runeos.catalog.GameRegistry.Definition>}
     * @private
     */
    this.m_ids = Object.create(null);

};

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Game metadata after local paths have been resolved.
 *
 * @typedef {{
 *     id: (string|undefined),
 *     name: string,
 *     binary: string,
 *     stage: (string|undefined),
 *     year: (number|undefined),
 *     description: (string|undefined),
 *     developer: (string|undefined),
 *     type: (string|undefined),
 *     players: ({min:number,max:number}|undefined),
 *     modes: ({coop:(boolean|undefined),versus:(boolean|undefined)}|undefined),
 *     input: (Array<string>|undefined),
 *     tags: (Object<string, number>|undefined),
 *     baseTags: (Object<string, number>|undefined),
 *     requiredFiles: (Array<string>|undefined),
 *     installed: (boolean|undefined),
 *     enabled: (boolean|undefined),
 *     backgroundColor: (string|undefined),
 *     imageAvailable: (boolean|undefined),
 *     image: (string|undefined)
 * }}
 */
runeos.catalog.GameRegistry.Definition;

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Returns an explicit ID when supplied, otherwise a stable binary-based key.
 * Metadata remains unchanged; moving a binary changes its implicit identity.
 *
 * @param {Object} game Game definition.
 *
 * @returns {string} Internal game identifier.
 */
runeos.catalog.GameRegistry.getId = function(game) {
    return game.id === undefined ? "game:" + game.binary : game.id;
};

/**
 * Returns a validated development stage, defaulting legacy games to gold.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 *
 * @returns {string} Development stage.
 */
runeos.catalog.GameRegistry.getStage = function(game) {
    var stage = game.stage === undefined ? "gold" : game.stage;
    if (["alpha", "beta", "gold"].indexOf(stage) < 0) throw Error("Invalid stage: " + stage);
    return stage;
};

/**
 * Returns the content type while preserving older catalogs without a type.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Content definition.
 *
 * @returns {string} Content type, defaulting to game.
 */
runeos.catalog.GameRegistry.getType = function(game) {
    var type = game.type === undefined ? "game" : game.type;
    runeos.util.Validation.validateText(type, "type");
    return type;
};

/**
 * Reads only an explicitly assigned strength, ignoring inherited object members.
 *
 * @param {(Object|undefined)} strengths Tag strengths.
 * @param {string} id Taxonomy identifier.
 *
 * @returns {number} Assigned strength or zero.
 */
runeos.catalog.GameRegistry.getStrength = function(strengths, id) {
    return strengths && Object.prototype.hasOwnProperty.call(strengths, id) ? strengths[id] : 0;
};

/**
 * Validates concrete cooperative and competitive mode capabilities.
 *
 * @param {(Object|undefined)} modes Mode flags.
 *
 * @returns {undefined}
 */
runeos.catalog.GameRegistry.validateModes = function(modes) {
    if (!modes || typeof modes !== "object" || Array.isArray(modes)) throw Error("Expected modes object");
    Object.keys(modes).forEach(function(mode) {
        if (["coop", "versus"].indexOf(mode) < 0 || typeof modes[mode] !== "boolean") throw Error("Invalid game mode: " + mode);
    });
};

/**
 * Validates declared alternative input methods supported by a game.
 *
 * @param {Array.<string>} input Nonempty keyboard/gamepad capability list.
 *
 * @returns {undefined}
 */
runeos.catalog.GameRegistry.validateInput = function(input) {
    if (!Array.isArray(input) || input.length === 0) throw Error("Expected nonempty game input array");
    input.forEach(function(method, index) {
        if (["keyboard", "gamepad"].indexOf(method) < 0 || input.indexOf(method) !== index) {
            throw Error("Invalid game input: " + method);
        }
    });
};

/**
 * Matches any declared input against enabled OS input methods. Older definitions
 * without input remain unrestricted while at least one OS input is enabled.
 * This describes configured capabilities, not currently connected controllers.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Validated game definition.
 * @param {Array.<string>} enabledInputs Enabled input method names.
 *
 * @returns {boolean} Whether the game has a compatible input method.
 */
runeos.catalog.GameRegistry.supportsInput = function(game, enabledInputs) {
    if (enabledInputs.length === 0) return false;
    if (game.input === undefined) return true;
    return game.input.some(function(method) { return enabledInputs.indexOf(method) >= 0; });
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Replaces the collection, skipping invalid records and reporting every error.
 *
 * @param {Object} document Game definitions with resolved content paths.
 *
 * @returns {Array.<string>} Validation errors.
 */
runeos.catalog.GameRegistry.prototype.replace = function(document) {
    var registry = this;
    var modifiers = (this.allowedTags || []).filter(function(id) {
        return registry.allowedBaseTags.indexOf(id) < 0;
    });

    var result = runeos.util.Validation.validateRecords(document, "games", function(game) {
        registry.m_validateGame(game, modifiers);
    }, runeos.catalog.GameRegistry.getId);

    this.items = result.items;
    this.errors = result.errors;
    this.m_ids = result.ids;

    return this.errors;
};

/**
 * Finds the shared game definition for an internal identifier.
 *
 * @param {string} id Game ID.
 *
 * @returns {?runeos.catalog.GameRegistry.Definition} Shared definition or null.
 */
runeos.catalog.GameRegistry.prototype.get = function(id) {
    return this.m_ids[id] || null;
};

/**
 * Releases registered definitions, lookup entries and validation diagnostics.
 *
 * @returns {undefined}
 */
runeos.catalog.GameRegistry.prototype.clear = function() {
    this.items = [];
    this.errors = [];
    this.m_ids = Object.create(null);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Validates one definition before it enters the game registry.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {Array.<string>} modifiers Allowed complementary tag identifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.GameRegistry.prototype.m_validateGame = function(game, modifiers) {
    runeos.catalog.GameRegistry.getStage(game);
    if (runeos.catalog.GameRegistry.getType(game) === "screensaver") throw Error("Use screensaver metadata for screensavers");
    runeos.util.Validation.validateText(game.name, "name");
    runeos.util.Validation.validatePath(game.image, "image");
    runeos.util.Validation.validatePath(game.binary, "binary");
    this.m_validateTags(game, modifiers);
    if (game.modes !== undefined) runeos.catalog.GameRegistry.validateModes(game.modes);
    if (game.input !== undefined) runeos.catalog.GameRegistry.validateInput(game.input);
    runeos.util.Validation.validateRequiredFiles(game.requiredFiles);
    this.m_validatePlayers(game);
};

/**
 * Validates independent strengths or the older shared tag budget.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 * @param {Array.<string>} modifiers Allowed complementary tag identifiers.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.GameRegistry.prototype.m_validateTags = function(game, modifiers) {
    if (game.baseTags !== undefined) {
        runeos.catalog.TagRegistry.validateStrengths(game.baseTags, this.allowedBaseTags);
        runeos.catalog.TagRegistry.validateStrengths(game.tags === undefined ? {} : game.tags, modifiers);
        return;
    }

    var weights = game.tags;
    var untagged = weights && typeof weights === "object" && !Array.isArray(weights) && Object.keys(weights).length === 0;
    runeos.catalog.TagRegistry.validateWeights(weights, this.allowedTags, untagged ? 0 : 100);
};

/**
 * Validates the player range and its agreement with multiplayer modes.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Game definition.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.GameRegistry.prototype.m_validatePlayers = function(game) {
    var players = game.players;
    if (players !== undefined && (!players || !runeos.util.Validation.isInteger(players.min, 1) ||
        !runeos.util.Validation.isInteger(players.max, players.min))) throw Error("Invalid players.min/max");
    var multiplayer = game.modes && (game.modes.coop || game.modes.versus);

    if (multiplayer && (!players || players.max < 2)) {
        throw Error("Multiplayer modes require at least two supported players");
    }
};
