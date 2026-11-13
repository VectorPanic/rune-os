//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new DisplayGroup instance.
 *
 * @constructor
 * @extends runeos.display.DisplayObjectContainer
 *
 * @param {number} [x=0] Horizontal translation.
 * @param {number} [y=0] Vertical translation.
 *
 * @class
 * @classdesc
 *
 * Groups children without a pixel buffer. Shares translation, visibility and
 * opacity while drawing directly into a destination Canvas. Layout dimensions
 * do not clip children. Group scaling and background fills are not applied;
 * buffered containers and individual children retain those rendering features.
 */
runeos.display.DisplayGroup = function(x, y) {
    runeos.display.DisplayObjectContainer.call(this, x, y, 0, 0);
};

//------------------------------------------------------------------------------
// Inheritance
//------------------------------------------------------------------------------

runeos.display.DisplayGroup.prototype = Object.create(runeos.display.DisplayObjectContainer.prototype);
runeos.display.DisplayGroup.prototype.constructor = runeos.display.DisplayGroup;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Groups never allocate a pixel buffer.
 *
 * @member {?runeos.display.Canvas} canvas
 * @memberof runeos.display.DisplayGroup
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.display.DisplayGroup.prototype, "canvas", {
    /**
     * @this runeos.display.DisplayGroup
     * @returns {?runeos.display.Canvas}
     * @ignore
     */
    get : function() {
        return null;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Draws children directly into a destination using inherited translation and
 * opacity. An optional renderer can provide specialized ordering or decoration
 * within the same group state. It receives group, canvas, x and y arguments.
 * The destination context is restored even when rendering fails.
 *
 * @param {runeos.display.Canvas} canvas Destination pixel buffer.
 * @param {number} [offsetX=0] Parent horizontal translation.
 * @param {number} [offsetY=0] Parent vertical translation.
 * @param {Function} [renderer] Custom content renderer.
 *
 * @returns {undefined}
 */
runeos.display.DisplayGroup.prototype.renderTo = function(canvas, offsetX, offsetY, renderer) {
    if (!this.visible || this.alpha <= 0) return;
    var x = this.x + (offsetX || 0);
    var y = this.y + (offsetY || 0);
    var context = canvas["context"];
    context.save();
    try {
        context.globalAlpha *= this.alpha;
        if (renderer) {
            renderer(this, canvas, x, y);
        } else {
            for (var i = 0; i < this.m_children.length; i++) {
                canvas.renderDisplayObject(this.m_children[i], x, y);
            }
        }
    } finally {
        context.restore();
    }
};

//------------------------------------------------------------------------------
// Override public prototype methods (ENGINE)
//------------------------------------------------------------------------------

/**
 * Groups have no local buffer to paint. Use renderTo or Canvas.renderDisplayObject.
 *
 * @returns {undefined}
 * @ignore
 */
runeos.display.DisplayGroup.prototype.render = function() {
};
