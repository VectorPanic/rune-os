//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Validation instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Checks explicit numeric limits and group-specific rules independently of runtime components.
 */
runeos.system.config.Validation = function() {

};

//------------------------------------------------------------------------------
// Private static constants
//------------------------------------------------------------------------------

/**
 * Fields restricted to the inclusive range zero to one.
 *
 * @constant {!Array<string>}
 * @private
 */
runeos.system.config.Validation.UNIT_INTERVAL = Object.freeze([
    "selector.idleOpacity",
    "launcherBackground.fieldOpacity",
    "tiles.inactiveOpacity",
    "tiles.shadowOpacity",
    "tiles.labelGradientOpacity",
    "tilemaps.inactiveOpacity",
    "text.defaultOpacity",
    "text.reasonOpacity",
    "text.metadataOpacity",
    "text.studioOpacity",
    "text.stageOpacity",
    "text.descriptionOpacity",
    "text.positionOpacity",
    "text.countOpacity",
    "text.brightnessThreshold",
    "audio.masterVolume",
    "audio.boot.volume",
    "audio.selection.volume",
    "audio.selection.pitchVariation",
    "audio.categoryChange.volume",
    "audio.categoryChange.pitchVariation",
    "audio.start.volume",
    "audio.stop.volume",
    "input.buttonThreshold",
    "screensaverCredits.backgroundOpacity",
    "exitIndicator.backgroundOpacity",
    "exitIndicator.trackOpacity",
    "notifications.backgroundOpacity",
    "priority.largeChance",
    "priority.wideChance",
    "priority.exclusivityBonus"
]);

/**
 * Fields that must be strictly positive.
 *
 * @constant {!Array<string>}
 * @private
 */
runeos.system.config.Validation.POSITIVE = Object.freeze([
    "boot.logoSizePx",
    "boot.pulsePeriodMs",
    "tiles.sizePx",
    "tiles.breathingPeriodMs",
    "text.titleSizePx",
    "text.gameSizePx",
    "text.bodySizePx",
    "text.positionSizePx",
    "text.detailSizePx",
    "text.studioSizePx",
    "text.metadataSizePx",
    "text.stageSizePx",
    "text.reasonSizePx",
    "screensaverCredits.minFontSizePx",
    "exitIndicator.sizePx"
]);

/**
 * Offsets that may be negative; other numeric values are nonnegative.
 *
 * @constant {!Array<string>}
 * @private
 */
runeos.system.config.Validation.SIGNED = Object.freeze([
    "selector.enterOffsetYPx",
    "selector.exitOffsetYPx",
    "tiles.shadowOffsetXPx",
    "tiles.shadowOffsetYPx",
    "tiles.labelShadowOffsetYPx",
    "text.shadowOffsetXPx",
    "text.shadowOffsetYPx"
]);

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Validates a complete snapshot through small rules for each area.
 *
 * @param {!Object} values Fully merged configuration groups.
 *
 * @returns {undefined}
 */
