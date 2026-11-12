//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new LauncherBackground instance.
 *
 * @constructor
 * @extends runeos.display.DisplayGroup
 *
 * @param {Object} [options] Viewport dimensions and light-field settings.
 *
 * @class
 * @classdesc
 *
 * Paints two slowly drifting light fields directly into the destination canvas.
 * Owns no pixel buffer, DOM, input or frame loop. The composing scene controls
 * whether time advances; colors remain independent of selected games.
 */
runeos.ui.LauncherBackground = function(options) {
    runeos.display.DisplayGroup.call(this);
    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Validated light-field appearance and motion settings.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("launcherBackground", options.config);

    /**
     * Bounded elapsed motion time in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_elapsed = 0;

    /**
     * Whether the composing scene permits movement.
     *
     * @type {boolean}
     * @private
     */
    this.m_active = false;

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

    this.m_construct(options);
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.ui.LauncherBackground.prototype = Object.create(runeos.display.DisplayGroup.prototype);
runeos.ui.LauncherBackground.prototype.constructor = runeos.ui.LauncherBackground;

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Resumes slow movement from its previous phase.
 *
 * @returns {undefined}
 */
runeos.ui.LauncherBackground.prototype.start = function() {
    if (!this.m_disposed) this.m_active = true;
};

/**
 * Pauses movement while retaining the current appearance.
 *
 * @returns {undefined}
 */
runeos.ui.LauncherBackground.prototype.stop = function() {
    this.m_active = false;
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Advances the light-field phase only while the scene enables movement.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.LauncherBackground.prototype.update = function(step) {
    if (this.m_disposed || !this.m_active || !this.m_config.enabled ||
        typeof step !== "number" || !isFinite(step) || step <= 0) return;
    this.m_elapsed = (this.m_elapsed + step) % this.m_config.periodMs;
};

/**
 * Draws into the existing stage destination, preserving its context state.
 * No canvas is allocated, blurred, read back or copied for this effect.
 *
 * @param {runeos.display.Canvas} canvas Shared destination canvas.
 * @param {number} [offsetX=0] Parent horizontal translation.
 * @param {number} [offsetY=0] Parent vertical translation.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.LauncherBackground.prototype.renderTo = function(canvas, offsetX, offsetY) {
    if (this.m_disposed || !this.m_config.enabled || !this.visible || this.alpha <= 0 || this.m_config.fieldOpacity <= 0) return;
    var context = canvas.context;
    context.save();
    try {
        context.translate(this.x + (offsetX || 0), this.y + (offsetY || 0));
        context.globalCompositeOperation = "source-over";
        context.globalAlpha *= this.alpha * this.m_config.fieldOpacity;
        this.m_renderFields(context);
    } finally {
        context.restore();
    }
};

/**
 * Stops movement and releases inherited display state without a pixel buffer.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.ui.LauncherBackground.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.stop();
    this.m_disposed = true;
    runeos.display.DisplayGroup.prototype.dispose.call(this);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Stores viewport geometry, immutable settings and scene-controlled time.
 *
 * @param {Object} [options] Viewport dimensions and optional config overrides.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.LauncherBackground.prototype.m_construct = function(options) {
    this.width = options.width === undefined ? runeos.display.Screen.DEFAULT_WIDTH : options.width;
    this.height = options.height === undefined ? runeos.display.Screen.DEFAULT_HEIGHT : options.height;

};

/**
 * Places broad fields on opposing sides with gentle independent vertical drift.
 *
 * @param {CanvasRenderingContext2D} context Destination context.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.LauncherBackground.prototype.m_renderFields = function(context) {
    var phase = this.m_elapsed / this.m_config.periodMs * Math.PI * 2;
    var travel = this.m_config.travelRatio;
    var radius = Math.max(this.width, this.height) * this.m_config.radiusRatio;
    var firstX = this.width * (0.24 + Math.sin(phase) * travel);
    var firstY = this.height * (0.38 + Math.cos(phase) * travel * 0.5);
    var secondX = this.width * (0.76 - Math.sin(phase) * travel);
    var secondY = this.height * (0.64 + Math.sin(phase + 1.2) * travel * 0.5);
    this.m_renderField(context, firstX, firstY, radius, this.m_config.color);
    this.m_renderField(context, secondX, secondY, radius * 0.85, this.m_config.secondaryColor);
};

/**
 * Paints one soft radial field inside the viewport bounds.
 *
 * @param {CanvasRenderingContext2D} context Destination context.
 * @param {number} x Field center X.
 * @param {number} y Field center Y.
 * @param {number} radius Field radius.
 * @param {string} color Fixed field color.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.LauncherBackground.prototype.m_renderField = function(context, x, y, radius, color) {
    var gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.width, this.height);
};
