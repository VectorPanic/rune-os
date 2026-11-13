//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a message overlay without taking input or controlling the game.
 *
 * @constructor
 * @param {Object} config Explicit notification appearance settings.
 * @param {number} bodySize Logical body font size.
 *
 * @class
 * @classdesc
 * Owns readable message rendering and restores covered pixels on paused frames.
 */
runeos.ui.GameMessage = function(config, bodySize) {
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Borrowed notification appearance settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = config;

    /**
     * Logical body font size.
     *
     * @type {number}
     * @private
     */
    this.m_bodySize = bodySize;

    /**
     * Message retained while the viewport changes.
     *
     * @type {string}
     * @private
     */
    this.m_text = "";

    /**
     * Owned message presentation.
     *
     * @type {runeos.ui.Notification}
     * @private
     */
    this.m_note = null;

    /**
     * Saved pixels beneath the message.
     *
     * @type {runeos.display.CanvasRegion}
     * @private
     */
    this.m_region = null;

    /**
     * Latest physical-to-logical scale.
     *
     * @type {number}
     * @private
     */
    this.m_scale = 0;

};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether a message owns display resources.
 *
 * @member {boolean} visible
 * @memberof runeos.ui.GameMessage
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.GameMessage.prototype, "visible", {
    /**
     * @this runeos.ui.GameMessage
     * @returns {boolean}
     * @ignore
     */
    get: function() { return this.m_note !== null; }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Replaces text without restarting an unchanged message.
 *
 * @param {string} message Readable game instruction.
 *
 * @returns {undefined}
 */
runeos.ui.GameMessage.prototype.show = function(message) {
    if (message === this.m_text) return;
    this.m_text = message;
    if (this.m_note) this.m_note.show(message, {persistent: true});
};

/**
 * Restores game pixels before drawing or removing another overlay.
 *
 * @returns {undefined}
 */
runeos.ui.GameMessage.prototype.restore = function() {
    if (this.m_region) this.m_region.restore();
};

/**
 * Draws the message at a readable physical font size without consuming input.
 *
 * @param {runeos.display.Canvas} canvas Shared game output.
 * @param {number} [opacity=1] Message opacity multiplier.
 *
 * @returns {undefined}
 */
runeos.ui.GameMessage.prototype.render = function(canvas, opacity) {
    if (!this.m_text || canvas.width <= 0 || canvas.height <= 0) return;
    var scale = canvas.height / runeos.display.Screen.DEFAULT_HEIGHT;
    if (!this.m_note || this.m_scale !== scale) this.m_construct(canvas, scale);
    var note = this.m_note;
    note.setViewport(canvas.width / scale, runeos.display.Screen.DEFAULT_HEIGHT, canvas);
    note.alpha = this.m_config.backgroundOpacity * (opacity === undefined ? 1 : opacity);
    if (!this.m_region.capture(canvas, {
        x: note.x * scale - 1, y: note.y * scale - 1,
        width: note.width * scale + 2, height: note.height * scale + 2
    })) return;
    var context = canvas["context"];
    context.save();
    try {
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
        context.filter = "none";
        context.shadowColor = "transparent";
        context.shadowBlur = 0;
        note.drawTo(canvas);
    } finally {
        context.restore();
    }
};

/**
 * Restores covered pixels and releases the owned message resources.
 *
 * @returns {undefined}
 */
runeos.ui.GameMessage.prototype.dispose = function() {
    if (this.m_region) this.m_region.dispose();
    if (this.m_note) this.m_note.dispose();
    this.m_region = null;
    this.m_note = null;
    this.m_text = "";
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Constructs a readable notification for the current resolution.
 *
 * @param {runeos.display.Canvas} canvas Shared output.
 * @param {number} scale Physical pixels per logical OS pixel.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.GameMessage.prototype.m_construct = function(canvas, scale) {
    if (this.m_region) this.m_region.dispose();
    if (this.m_note) this.m_note.dispose();
    this.m_scale = scale;
    this.m_region = new runeos.display.CanvasRegion();
    this.m_note = new runeos.ui.Notification({
        width: canvas.width / scale, height: runeos.display.Screen.DEFAULT_HEIGHT,
        textConfig: {bodySizePx: Math.max(this.m_bodySize, 12 / scale)},
        config: {
            maxWidthPx: 1100, fadeInMs: 0, fadeOutMs: 0,
            backgroundColor: this.m_config.backgroundColor, textColor: this.m_config.textColor,
            paddingPx: this.m_config.paddingPx, marginPx: this.m_config.marginPx
        }
    });
    this.m_note.show(this.m_text, {persistent: true, canvas: canvas});
};
