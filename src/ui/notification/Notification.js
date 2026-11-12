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
     * Owned message label.
     *
     * @type {runeos.text.TextField}
     * @private
     */
    this.m_textField = null;

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
     * Constructs the owned label and initializes the hidden state.
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
        return this.m_textField.text;
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
    this.m_textField.text = message;
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
    var context = canvas.context;
    context.save();
    try {
        context.globalAlpha *= this.alpha;
        context.fillStyle = this.backgroundColor;
        context.fillRect(this.x, this.y, this.width, this.height);
        this.m_textField.drawTo(canvas, this.x, this.y);
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
 * Releases animations and the owned label once.
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
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Constructs the message label and background presentation.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.Notification.prototype.m_construct = function() {
    this.m_textField = new runeos.text.TextField({
        config: this.m_textConfig,
        role: "notification",
        color: this.m_config.textColor
    });
    this.addChild(this.m_textField);
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
    var textWidth = canvas ? this.m_textField.measure(canvas) : this.m_textField.textWidth;
    this.width = Math.max(0, Math.min(this.m_config.maxWidthPx, this.m_viewport.width - margin * 2,
        Math.ceil(textWidth) + padding * 2));
    this.height = this.m_textField.height + padding * 2;
    this.x = this.m_alignment === "left" ? margin : (this.m_viewport.width - this.width) / 2;
    this.y = Math.max(0, this.m_viewport.height - margin - this.height);
    this.m_textField.x = padding;
    this.m_textField.y = padding;
    this.m_textField.width = Math.max(0, this.width - padding * 2);
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
