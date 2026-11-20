//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new CategoryGlitch instance.
 *
 * @constructor
 * @class
 * @classdesc
 *
 * Draws a brief signal glitch over the launcher after category navigation.
 * Each transition samples three patterns of displaced image bands and signal
 * noise, then draws them on the shared output canvas as the shake subsides.
 */
runeos.launcher.CategoryGlitch = function() {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Remaining time in the category signal glitch, in milliseconds.
     *
     * @type {number}
     * @private
     */
    this.m_remaining = 0;

    /**
     * Displaced image bands grouped by animation phase.
     *
     * @type {!Array<!Array<{y:number, height:number, shift:number}>>}
     * @private
     */
    this.m_bands = [];

    /**
     * Random noise blocks grouped by animation phase.
     *
     * @type {!Array<!Array<{x:number, y:number, width:number, height:number, color:string}>>}
     * @private
     */
    this.m_noise = [];

    /**
     * Starting direction of the image displacement.
     *
     * @type {number}
     * @private
     */
    this.m_direction = 1;

};

//------------------------------------------------------------------------------
// Public static constants
//------------------------------------------------------------------------------

/**
 * Duration of the category signal glitch, in milliseconds.
 *
 * @constant {number}
 */
runeos.launcher.CategoryGlitch.GLITCH_MS = 180;

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Starts a new glitch in the navigation direction.
 *
 * @param {number} direction Negative for left, positive for right.
 * @returns {undefined}
 */
runeos.launcher.CategoryGlitch.prototype.start = function(direction) {
    this.m_remaining = runeos.launcher.CategoryGlitch.GLITCH_MS;
    this.m_direction = direction || 1;
    this.m_bands = [];
    this.m_noise = [];
    for (var phase = 0; phase < 3; phase++) {
        var bands = this.m_createGlitchBands();
        this.m_bands.push(bands);
        this.m_noise.push(this.m_createGlitchNoise(bands));
    }
};

/**
 * Stops the effect immediately.
 *
 * @returns {undefined}
 */
runeos.launcher.CategoryGlitch.prototype.reset = function() {
    this.m_remaining = 0;
};

/**
 * Advances the current glitch in milliseconds.
 *
 * @param {number} step Elapsed frame time.
 * @returns {undefined}
 */
runeos.launcher.CategoryGlitch.prototype.update = function(step) {
    this.m_remaining = Math.max(0, this.m_remaining - step);
};

/**
 * Draws the category signal glitch over the launcher.
 *
 * @param {runeos.display.Canvas} canvas Shared output canvas.
 * @returns {undefined}
 */
runeos.launcher.CategoryGlitch.prototype.render = function(canvas) {
    if (this.m_remaining <= 0 || canvas.width < 2 || canvas.height < 2) return;
    // Hold each displacement briefly so the picture snaps between distinct states.
    var elapsed = runeos.launcher.CategoryGlitch.GLITCH_MS - this.m_remaining;
    var phase = Math.min(2, Math.floor(elapsed / 60));
    var strength = 1 - phase * 0.35;
    var direction = this.m_direction * (phase === 1 ? -1 : 1);
    var context = canvas["context"];
    var x = Math.round(16 * strength) * direction;
    var y = Math.round(4 * strength) * direction;
    context.drawImage(canvas["element"], x, y);
    this.m_renderGlitchBands(canvas, strength, direction, phase);
    this.m_renderSignalNoise(canvas, strength, phase);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Samples independent image tears across four vertical sections of the screen.
 *
 * @returns {!Array<{y:number, height:number, shift:number}>} Image bands.
 * @private
 */
runeos.launcher.CategoryGlitch.prototype.m_createGlitchBands = function() {
    var bands = [];
    for (var i = 0; i < 4; i++) {
        bands.push({
            y: i * 0.25 + 0.03 + Math.random() * 0.13,
            height: 0.015 + Math.random() * 0.07,
            shift: (i % 2 === 0 ? 1 : -1) * (28 + Math.random() * 75)
        });
    }
    return bands;
};

/**
 * Shifts the current phase's image bands sideways.
 *
 * @param {runeos.display.Canvas} canvas Shared output canvas.
 * @param {number} strength Strength of the current displacement.
 * @param {number} direction Direction of the first band.
 * @param {number} phase Current glitch phase.
 * @returns {undefined}
 * @private
 */
runeos.launcher.CategoryGlitch.prototype.m_renderGlitchBands = function(canvas, strength, direction, phase) {
    var context = canvas["context"];
    var width = canvas.width;
    var bands = this.m_bands[phase];
    for (var i = 0; i < bands.length; i++) {
        var band = bands[i];
        var y = Math.floor(band.y * canvas.height);
        var height = Math.max(1, Math.floor(band.height * canvas.height));
        var distance = Math.round(strength * Math.min(width - 1, Math.abs(band.shift)));
        if (!distance) continue;
        var shift = distance * direction * (band.shift < 0 ? -1 : 1);
        var sourceX = Math.max(0, -shift);
        var targetX = Math.max(0, shift);
        context.drawImage(canvas["element"], sourceX, y, width - distance, height,
            targetX, y, width - distance, height);
    }
};

/**
 * Samples one noise pattern near the displaced bands.
 *
 * @param {!Array<{y:number, height:number, shift:number}>} bands Image bands for this phase.
 * @returns {!Array<{x:number, y:number, width:number, height:number, color:string}>} Noise blocks.
 * @private
 */
runeos.launcher.CategoryGlitch.prototype.m_createGlitchNoise = function(bands) {
    var blocks = [];
    for (var band = 0; band < bands.length; band++) {
        var count = 4 + Math.floor(Math.random() * 7);
        var color = band === 1 ? "#ff70cf" : "#8feaff";
        for (var i = 0; i < count; i++) {
            blocks.push({
                x: Math.random(),
                y: bands[band].y + Math.random() * (bands[band].height + 0.04) - 0.02,
                width: 4 + Math.random() * 82,
                height: 1 + Math.floor(Math.random() * 5),
                color: color
            });
        }
    }
    return blocks;
};

/**
 * Draws short blocks of corrupted color along the displaced bands.
 *
 * @param {runeos.display.Canvas} canvas Shared output canvas.
 * @param {number} strength Strength of the current displacement.
 * @param {number} phase Current glitch phase.
 * @returns {undefined}
 * @private
 */
runeos.launcher.CategoryGlitch.prototype.m_renderSignalNoise = function(canvas, strength, phase) {
    var context = canvas["context"];
    context.save();
    try {
        context.globalAlpha *= 0.5 * strength;
        var blocks = this.m_noise[phase];
        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i];
            context.fillStyle = block.color;
            context.fillRect(Math.floor(block.x * canvas.width), Math.floor(block.y * canvas.height),
                Math.round(block.width * strength), block.height);
        }
    } finally {
        context.restore();
    }
};
