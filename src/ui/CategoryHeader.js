//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new CategoryHeader instance.
 *
 * @constructor
 * @extends runeos.display.DisplayObjectContainer
 *
 * @param {Object} [options] Dimensions and optional visual settings.
 *
 * @class
 * @classdesc
 *
 * A fixed selector header displaying the category title, game count, description
 * and page position. The parent supplies content and local bounds; this component owns its labels
 * and layout.
 */
runeos.ui.CategoryHeader = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};
    var settings = runeos.system.Config.getGroup("selector", options.config);
    var text = runeos.system.Config.getGroup("text", options.textConfig);
    var minimumHeight = runeos.text.Typography.getHeight("title", text) + runeos.text.Typography.getHeight("detail", text) + runeos.ui.CategoryHeader.DESCRIPTION_GAP + runeos.ui.CategoryHeader.VERTICAL_PADDING;

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    /**
     * Extends runeos.display.DisplayObjectContainer.
     */
    runeos.display.DisplayObjectContainer.call(this, 0, 0,
        options.width === undefined ? runeos.ui.CategoryHeader.DEFAULT_WIDTH : options.width,
        options.height === undefined ? Math.max(settings.menuBarHeightPx, minimumHeight) : options.height);

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable text settings for this component.
     *
     * @type {Object}
     * @private
     */
    this.m_textConfig = text;

    /**
     * Available horizontal space supplied by the parent.
     *
     * @type {Object}
     * @private
     */
    this.m_contentBounds = {
        left: 0,
        width: this.width
    };

    /**
     * Dimensions used by the latest layout.
     *
     * @type {Object}
     * @private
     */
    this.m_layoutSize = {
        width: this.width,
        height: this.height
    };

    /**
     * Title field supporting long tilemap names.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_titleField = null;

    /**
     * Fixed game-count label beside the category title.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_countField = null;

    /**
     * Subtle page indicator aligned to the content span's right edge.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_positionField = null;

    /**
     * Subtle category description aligned with the title.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_descriptionField = null;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Constructs the labels owned by this category header.
     */
    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.ui.CategoryHeader.prototype = Object.create(runeos.display.DisplayObjectContainer.prototype);
runeos.ui.CategoryHeader.prototype.constructor = runeos.ui.CategoryHeader;

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Default width for a standalone header.
 *
 * @constant {number}
 */
runeos.ui.CategoryHeader.DEFAULT_WIDTH = 1280;

/**
 * Space reserved around the header labels.
 *
 * @constant {number}
 */
runeos.ui.CategoryHeader.VERTICAL_PADDING = 10;

/**
 * Space separating the heading labels.
 *
 * @constant {number}
 */
runeos.ui.CategoryHeader.LABEL_GAP = 12;

/**
 * Extra width preserving the edge of measured glyphs.
 *
 * @constant {number}
 */
runeos.ui.CategoryHeader.TEXT_PADDING = 4;

/**
 * Top inset when the description is visible.
 *
 * @constant {number}
 */
runeos.ui.CategoryHeader.TOP_PADDING = 4;

/**
 * Space between the category heading and its description.
 *
 * @constant {number}
 */
