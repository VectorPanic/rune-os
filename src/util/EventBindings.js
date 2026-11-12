//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new EventBindings instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Owns a group of DOM event subscriptions. clear() releases all bindings and
 * permits reuse; dispose() permanently closes the group and drops its
 * references.
 */
runeos.util.EventBindings = function() {
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Event subscriptions owned by this group.
     *
     * @type {Array.<Object>}
     * @private
     */
    this.m_bindings = [];

    /**
     * Whether new subscriptions are forbidden after disposal.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Number of owned event bindings.
 *
 * @member {number} length
 * @memberof runeos.util.EventBindings
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.util.EventBindings.prototype, "length", {
    /**
     * @this runeos.util.EventBindings
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_bindings.length;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Registers a subscription once, matching DOM listener identity rules.
 *
 * @param {EventTarget} target Event target.
 * @param {string} type Event name.
 * @param {Function} handler Event callback.
 * @param {boolean} [capture=false] Capture-phase subscription.
 *
 * @returns {Function} Registered handler.
 */
runeos.util.EventBindings.prototype.add = function(target, type, handler, capture) {
    if (this.m_disposed) throw new Error("EventBindings is disposed.");
    capture = Boolean(capture);
    for (var i = 0; i < this.m_bindings.length; i++) {
        var binding = this.m_bindings[i];
        if (binding.target === target && binding.type === type &&
            binding.handler === handler && binding.capture === capture) {
            return handler;
        }
    }
    target.addEventListener(type, handler, capture);
    this.m_bindings.push({
        target: target,
        type: type,
        handler: handler,
        capture: capture
    });
    return handler;
};

/**
 * Removes all subscriptions using the same capture flags used at registration.
 *
 * @returns {undefined}
 */
runeos.util.EventBindings.prototype.clear = function() {
    while (this.m_bindings.length > 0) {
        var binding = this.m_bindings.pop();
        binding.target.removeEventListener(binding.type, binding.handler, binding.capture);
    }
};

/**
 * Releases all subscriptions and prevents further registration.
 *
 * @returns {undefined}
 */
runeos.util.EventBindings.prototype.dispose = function() {
    this.m_disposed = true;
    this.clear();
};
