//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Notification instance.
 *
 * @constructor
 * @extends runeos.display.DisplayObjectContainer
 *
 * @param {Object} [options] Viewport dimensions and visual settings.
 *
 * @class
 * @classdesc
 *
 * A temporary message above the viewport's lower edge. It owns its text and
 * fade animations, without input handlers, timers or scene dependencies.
 */
runeos.ui.Notification = function(options) {
    options = options || {};

    //--------------------------------------------------------------------------
    // Super call
    //--------------------------------------------------------------------------

    runeos.display.DisplayObjectContainer.call(this, 0, 0, 0, 0);

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable notification settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("notifications", options.config);

    /**
     * Shared typography settings.
     *
     * @type {Object}
     * @private
     */
    this.m_textConfig = runeos.system.Config.getGroup("text", options.textConfig);

    /**
     * Parent-local viewport dimensions.
     *
     * @type {Object}
     * @private
     */
    this.m_viewport = {
        width: options.width === undefined ? 1280 : options.width,
        height: options.height === undefined ? 720 : options.height
    };

    /**
     * Horizontal message placement within the viewport.
     *
     * @type {string}
     * @private
     */
    this.m_alignment = options.align === "left" ? "left" : "center";


    /**
     * Original message, independent of the current line breaks.
     *
     * @type {string}
     * @private
     */
    this.m_message = "";

    /**
     * Owned text fields, one per displayed line.
     *
     * @type {!Array.<!runeos.text.TextField>}
     * @private
     */
    this.m_lines = [];

    /**
     * Fade animations owned only by this component.
     *
     * @type {runeos.tween.Tweens}
     * @private
     */
    this.m_tweens = new runeos.tween.Tweens();

    /**
     * Current phase: hidden, wait, in, hold or out.
     *
     * @type {string}
     * @private
     */
    this.m_phase = "hidden";

    /**
     * Remaining fully-visible time in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_remaining = 0;

    /**
     * Delay before revealing the message, in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_delay = 0;

    /**
     * Whether the message remains until explicitly hidden.
     *
     * @type {boolean}
     * @private
     */
    this.m_persistent = false;

    /**
     * Permanent teardown flag.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Initializes the background and hidden state.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.ui.Notification.prototype = Object.create(runeos.display.DisplayObjectContainer.prototype);
runeos.ui.Notification.prototype.constructor = runeos.ui.Notification;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Currently displayed message.
 *
 * @member {string} message
 * @memberof runeos.ui.Notification
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.Notification.prototype, "message", {
    /**
     * @this runeos.ui.Notification
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_message;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Replaces the current message and restarts its display interval.
 *
 * @param {string} message Short user-facing text.
 * @param {Object} [options] Optional delayMs, persistent mode and shared measurement canvas.
 *
 * @returns {undefined}
 */
runeos.ui.Notification.prototype.show = function(message, options) {
    if (this.m_disposed) return;
    this.hide();
    if (typeof message !== "string" || !message.trim()) return;
    this.m_message = message;
    options = options || {};
    this.m_updateLayout(options.canvas);
    this.m_persistent = options.persistent === true;
    this.m_delay = Math.max(0, options.delayMs || 0);
    if (this.m_delay > 0) this.m_phase = "wait";
    else {
        this.visible = true;
        this.m_fadeIn();
    }
};

/**
 * Hides the message immediately and cancels its animations.
 *
 * @returns {undefined}
 */
runeos.ui.Notification.prototype.hide = function() {
    this.m_tweens.clear();
    this.m_phase = "hidden";
    this.m_remaining = 0;
    this.m_delay = 0;
    this.m_persistent = false;
    this.visible = false;
    this.alpha = 0;
};

/**
 * Updates viewport dimensions using optional shared-canvas text measurement.
 *
 * @param {number} width Logical viewport width.
 * @param {number} height Logical viewport height.
 * @param {runeos.display.Canvas} [canvas] Borrowed measurement destination.
 *
 * @returns {undefined}
 */
runeos.ui.Notification.prototype.setViewport = function(width, height, canvas) {
    if (this.m_viewport.width === width && this.m_viewport.height === height) return;
    this.m_viewport.width = width;
    this.m_viewport.height = height;
    this.m_updateLayout(canvas);
};

/**
 * Draws a message into shared output without allocating notification buffers.
 * The caller controls transforms and restores covered game pixels when needed.
 *
 * @param {runeos.display.Canvas} canvas Borrowed destination.
 *
 * @returns {undefined}
 */
runeos.ui.Notification.prototype.drawTo = function(canvas) {
    if (this.m_disposed || !this.visible || this.alpha <= 0) return;
    var context = canvas["context"];
    context.save();
    try {
        context.globalAlpha *= this.alpha;
        context.fillStyle = this.backgroundColor;
        context.fillRect(this.x, this.y, this.width, this.height);
        for (var i = 0; i < this.m_lines.length; i++) {
            this.m_lines[i].drawTo(canvas, this.x, this.y);
        }
    } finally {
        context.restore();
    }
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Advances the fade and readable hold interval without taking input focus.
 *
 * @param {number} step Elapsed time in milliseconds.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.Notification.prototype.update = function(step) {
    if (this.m_disposed) return;
    if (this.m_phase === "wait") {
        if (typeof step !== "number" || !isFinite(step) || step <= 0) return;
        this.m_delay -= step;
        if (this.m_delay > 0) return;
        step = -this.m_delay;
        this.visible = true;
        this.m_fadeIn();
    }
    if (!this.visible) return;
    var holding = this.m_phase === "hold";
    this.m_tweens.update(step);
    if (holding && !this.m_persistent && typeof step === "number" && isFinite(step) && step > 0) {
        this.m_remaining = Math.max(0, this.m_remaining - step);
        if (this.m_remaining === 0) this.m_fadeOut();
    }
    runeos.display.DisplayObjectContainer.prototype.update.call(this, step);
};

/**
 * Releases animations and the owned text fields once.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.Notification.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.hide();
    this.m_disposed = true;
    this.m_tweens.dispose();
    runeos.display.DisplayObjectContainer.prototype.dispose.call(this);
    this.m_lines.length = 0;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Initializes the background presentation.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.Notification.prototype.m_construct = function() {
    this.backgroundColor = this.m_config.backgroundColor;
    this.hide();
};

/**
 * Fits the message inside the viewport and applies its horizontal alignment.
 *
 * @param {runeos.display.Canvas} [canvas] Borrowed measurement destination.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.Notification.prototype.m_updateLayout = function(canvas) {
    var padding = this.m_config.paddingPx;
    var margin = this.m_config.marginPx;
    var maxWidth = Math.max(0, Math.min(this.m_config.maxWidthPx, this.m_viewport.width - margin * 2));
    var contentWidth = Math.max(0, maxWidth - padding * 2);
    var layout = this.m_measureLines(contentWidth, canvas);
    this.width = Math.min(maxWidth, Math.ceil(layout.width) + padding * 2);
    this.height = this.m_layoutLineFields(layout.lines, Math.max(0, this.width - padding * 2));
    this.x = this.m_alignment === "left" ? margin : (this.m_viewport.width - this.width) / 2;
    this.y = Math.max(0, this.m_viewport.height - margin - this.height);
};

/**
 * Measures wrapped lines with the same font used for drawing.
 *
 * @param {number} width Available text width.
 * @param {runeos.display.Canvas} [canvas] Borrowed measurement destination.
 * @returns {{lines: !Array.<string>, width: number}}
 * @private
 */
runeos.ui.Notification.prototype.m_measureLines = function(width, canvas) {
    if (!this.m_message || width <= 0) return {lines: [], width: 0};
    var field = this.m_getLineField(0);
    var context = (canvas || field["canvas"])["context"];
    context.save();
    try {
        context.font = field.font;
        var lines = [];
        var paragraphs = this.m_message.split(/\r\n?|\n/);
        for (var i = 0; i < paragraphs.length; i++) {
            this.m_wrapParagraph(paragraphs[i], width, context, lines);
        }
        var widest = 0;
        for (var j = 0; j < lines.length; j++) {
            widest = Math.max(widest, context.measureText(lines[j]).width);
        }
        return {lines: lines, width: widest};
    } finally {
        context.restore();
    }
};

/**
 * Wraps a paragraph at word boundaries and splits words wider than a line.
 *
 * @param {string} paragraph Text between explicit line breaks.
 * @param {number} width Available text width.
 * @param {CanvasRenderingContext2D} context Measurement context with the line font.
 * @param {!Array.<string>} lines Destination for wrapped lines.
 * @returns {undefined}
 * @private
 */
runeos.ui.Notification.prototype.m_wrapParagraph = function(paragraph, width, context, lines) {
    if (context.measureText(paragraph).width <= width) {
        lines.push(paragraph);
        return;
    }
    var words = paragraph.match(/\S+/g) || [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
        var word = words[i];
        var candidate = line ? line + " " + word : word;
        if (context.measureText(candidate).width <= width) {
            line = candidate;
            continue;
        }
        if (line) lines.push(line);
        line = this.m_splitWord(word, width, context, lines);
    }
    lines.push(line);
};

/**
 * Emits complete fragments of a long word and returns its final fragment.
 *
 * @param {string} word Word to fit.
 * @param {number} width Available text width.
 * @param {CanvasRenderingContext2D} context Measurement context with the line font.
 * @param {!Array.<string>} lines Destination for complete fragments.
 * @returns {string}
 * @private
 */
runeos.ui.Notification.prototype.m_splitWord = function(word, width, context, lines) {
    if (context.measureText(word).width <= width) return word;
    var characters = Array.from(word);
    var line = "";
    for (var i = 0; i < characters.length; i++) {
        var candidate = line + characters[i];
        if (line && context.measureText(candidate).width > width) {
            lines.push(line);
            line = characters[i];
        } else {
            line = candidate;
        }
    }
    return line;
};

/**
 * Positions one field per line and returns the padded box height.
 *
 * @param {!Array.<string>} lines Wrapped message.
 * @param {number} width Text field width.
 * @returns {number}
 * @private
 */
runeos.ui.Notification.prototype.m_layoutLineFields = function(lines, width) {
    var padding = this.m_config.paddingPx;
    var y = padding;
    for (var i = 0; i < lines.length; i++) {
        var field = this.m_getLineField(i);
        field.text = lines[i];
        field.x = padding;
        field.y = y;
        field.width = width;
        y += field.height;
    }
    while (this.m_lines.length > lines.length) {
        var unused = this.m_lines.pop();
        this.removeChild(unused);
        unused.dispose();
    }
    return y + padding;
};

/**
 * Reuses an existing line field or creates the next one.
 *
 * @param {number} index Line position.
 * @returns {!runeos.text.TextField}
 * @private
 */
runeos.ui.Notification.prototype.m_getLineField = function(index) {
    if (this.m_lines[index]) return this.m_lines[index];
    var field = new runeos.text.TextField({
        config: this.m_textConfig,
        role: "notification",
        color: this.m_config.textColor
    });
    this.m_lines.push(field);
    this.addChild(field);
    return field;
};

/**
 * Starts the entrance fade before the readable hold interval.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.Notification.prototype.m_fadeIn = function() {
    this.m_phase = "in";
    this.m_tweens.create({
        target: this,
        args: {alpha: this.m_config.backgroundOpacity},
        duration: this.m_config.fadeInMs,
        transition: runeos.tween.Quad.easeOut,
        scope: this,
        onDispose: function() {
            this.m_phase = "hold";
            this.m_remaining = this.m_config.holdMs;
        }
    });
};

/**
 * Starts the exit fade and releases the visible message on completion.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.Notification.prototype.m_fadeOut = function() {
    this.m_phase = "out";
    this.m_tweens.create({
        target: this,
        args: {alpha: 0},
        duration: this.m_config.fadeOutMs,
        transition: runeos.tween.Quad.easeIn,
        scope: this,
        onDispose: this.hide
    });
};
