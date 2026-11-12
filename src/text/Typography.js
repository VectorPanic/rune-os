//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Typography instance. This class is a static library.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Derives shared appearance, field geometry and reading behavior from OS text roles.
 * Does not load resources or own text fields.
 */
runeos.text.Typography = function() {
    console.warn("This class is not meant to be instantiated; all content is static.");
};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Category heading font.
 *
 * @constant {string}
 */
runeos.text.Typography.TITLE = runeos.system.Config.DEFAULTS.text.titleSizePx + "px " + runeos.system.Config.DEFAULTS.text.headingFamily;

/**
 * Selected game title font.
 *
 * @constant {string}
 */
runeos.text.Typography.GAME = runeos.system.Config.DEFAULTS.text.gameSizePx + "px " + runeos.system.Config.DEFAULTS.text.headingFamily;

/**
 * Default text-field font.
 *
 * @constant {string}
 */
runeos.text.Typography.BODY = runeos.system.Config.DEFAULTS.text.bodySizePx + "px " + runeos.system.Config.DEFAULTS.text.bodyFamily;

/**
 * Category position indicator font.
 *
 * @constant {string}
 */
runeos.text.Typography.POSITION = runeos.system.Config.DEFAULTS.text.positionSizePx + "px " + runeos.system.Config.DEFAULTS.text.bodyFamily;

/**
 * Description and game metadata font.
 *
 * @constant {string}
 */
runeos.text.Typography.DETAIL = runeos.system.Config.DEFAULTS.text.detailSizePx + "px " + runeos.system.Config.DEFAULTS.text.bodyFamily;

/**
 * Subtle studio label font.
 *
 * @constant {string}
 */
runeos.text.Typography.STUDIO = runeos.system.Config.DEFAULTS.text.studioSizePx + "px " + runeos.system.Config.DEFAULTS.text.bodyFamily;

//------------------------------------------------------------------------------
// Private static constants
//------------------------------------------------------------------------------

/**
 * Role-specific choices. Unspecified values use common text configuration.
 * Font roles reuse existing size/family settings; padding preserves field bounds.
 *
 * @constant {Object}
 * @private
 */
runeos.text.Typography.m_roles = Object.freeze({
    title: Object.freeze({
        font: "title",
        padding: 8
    }),
    game: Object.freeze({
        font: "game",
        padding: 8,
        pause: "titleScrollPauseMs"
    }),
    body: Object.freeze({
        font: "body",
        padding: 8
    }),
    position: Object.freeze({
        font: "position",
        padding: 16,
        speed: 0,
        opacity: "positionOpacity"
    }),
    count: Object.freeze({
        font: "position",
        padding: 16,
        speed: 0,
        opacity: "countOpacity"
    }),
    detail: Object.freeze({
        font: "detail",
        padding: 6,
        speed: "descriptionScrollSpeedPxPerSecond",
        opacity: "descriptionOpacity"
    }),
    studio: Object.freeze({
        font: "studio",
        padding: 6,
        speed: "studioScrollSpeedPxPerSecond",
        pause: "studioScrollPauseMs",
        opacity: "studioOpacity"
    }),
    metadata: Object.freeze({
        font: "metadata",
        padding: 6,
        speed: 0,
        opacity: "metadataOpacity"
    }),
    stage: Object.freeze({
        font: "stage",
        padding: 6,
        speed: 0,
        opacity: "stageOpacity"
    }),
    reason: Object.freeze({
        font: "reason",
        padding: 6,
        speed: "reasonScrollSpeedPxPerSecond",
        opacity: "reasonOpacity"
    }),
    notification: Object.freeze({
        font: "body",
        padding: 8,
        speed: 0
    })
});

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Builds a Canvas font declaration from the configured size and family.
 *
 * @param {string} role Configured text role, including count and notification variants.
 * @param {Object} [config] Text configuration group.
 *
 * @returns {string} Canvas font declaration.
 */
runeos.text.Typography.get = function(role, config) {
    config = runeos.system.Config.getGroup("text", config);
    return runeos.text.Typography.m_getFont(runeos.text.Typography.m_getRole(role), config);
};

/**
 * Keeps label buffers large enough when their configured font size changes.
 *
 * @param {string} role Text role.
 * @param {Object} [config] Text configuration group.
 *
 * @returns {number} Logical label height.
 */
runeos.text.Typography.getHeight = function(role, config) {
    config = runeos.system.Config.getGroup("text", config);
    var definition = runeos.text.Typography.m_getRole(role);
    return config[definition.font + "SizePx"] + definition.padding;
};

/**
 * Resolves complete initial appearance and scrolling defaults for a text role.
 * Explicit field options override role values, including zero opacity/speed and
 * transparent shadows. The immutable result can be used as an animation baseline.
 *
 * @param {string} role Text role, including count and notification variants.
 * @param {Object} [config] Text configuration group.
 * @param {Object} [options] Local appearance and scrolling overrides.
 *
 * @returns {Object} Immutable resolved text style.
 */
runeos.text.Typography.getStyle = function(role, config, options) {
    config = runeos.system.Config.getGroup("text", config);
    var definition = runeos.text.Typography.m_getRole(role);
    var style = {
        font: runeos.text.Typography.m_getFont(definition, config),
        height: config[definition.font + "SizePx"] + definition.padding,
        color: config.color,
        alpha: config[definition.opacity || "defaultOpacity"],
        shadowColor: config.shadowColor,
        shadowBlur: config.shadowBlurPx,
        shadowOffsetX: config.shadowOffsetXPx,
        shadowOffsetY: config.shadowOffsetYPx,
        scrollSpeed: typeof definition.speed === "number" ? definition.speed :
            config[definition.speed || "scrollSpeedPxPerSecond"],
        scrollPause: config[definition.pause || "scrollPauseMs"],
        scrollGap: config.scrollGapPx
    };
    options = options || {};
    Object.keys(style).forEach(function(key) {
        if (options[key] !== undefined) style[key] = options[key];
    });
    // Preserve the field's established fallback for absent font/color strings.
    style.font = style.font || runeos.text.Typography.m_getFont(definition, config);
    style.color = style.color || config.color;
    style.shadowColor = style.shadowColor || config.shadowColor;
    return Object.freeze(style);
};

//------------------------------------------------------------------------------
// Private static methods
//------------------------------------------------------------------------------

/**
 * Returns the shared role definition or rejects an unknown role.
 *
 * @param {string} role Text role.
 *
 * @returns {Object} Immutable role definition.
 * @private
 */
runeos.text.Typography.m_getRole = function(role) {
    if (!Object.prototype.hasOwnProperty.call(runeos.text.Typography.m_roles, role)) {
        throw new Error("Unknown text role: " + role);
    }
    return runeos.text.Typography.m_roles[role];
};

/**
 * Builds the configured font declaration for a resolved role.
 *
 * @param {Object} definition Role definition.
 * @param {Object} config Resolved text settings.
 *
 * @returns {string} Canvas font declaration.
 * @private
 */
runeos.text.Typography.m_getFont = function(definition, config) {
    var heading = definition.font === "title" || definition.font === "game";
    return config[definition.font + "SizePx"] + "px " + (heading ? config.headingFamily : config.bodyFamily);
};
