//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new ResourceBase instance.
 *
 * @constructor
 *
 * @param {string} url Application resource directory.
 *
 * @class
 * @classdesc
 *
 * Owns a temporary document base while an application runs. Native image,
 * audio, XHR and fetch requests then share the same game-relative URL rules.
 * Removing the owned element reveals the original document base unchanged.
 */
runeos.util.ResourceBase = function(url) {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Base element owned by this scope.
     *
     * @type {Element}
     * @private
     */
    this.m_element = null;

    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Activates the application resource directory.
     */
    this.m_construct(url);
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Restores the prior document base and releases the owned element once.
 *
 * @returns {undefined}
 */
runeos.util.ResourceBase.prototype.dispose = function() {
    if (!this.m_element) return;
    if (this.m_element.parentNode) this.m_element.parentNode.removeChild(this.m_element);
    this.m_element = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Inserts the game base before existing base elements without modifying them.
 * Non-DOM hosts have no native relative requests to redirect.
 *
 * @param {string} url Application resource directory.
 *
 * @returns {undefined}
 * @private
 */
runeos.util.ResourceBase.prototype.m_construct = function(url) {
    if (typeof document === "undefined" || !document.head) return;
    var element = document.createElement("base");
    element.href = runeos.util.Paths.resolve(url);
    document.head.insertBefore(element, document.head.firstChild);
    this.m_element = element;
};
