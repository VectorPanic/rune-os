//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ScreenFade instance.
 *
 * @constructor
 * @param {Object} config Cover and reveal durations in milliseconds.
 *
 * @class
 * @classdesc
 *
 * Covers the shared output before a continuation changes its owner. Revealing
 * waits for an explicit ready signal and a black frame at the new resolution.
 * Only transition frames retain pixels; no additional canvas is created.
 */
runeos.ui.ScreenFade = function(config) {
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable cover and arrival durations.
     *
     * @type {Object}
     * @private
     */
    this.m_config = config;

    /**
     * Pixels borrowed only while the cover is visible.
     *
     * @type {runeos.display.CanvasRegion}
     * @private
     */
    this.m_region = new runeos.display.CanvasRegion();

    /**
     * Current departure, preparation or arrival phase.
     *
     * @type {string}
     * @private
     */
    this.m_phase = "idle";

    /**
     * Current cover opacity, animated through the tween package.
     *
     * @type {number}
     * @private
     */
    this.m_alpha = 0;

    /**
     * One continuation waiting for fully covered output.
     *
     * @type {Function}
     * @private
     */
    this.m_callback = null;

    /**
     * Owned animation manager, which releases completed tweens.
     *
     * @type {runeos.tween.Tweens}
     * @private
     */
    this.m_tweens = new runeos.tween.Tweens();

};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether output ownership is changing, including asynchronous preparation.
 *
 * @member {boolean} active
 * @memberof runeos.ui.ScreenFade
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.ui.ScreenFade.prototype, "active", {
    /**
     * @this runeos.ui.ScreenFade
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_phase !== "idle";
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Starts one departure; repeated requests cannot replace its continuation.
 *
 * @param {Function} onCovered Continuation invoked after black has been drawn.
 * @returns {undefined}
 */
runeos.ui.ScreenFade.prototype.cover = function(onCovered) {
    if (this.m_phase === "cover") return;
    if (this.m_phase === "wait" || this.m_phase === "ready") {
        this.m_phase = "cover";
        this.m_callback = onCovered;
        return;
    }
    this.m_phase = "cover";
    this.m_callback = onCovered;
    this.m_start(1, this.m_config.coverMs);
};

/**
 * Requests arrival after a destination has produced its first frame.
 *
 * @returns {undefined}
 */
runeos.ui.ScreenFade.prototype.reveal = function() {
    if (this.m_phase === "wait") this.m_phase = "ready";
};

/**
 * Restores the borrowed frame before either owner renders again.
 *
 * @returns {undefined}
 */
runeos.ui.ScreenFade.prototype.restore = function() {
    this.m_region.restore();
};

/**
 * Advances only an active fade, leaving asynchronous loading covered.
 *
 * @param {number} step Elapsed milliseconds.
 * @returns {undefined}
 */
runeos.ui.ScreenFade.prototype.update = function(step) {
    this.m_tweens.update(step);
};

/**
 * Paints the cover last, preserving context and paused application pixels.
 *
 * @param {runeos.display.Canvas} canvas Borrowed output canvas.
 * @returns {undefined}
 */
runeos.ui.ScreenFade.prototype.render = function(canvas) {
    this.restore();
    if (this.m_phase === "idle") return;
    this.m_drawCover(canvas);
    this.m_finishFrame(canvas);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Draws the current opacity over the borrowed output without changing its state.
 *
 * @param {runeos.display.Canvas} canvas Shared output canvas.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.ScreenFade.prototype.m_drawCover = function(canvas) {
    if (this.m_alpha > 0 && this.m_region.capture(canvas, {
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height
    })) {
        var context = canvas["context"];
        context.save();
        try {
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.globalAlpha = this.m_alpha;
            context.globalCompositeOperation = "source-over";
            context.filter = "none";
            context.shadowColor = "transparent";
            context.shadowBlur = 0;
            context.fillStyle = "#000000";
            context.fillRect(0, 0, canvas.width, canvas.height);
        } finally {
            context.restore();
        }
    }
};

/**
 * Commits ownership changes only after a covered frame has been produced.
 *
 * @param {runeos.display.Canvas} canvas Shared output, possibly resized by shutdown.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.ScreenFade.prototype.m_finishFrame = function(canvas) {
    if (this.m_phase === "cover" && this.m_alpha === 1) {
        this.m_phase = "wait";
        var callback = this.m_callback;
        this.m_callback = null;
        // Pixels from the outgoing owner must never overwrite a new frame.
        this.m_region.discard();
        if (callback) callback();
        // Shutdown or bootstrap may clear or resize output synchronously.
        this.m_drawCover(canvas);
    } else if (this.m_phase === "ready") {
        this.m_phase = "reveal";
        this.m_start(0, this.m_config.revealMs);
    } else if (this.m_phase === "reveal" && this.m_alpha === 0) {
        this.m_phase = "idle";
        this.m_tweens.clear();
    }
};

/**
 * Replaces the current alpha tween without retaining completed continuations.
 *
 * @param {number} alpha Destination opacity.
 * @param {number} duration Transition milliseconds.
 *
 * @returns {undefined}
 * @private
 */
runeos.ui.ScreenFade.prototype.m_start = function(alpha, duration) {
    this.m_tweens.clear();
    this.m_tweens.create({
        target: this,
        args: {m_alpha: alpha},
        duration: duration,
        transition: runeos.tween.Sine.easeInOut
    });
};
