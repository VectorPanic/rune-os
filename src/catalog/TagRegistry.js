//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new TagRegistry instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Validates the independent DNA vocabulary supplied by tags.json. Category
 * weights never create tags implicitly.
 */
runeos.catalog.TagRegistry = function() {

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Validated definitions in document order.
     *
     * @type {Array.<Object>}
     */
    this.items = [];

    /**
     * Allowed DNA identifiers.
     *
     * @type {Array.<string>}
     */
    this.ids = [];

    /**
     * Identifiers describing game families.
     *
     * @type {Array.<string>}
     */
    this.baseIds = [];

    /**
     * Identifiers describing complementary gameplay traits.
     *
     * @type {Array.<string>}
     */
    this.modifierIds = [];

    /**
     * Validation diagnostics for the latest document.
     *
     * @type {Array.<string>}
     */
    this.errors = [];
};

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Validates allowed tags, finite nonnegative weights and their total.
 *
 * @param {(Object|undefined)} weights Points.
 * @param {Array.<string>} allowed Allowed tags.
 * @param {number} [total=100] Required points total.
 *
 * @returns {undefined}
 */
runeos.catalog.TagRegistry.validateWeights = function(weights, allowed, total) {
    if (!weights || typeof weights !== "object" || Array.isArray(weights)) throw Error("Missing tag weights");
    var sum = 0;
    Object.keys(weights).forEach(function(tag) {
        var value = weights[tag];
        if (allowed.indexOf(tag) < 0) throw Error("Unknown DNA tag: " + tag);
        if (typeof value !== "number" || !isFinite(value) || value < 0) throw Error("Invalid weight: " + tag);
        sum += value;
    });
    total = total === undefined ? 100 : total;
    if (Math.abs(sum - total) > 0.000001) throw Error("Tag weights must sum to " + total + " (got " + sum + ")");
};

/**
 * Validates independent zero-to-one-hundred strengths without a shared budget.
 *
 * @param {Object} strengths Tag strengths.
 * @param {Array.<string>} allowed Allowed identifiers for this layer.
 *
 * @returns {undefined}
 */
runeos.catalog.TagRegistry.validateStrengths = function(strengths, allowed) {
    if (!strengths || typeof strengths !== "object" || Array.isArray(strengths)) throw Error("Expected tag strengths object");
    Object.keys(strengths).forEach(function(id) {
        var value = strengths[id];
        if (allowed.indexOf(id) < 0) throw Error("Unknown tag in this layer: " + id);
        if (typeof value !== "number" || !isFinite(value) || value < 0 || value > 100) throw Error("Invalid tag strength: " + id);
    });
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Validates a vocabulary, replacing it only when every definition is valid.
 *
 * @param {Object} document Parsed tags document.
 *
 * @returns {Array.<string>} Validation errors.
 */
runeos.catalog.TagRegistry.prototype.replace = function(document) {
    var registry = this;
    var result = runeos.util.Validation.validateRecords(document, "tags", function(tag) {
        registry.m_validateTag(tag);
    });
    this.errors = result.errors;
    if (this.errors.length) return this.errors;
    this.m_publishVocabulary(result.items);
    return this.errors;
};

/**
 * Releases vocabulary definitions and diagnostics.
 *
 * @returns {undefined}
 */
runeos.catalog.TagRegistry.prototype.clear = function() {
    this.items = [];
    this.ids = [];
    this.baseIds = [];
    this.modifierIds = [];
    this.errors = [];
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Validates a vocabulary definition without changing the active vocabulary.
 *
 * @param {Object} tag Tag definition.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.TagRegistry.prototype.m_validateTag = function(tag) {
    if (!/^[a-z][a-z0-9-]*$/.test(tag.id)) throw Error("Invalid tag id");
    runeos.util.Validation.validateText(tag.name, "name");
    if (tag.kind !== undefined && ["base", "modifier"].indexOf(tag.kind) < 0) throw Error("Invalid tag kind");
    if (tag.group !== undefined) runeos.util.Validation.validateText(tag.group, "group");
    if (tag.description !== undefined && typeof tag.description !== "string") throw Error("Invalid tag description");
};

/**
 * Publishes a valid vocabulary and classifies its identifiers in document order.
 *
 * @param {Array.<Object>} items Validated tag definitions.
 *
 * @returns {undefined}
 * @private
 */
runeos.catalog.TagRegistry.prototype.m_publishVocabulary = function(items) {
    this.items = items;
    this.ids = [];
    this.baseIds = [];
    this.modifierIds = [];
    var registry = this;
    items.forEach(function(tag) {
        registry.ids.push(tag.id);
        if (tag.kind === "base") registry.baseIds.push(tag.id);
        else registry.modifierIds.push(tag.id);
    });
};