runeos.system.config.Validation.prototype.validate = function(values) {
    this.m_validateNumbers(values, "");
    this.m_validateSync(values.sync);
    this.m_validateSelector(values.selector);
    this.m_validateInput(values.input);
    this.m_validateLibrary(values.library);
    this.m_validateTiles(values.tiles);
    this.m_validateAudio(values.audio);
    this.m_validatePriority(values.priority);
    this.m_validateLayout(values.advanced);
    this.m_validateLoading(values.loading);
    this.m_require(values.applicationIdle.warningMs > 0, "applicationIdle.warningMs");
    this.m_require(values.notifications.maxWidthPx > 0, "notifications.maxWidthPx");
    this.m_require(values.launcherBackground.radiusRatio > 0, "launcherBackground.radiusRatio");
    this.m_require(values.exitIndicator.sizePx / 2 > values.exitIndicator.strokeWidthPx * 1.5 + 3, "exitIndicator.sizePx/strokeWidthPx");
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Visits numeric values and applies declared bounds without inferring rules from names.
 *
 * @param {!Object} values Group or nested configuration.
 * @param {string} path Current path without the config prefix.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validateNumbers = function(values, path) {
    var self = this;
    Object.keys(values).forEach(function(key) {
        var value = values[key];
        var field = path ? path + "." + key : key;
        if (typeof value === "object" && value !== null) self.m_validateNumbers(value, field);
        if (typeof value !== "number") return;
        if (runeos.system.config.Validation.SIGNED.indexOf(field) < 0) self.m_require(value >= 0, field);
        if (runeos.system.config.Validation.UNIT_INTERVAL.indexOf(field) >= 0) self.m_require(value <= 1, field);
        if (runeos.system.config.Validation.POSITIVE.indexOf(field) >= 0) self.m_require(value > 0, field);
    });
};

/**
 * Checks positive integer limits for native synchronization.
 *
 * @param {Object} options Sync settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validateSync = function(options) {
    var self = this;
    ["timeoutMs", "maxFiles", "maxManifestSizeBytes", "maxFileSizeBytes", "maxTotalSizeBytes"].forEach(function(key) {
        self.m_positiveInteger(options[key], "sync." + key);
    });
};

/**
 * Checks explanation limits and ordered launch fade durations.
 *
 * @param {Object} options Selector settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validateSelector = function(options) {
    this.m_positiveInteger(options.reasonMaxTerms, "selector.reasonMaxTerms");
    this.m_require(options.reasonMinStrength > 0 && options.reasonMinStrength <= 100, "selector.reasonMinStrength");
    this.m_require(options.launchFadeMaxMs >= options.launchFadeMinMs, "selector.launchFadeMinMs/launchFadeMaxMs");
};

/**
 * Checks navigation choice and the relationship between stick thresholds.
 *
 * @param {Object} options Input settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validateInput = function(options) {
    this.m_require(options.navigationStick === "left" || options.navigationStick === "right", "input.navigationStick");
    this.m_require(options.stickEngage > 0 && options.stickEngage <= 1 &&
        options.stickRelease > 0 && options.stickRelease < options.stickEngage, "input.stickEngage/stickRelease");
    this.m_require(options.buttonThreshold > 0, "input.buttonThreshold");
};

/**
 * Checks inspection concurrency and unique supported development stages.
 *
 * @param {Object} options Library settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validateLibrary = function(options) {
    this.m_positiveInteger(options.inspectionConcurrency, "library.inspectionConcurrency");
    var self = this;
    options.stages.forEach(function(stage, index, stages) {
        self.m_require(["alpha", "beta", "gold"].indexOf(stage) >= 0 && stages.indexOf(stage) === index, "library.stages");
    });
};

/**
 * Checks integral columns and the selected tile scale.
 *
 * @param {Object} options Tile settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validateTiles = function(options) {
    this.m_positiveInteger(options.columns, "tiles.columns");
    this.m_require(options.selectedScale >= 1, "tiles.selectedScale");
};

/**
 * Keeps variable sound playback rates inside the supported range.
 *
 * @param {Object} options Audio settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validateAudio = function(options) {
    var self = this;
    ["selection", "categoryChange"].forEach(function(key) {
        var effect = options[key];
        self.m_require(effect.playbackRate * (1 - effect.pitchVariation) >= 0.25 &&
            effect.playbackRate * (1 + effect.pitchVariation) <= 4, "audio." + key + ".playbackRate/pitchVariation");
    });
};

/**
 * Prevents mutually exclusive promotion probabilities from exceeding one.
 *
 * @param {Object} options Priority settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validatePriority = function(options) {
    this.m_require(options.largeChance + options.wideChance <= 1, "priority.largeChance/wideChance");
};

/**
 * Checks integral search limits while permitting a disabled tile budget.
 *
 * @param {Object} options Advanced layout settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validateLayout = function(options) {
    this.m_integer(options.layoutMaxTiles, "advanced.layoutMaxTiles");
    this.m_positiveInteger(options.layoutMaxAttempts, "advanced.layoutMaxAttempts");
};

/**
 * Checks integer timeouts, retaining zero as a supported setting.
 *
 * @param {Object} options Loading settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_validateLoading = function(options) {
    this.m_integer(options.timeoutMs, "loading.timeoutMs");
    this.m_integer(options.audioTimeoutMs, "loading.audioTimeoutMs");
};

/**
 * Requires a whole value greater than zero.
 *
 * @param {number} value Previously type-checked number.
 * @param {string} path Diagnostic setting path.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_positiveInteger = function(value, path) {
    this.m_require(value >= 1 && Math.floor(value) === value, path);
};

/**
 * Requires a whole value; generic bounds handle whether zero is allowed.
 *
 * @param {number} value Previously type-checked number.
 * @param {string} path Diagnostic setting path.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_integer = function(value, path) {
    this.m_require(Math.floor(value) === value, path);
};

/**
 * Reports a failed rule using the complete configuration path.
 *
 * @param {boolean} valid Whether the rule holds.
 * @param {string} path Setting path without the config prefix.
 *
 * @returns {undefined}
 * @private
 */
runeos.system.config.Validation.prototype.m_require = function(valid, path) {
    if (!valid) throw new RangeError("Invalid setting: config." + path);
};

