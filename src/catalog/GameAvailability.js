//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new GameAvailability instance.
 *
 * @constructor
 *
 * @param {Object} options Validated stages and enabled keyboard/gamepad flags.
 *
 * @class
 * @classdesc
 *
 * Decides which registered games may be shown. Uses an independent settings
 * snapshot without depending on UI, configuration globals or connected devices.
 */
runeos.catalog.GameAvailability = function(options) {
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Independent list of development stages allowed in the catalog.
     *
     * @type {Array.<string>}
     * @private
     */
    this.m_stages = options.stages.slice();

    /**
     * Configured input capabilities; independent of device connection state.
     *
     * @type {Array.<string>}
     * @private
     */
    this.m_enabledInputs = [];

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Selects visible games without modifying definitions or their input order.
 *
 * @param {Array.<runeos.catalog.GameRegistry.Definition>} games Validated game definitions.
 *
 * @returns {Array.<Object>} Shared definitions allowed by the visibility policy.
 */
runeos.catalog.GameAvailability.prototype.filter = function(games) {
    var availability = this;
    return games.filter(function(game) { return availability.isVisible(game); });
};

/**
 * Checks whether a registered game may be shown in the catalog.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Validated game definition.
 *
 * @returns {boolean} Whether the game passes all visibility rules.
 */
runeos.catalog.GameAvailability.prototype.isVisible = function(game) {
    return this.getHiddenReason(game) === null;
};

/**
 * Explains the first failed rule, in installation, stage and input order.
 * Codes are diagnostic values, not user-facing messages. Older games default to
 * gold and retain unrestricted input while any configured input is enabled.
 *
 * @param {runeos.catalog.GameRegistry.Definition} game Validated game definition.
 *
 * @returns {?string} not-installed, stage-disabled, input-disabled, or null if visible.
 */
runeos.catalog.GameAvailability.prototype.getHiddenReason = function(game) {
    if (game.installed === false) return "not-installed";
    if (this.m_stages.indexOf(runeos.catalog.GameRegistry.getStage(game)) < 0) return "stage-disabled";
    if (!runeos.catalog.GameRegistry.supportsInput(game, this.m_enabledInputs)) return "input-disabled";
    return null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Copies the policy values supplied by the owner. No services are retained.
 *
 * @param {Object} options Validated stages, useKeyboard and useGamepads values.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.GameAvailability.prototype.m_construct = function(options) {

    if (options.useKeyboard) this.m_enabledInputs.push("keyboard");
    if (options.useGamepads) this.m_enabledInputs.push("gamepad");
};
