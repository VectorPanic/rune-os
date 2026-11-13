//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new TileLabels instance.
 *
 * @constructor
 *
 * @param {Object} [options] Label layout and typography settings.
 *
 * @class
 * @classdesc
 *
 * Owns card text, layout, reading pauses, detail fades and contrast backdrops.
 * Receives presentation values without retaining a Tile or loading its artwork.
 * Draws into a supplied Canvas, avoiding an extra full-card pixel buffer.
 */
runeos.ui.tilemap.TileLabels = function(options) {
    options = options || {};
    var resolved = runeos.ui.tilemap.TilemapOptions.resolve(options, "tiles");

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Ready-to-display primary title.
     *
     * @type {string}
     */
    this.title = "";

    /**
     * Ready-to-display secondary line above the title.
     *
     * @type {string}
     */
    this.subtitle = "";

    /**
     * Ready-to-display supporting description.
     *
     * @type {string}
     */
    this.description = "";

    /**
     * Ready-to-display metadata line below the title.
     *
     * @type {string}
     */
    this.metadataText = "";

    /**
     * Ready-to-display badge; an empty string hides it.
     *
     * @type {string}
     */
    this.badgeText = "";

    /**
     * Whether this card is selected.
     *
     * @type {boolean}
     */
    this.selected = false;

    /**
     * Destination width in logical pixels.
     *
     * @type {number}
     */
    this.width = 0;

    /**
     * Destination height in logical pixels.
     *
     * @type {number}
     */
    this.height = 0;

    /**
     * Plain card background used for contrast.
     *
     * @type {string}
     */
    this.backgroundColor = "";

    /**
     * Opacity of visible artwork, or zero without artwork.
     *
     * @type {number}
     */
    this.imageOpacity = 0;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable label-layout settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = resolved.tiles;

    /**
     * Immutable typography settings.
     *
     * @type {Object}
     * @private
     */
    this.m_textConfig = resolved.text;

    /**
     * Scrolling title field owned by this label group.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_titleField = null;

    /**
     * Background color last used to calculate label contrast.
     *
     * @type {?string}
     * @private
     */
    this.m_contrastBackground = null;

    /**
     * Metadata line shown only on the selected Tile.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_metadataField = null;

    /**
     * Secondary line above the selected title.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_subtitleField = null;

    /**
     * Elapsed focus time for the delayed detail reveal, in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_detailElapsed = 0;

    /**
     * Focus state observed by the title scroll lifecycle.
     *
     * @type {boolean}
     * @private
     */
    this.m_titleFocused = false;

    /**
     * Optional badge label, visible independently of focus.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_badgeField = null;

    /**
     * Supporting description, visible only on the selected Tile.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_descriptionField = null;

    /**
     * Cached contrast color for the plain Tile background.
     *
     * @type {string}
     * @private
     */
    this.m_backgroundTextColor = "#ffffff";

    /**
     * Gradient cached by drawing context and label-area dimensions.
     *
     * @type {Object}
     * @private
     */
    this.m_labelGradient = null;

    /**
     * Cached icon-contrast state for label shadow updates.
     *
     * @type {?boolean}
     * @private
     */
    this.m_textOverImage = null;

    /**
     * Owned fields in draw/update order.
     *
     * @type {Array.<runeos.text.TextField>}
     * @private
     */
    this.m_fields = [];

    /**
     * Permanent resource-release flag.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Constructs fields and initializes label presentation.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Title and its reading settings.
 *
 * @member {runeos.text.TextField} nameField
 * @memberof runeos.ui.tilemap.TileLabels
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.TileLabels.prototype, "nameField", {
    /**
     * @this runeos.ui.tilemap.TileLabels
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_titleField;
    }
});

/**
 * Ready-to-display metadata line.
 *
 * @member {runeos.text.TextField} metadataField
 * @memberof runeos.ui.tilemap.TileLabels
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.TileLabels.prototype, "metadataField", {
    /**
     * @this runeos.ui.tilemap.TileLabels
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_metadataField;
    }
});

/**
 * Subtitle field exposed through the existing studioField accessor.
 *
 * @member {runeos.text.TextField} studioField
 * @memberof runeos.ui.tilemap.TileLabels
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.TileLabels.prototype, "studioField", {
    /**
     * @this runeos.ui.tilemap.TileLabels
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_subtitleField;
    }
});

/**
 * Description field exposed through the existing reasonField accessor.
 *
 * @member {runeos.text.TextField} reasonField
 * @memberof runeos.ui.tilemap.TileLabels
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.TileLabels.prototype, "reasonField", {
    /**
     * @this runeos.ui.tilemap.TileLabels
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_descriptionField;
    }
});

/**
 * Badge field exposed through the existing stageField accessor.
 *
 * @member {runeos.text.TextField} stageField
 * @memberof runeos.ui.tilemap.TileLabels
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.tilemap.TileLabels.prototype, "stageField", {
    /**
     * @this runeos.ui.tilemap.TileLabels
     * @returns {runeos.text.TextField}
     * @ignore
     */
    get : function() {
        return this.m_badgeField;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Refreshes content, layout and contrast without advancing reading animations.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TileLabels.prototype.refresh = function() {
    if (this.m_disposed) return;
    this.m_updateTextContrast();
    this.m_metadataField.text = this.metadataText;
    this.m_subtitleField.text = this.subtitle;
    var padding = this.m_config.labelPaddingPx;
    var width = Math.max(0, this.width - 2 * padding);
    var bottom = this.height - this.m_config.metadataBottomPaddingPx;
    this.m_updateDescription(padding, width, bottom);
    this.m_updateLayout(padding, width, bottom);
    this.m_updateBadge(padding);
};

/**
 * Advances each owned label exactly once for the supplied frame.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TileLabels.prototype.update = function(step) {
    if (this.m_disposed) return;
    this.refresh();
    this.m_updateTitleFocus();
    this.m_updateDetails(step);
    for (var i = 0; i < this.m_fields.length; i++) this.m_fields[i].update(step);
};

/**
 * Draws label backdrops and fields into the supplied card buffer.
 *
 * @param {runeos.display.Canvas} canvas Destination canvas wrapper.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TileLabels.prototype.render = function(canvas) {
    if (this.m_disposed) return;
    this.refresh();
    this.m_renderLabelBackdrop(canvas["context"]);
    this.m_renderBadgeBackground(canvas["context"]);
    for (var i = 0; i < this.m_fields.length; i++) canvas.renderDisplayObject(this.m_fields[i]);
};

/**
 * Releases all text buffers and cached paints.
 *
 * @returns {undefined}
 */
runeos.ui.tilemap.TileLabels.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    for (var i = 0; i < this.m_fields.length; i++) this.m_fields[i].dispose();
    this.m_fields = [];
    this.m_labelGradient = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Builds the fields and initializes hidden supporting information.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_construct = function() {
    this.m_constructFields();
    this.m_updateDetails(0);
    this.refresh();
};

/**
 * Creates each field with role-specific reading behavior.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_constructFields = function() {
    this.m_titleField = this.m_createField("game", {text: this.title});
    this.m_metadataField = this.m_createField("metadata");
    this.m_subtitleField = this.m_createField("studio");
    this.m_descriptionField = this.m_createField("reason");
    this.m_badgeField = this.m_createField("stage");
    this.m_fields = [this.m_titleField, this.m_metadataField, this.m_subtitleField, this.m_descriptionField, this.m_badgeField];
};

/**
 * Creates a field using shared role defaults and optional local overrides.
 *
 * @param {string} role Font role.
 * @param {Object} [options] Field-specific settings.
 *
 * @returns {runeos.text.TextField} Owned text field.
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_createField = function(role, options) {
    options = options || {};
    options.config = this.m_textConfig;
    options.role = role;
    return new runeos.text.TextField(options);
};

/**
 * Shows a supplied badge independently of selection and follows Tile dimensions.
 *
 * @param {number} padding Shared label margin.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_updateBadge = function(padding) {
    var field = this.m_badgeField;
    var inset = padding + this.m_config.stagePaddingPx;
    field.text = this.badgeText;
    field.visible = field.text.length > 0;
    field.color = this.m_config.labelAccentColor;
    field.y = inset;
    field.x = inset;
    field.width = Math.max(0, Math.min(Math.ceil(field["textWidth"]), this.width - 2 * inset));
};

/**
 * Aligns the title, metadata and subtitle around the optional description.
 *
 * @param {number} padding Shared label margin.
 * @param {number} width Shared available text width.
 * @param {number} bottom Shared lower metadata boundary.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_updateLayout = function(padding, width, bottom) {
    var footer = this.m_descriptionField.visible ? this.m_descriptionField.height + this.m_config.labelGapPx : 0;
    this.m_metadataField.visible = this.selected && this.m_metadataField.text.length > 0;
    this.m_metadataField.color = this.m_titleField.color;
    this.m_metadataField.x = padding;
    this.m_metadataField.y = bottom - this.m_metadataField.height - footer;
    this.m_metadataField.width = width;
    this.m_titleField.visible = this.selected;
    this.m_titleField.text = this.title;
    this.m_titleField.x = padding;
    this.m_titleField.y = this.m_metadataField.text.length > 0 ?
        this.m_metadataField.y - this.m_config.labelGapPx - this.m_titleField.height :
        this.height - this.m_config.titleBottomPaddingPx - this.m_titleField.height - footer;
    this.m_titleField.width = width;
    this.m_subtitleField.visible = this.selected && this.m_subtitleField.text.length > 0;
    this.m_subtitleField.color = this.m_getAccentColor();
    this.m_subtitleField.x = padding;
    this.m_subtitleField.y = this.m_titleField.y - this.m_config.labelGapPx - this.m_subtitleField.height;
    this.m_subtitleField.width = width;
};

/**
 * Restarts the title reading pause whenever this Tile gains focus.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_updateTitleFocus = function() {
    if (this.selected && !this.m_titleFocused) this.m_titleField.restartScroll();
    this.m_titleFocused = this.selected;
};

/**
 * Reveals supporting labels after focus settles and resets them on departure.
 * Layout remains stable while the labels are transparent.
 *
 * @param {number} step Current time step in milliseconds.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_updateDetails = function(step) {
    this.m_detailElapsed = this.selected ? this.m_detailElapsed + Math.max(0, step) : 0;
    var elapsed = this.m_detailElapsed - this.m_textConfig.detailDelayMs;
    var duration = this.m_textConfig.detailFadeInMs;
    var opacity = this.selected && elapsed >= 0 ? (duration > 0 ? Math.min(1, elapsed / duration) : 1) : 0;
    this.m_subtitleField.alpha = this.m_subtitleField["style"].alpha * opacity;
    this.m_metadataField.alpha = this.m_metadataField["style"].alpha * opacity;
    this.m_descriptionField.alpha = this.m_descriptionField["style"].alpha * opacity;
};

/**
 * Fits the supporting description beneath the metadata line.
 *
 * @param {number} padding Shared label margin.
 * @param {number} width Shared available text width.
 * @param {number} bottom Shared lower metadata boundary.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_updateDescription = function(padding, width, bottom) {
    var field = this.m_descriptionField;
    field.text = this.description;
    field.visible = this.selected && !!this.description;
    field.color = this.m_titleField.color;
    field.x = padding;
    field.y = bottom - field.height;
    field.width = width;
};

/**
 * Recalculates text contrast only when the Tile background changes.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_updateTextContrast = function() {
    if (this.m_contrastBackground !== this.backgroundColor) {
        this.m_contrastBackground = this.backgroundColor;
        var brightness = runeos.util.Color.getBrightness(this.backgroundColor);
        this.m_backgroundTextColor = brightness > this.m_textConfig.brightnessThreshold ? "#000000" : "#ffffff";
    }
    var overImage = this.m_hasVisibleImage();
    this.m_titleField.color = overImage ? this.m_config.labelImageTextColor : this.m_backgroundTextColor;
    this.m_updateTextShadows(overImage);
};

/**
 * Chooses a readable accent for secondary labels over icons.
 *
 * @returns {string} Accent or plain-background contrast color.
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_getAccentColor = function() {
    return this.m_hasVisibleImage() ? this.m_config.labelAccentColor : this.m_titleField.color;
};

/**
 * Tests whether decoded icon pixels are currently visible.
 *
 * @returns {boolean} Whether labels are drawn over an icon.
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_hasVisibleImage = function() {
    return this.imageOpacity > 0;
};

/**
 * Applies the same optional shadow to all owned labels.
 *
 * @param {boolean} enabled Whether icon contrast support is needed.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_updateTextShadows = function(enabled) {
    if (this.m_textOverImage === enabled) return;
    this.m_textOverImage = enabled;
    var fields = this.m_fields;
    for (var i = 0; i < fields.length; i++) {
        if (!fields[i]) continue;
        fields[i].shadowColor = enabled ? this.m_config.labelShadowColor : "transparent";
        fields[i].shadowBlur = enabled ? this.m_config.labelShadowBlurPx : 0;
        fields[i].shadowOffsetY = enabled ? this.m_config.labelShadowOffsetYPx : 0;
    }
};

/**
 * Draws a compact padded background behind the supplied badge.
 *
 * @param {CanvasRenderingContext2D} context Destination drawing context.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_renderBadgeBackground = function(context) {
    if (!this.m_badgeField.visible) return;
    var field = this.m_badgeField;
    var padding = this.m_config.stagePaddingPx;
    context.save();
    try {
        context.fillStyle = this.m_config.stageBackgroundColor;
        context.fillRect(field.x - padding, field.y - padding, field.width + padding * 2, field.height + padding * 2);
    } finally {
        context.restore();
    }
};

/**
 * Draws cached shading behind the selected icon's label area.
 *
 * @param {CanvasRenderingContext2D} context Destination drawing context.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_renderLabelBackdrop = function(context) {
    if (!this.selected || !this.m_hasVisibleImage() || this.m_config.labelGradientOpacity === 0) return;
    var label = this.m_subtitleField.visible ? this.m_subtitleField : this.m_titleField;
    var top = Math.max(0, label.y - this.m_config.labelGradientPaddingPx);
    var gradient = this.m_getLabelGradient(context, top);
    context.save();
    try {
        context.globalAlpha *= this.imageOpacity;
        context.fillStyle = gradient;
        context.fillRect(0, top, this.width, this.height - top);
    } finally {
        context.restore();
    }
};

/**
 * Reuses the label gradient until its context or drawing bounds change.
 *
 * @param {CanvasRenderingContext2D} context Tile drawing context.
 * @param {number} top Gradient start position.
 *
 * @returns {CanvasGradient} Cached gradient paint.
 * @private
 */
runeos.ui.tilemap.TileLabels.prototype.m_getLabelGradient = function(context, top) {
    var cached = this.m_labelGradient;
    if (!cached || cached.context !== context || cached.width !== this.width || cached.height !== this.height || cached.top !== top) {
        var gradient = context.createLinearGradient(0, top, 0, this.height);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0," + this.m_config.labelGradientOpacity + ")");
        cached = {
            context: context,
            width: this.width,
            height: this.height,
            top: top,
            paint: gradient
        };
        this.m_labelGradient = cached;
    }
    return cached.paint;
};