runeos.ui.CategoryHeader.DESCRIPTION_GAP = 4;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Text field showing the active group name.
 *
 * @member {runeos.text.TextField} titleField
 * @memberof runeos.ui.CategoryHeader
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.CategoryHeader.prototype, "titleField", {
    /**
     * @this runeos.ui.CategoryHeader
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_titleField;
    }
});

/**
 * Count of games in the current category.
 *
 * @member {runeos.text.TextField} countField
 * @memberof runeos.ui.CategoryHeader
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.CategoryHeader.prototype, "countField", {
    /**
     * @this runeos.ui.CategoryHeader
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_countField;
    }
});

/**
 * Position indicator for the active tilemap.
 *
 * @member {runeos.text.TextField} positionField
 * @memberof runeos.ui.CategoryHeader
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.CategoryHeader.prototype, "positionField", {
    /**
     * @this runeos.ui.CategoryHeader
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_positionField;
    }
});

/**
 * Text field showing the selected category description.
 *
 * @member {runeos.text.TextField} descriptionField
 * @memberof runeos.ui.CategoryHeader
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.CategoryHeader.prototype, "descriptionField", {
    /**
     * @this runeos.ui.CategoryHeader
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_descriptionField;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Sets the category information without depending on a navigation source.
 *
 * @param {string} name Category title.
 * @param {string} description Optional description.
 * @param {number} index Zero-based category index.
 * @param {number} total Number of categories.
 * @param {number} [gameCount] Number of displayed games.
 *
 * @returns {undefined}
 */
runeos.ui.CategoryHeader.prototype.setCategory = function(name, description, index, total, gameCount) {
    var title = name || "";
    var detail = description || "";
    var count = title && typeof gameCount === "number" ? "( " + gameCount + (gameCount === 1 ? " game )" : " games )") : "";
    var position = total > 0 ? (index + 1) + " of " + total : "";
    if (this.m_titleField.text === title && this.m_descriptionField.text === detail && this.m_positionField.text === position && this.m_countField.text === count) return;
    this.m_titleField.text = title;
    this.m_countField.text = count;
    this.m_countField.visible = !!count;
    this.m_descriptionField.text = detail;
    this.m_descriptionField.visible = !!detail;
    this.m_positionField.text = position;
    this.m_updateLayout();
};

/**
 * Sets the content span in local coordinates.
 *
 * @param {number} left Left edge in pixels.
 * @param {number} width Available width in pixels.
 *
 * @returns {undefined}
 */
runeos.ui.CategoryHeader.prototype.setContentBounds = function(left, width) {
    if (this.m_contentBounds.left === left && this.m_contentBounds.width === width) return;
    this.m_contentBounds.left = left;
    this.m_contentBounds.width = width;
    this.m_updateLayout();
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Updates layout after resizing and advances the owned text fields.
 *
 * @param {number} step Current time step in milliseconds.
 *
 * @returns {undefined}
 */
runeos.ui.CategoryHeader.prototype.update = function(step) {
    if (this.width !== this.m_layoutSize.width || this.height !== this.m_layoutSize.height) this.m_updateLayout();
    runeos.display.DisplayObjectContainer.prototype.update.call(this, step);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Runs the initialization steps owned by this instance.
 *
 * @param {Object} options Constructor settings.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.CategoryHeader.prototype.m_construct = function(options) {
    this.backgroundColor = options.backgroundColor || "";
    this.m_constructTitle();
    this.m_constructCount();
    this.m_constructPosition();
    this.m_constructDescription();
    this.m_updateLayout();
};

/**
 * Creates the title label.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.CategoryHeader.prototype.m_constructTitle = function() {
    this.m_titleField = new runeos.text.TextField({
        config: this.m_textConfig,
        role: "title"
    });
    this.addChild(this.m_titleField);
};

/**
 * Creates the secondary count label using the body family for punctuation.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.CategoryHeader.prototype.m_constructCount = function() {
    this.m_countField = new runeos.text.TextField({
        config: this.m_textConfig,
        role: "count"
    });
    this.m_countField.visible = false;
    this.addChild(this.m_countField);
};

/**
 * Creates the position label.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.CategoryHeader.prototype.m_constructPosition = function() {
    this.m_positionField = new runeos.text.TextField({
        config: this.m_textConfig,
        role: "position"
    });
    this.addChild(this.m_positionField);
};

/**
 * Creates the description label.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.CategoryHeader.prototype.m_constructDescription = function() {
    this.m_descriptionField = new runeos.text.TextField({
        config: this.m_textConfig,
        role: "detail"
    });
    this.m_descriptionField.visible = false;
    this.addChild(this.m_descriptionField);
};

/**
 * Fits the labels within the supplied content span.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.CategoryHeader.prototype.m_updateLayout = function() {
    var left = Math.max(0, Math.min(this.width, this.m_contentBounds.left));
    var available = Math.max(0, Math.min(this.m_contentBounds.width, this.width - left));
    this.m_layoutHeading(left, available);
    this.m_layoutDescription(left, available);
    this.m_layoutSize.width = this.width;
    this.m_layoutSize.height = this.height;
};

/**
 * Places the heading, fixed count and right-aligned page indicator.
 *
 * @param {number} left Content left edge.
 * @param {number} available Available content width.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.CategoryHeader.prototype.m_layoutHeading = function(left, available) {
    var title = this.m_titleField;
    var count = this.m_countField;
    var position = this.m_positionField;
    var gap = Math.min(runeos.ui.CategoryHeader.LABEL_GAP, available);
    position.width = Math.min(available, Math.ceil(position["textWidth"]) + runeos.ui.CategoryHeader.TEXT_PADDING);
    var remaining = Math.max(0, available - position.width - (position.text ? gap : 0));
    count.width = count.visible ? Math.min(remaining, Math.ceil(count["textWidth"]) + runeos.ui.CategoryHeader.TEXT_PADDING) : 0;
    var countGap = count.visible ? Math.min(gap, remaining - count.width) : 0;
    title.width = Math.min(Math.ceil(title["textWidth"]) + runeos.ui.CategoryHeader.TEXT_PADDING, Math.max(0, remaining - count.width - countGap));
    title.x = left;
    title.y = this.m_descriptionField.visible ? runeos.ui.CategoryHeader.TOP_PADDING : (this.height - title.height) / 2;
    count.x = left + title.width + countGap;
    count.y = title.y + (title.height - count.height) / 2;
    position.x = left + available - position.width;
    position.y = title.y + (title.height - position.height) / 2;
};

/**
 * Places the description below the heading.
 *
 * @param {number} left Content left edge.
 * @param {number} available Available content width.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.CategoryHeader.prototype.m_layoutDescription = function(left, available) {
    this.m_descriptionField.x = left;
    this.m_descriptionField.y = this.m_titleField.y + this.m_titleField.height + runeos.ui.CategoryHeader.DESCRIPTION_GAP;
    this.m_descriptionField.width = available;
};

