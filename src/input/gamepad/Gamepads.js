//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Gamepads instance.
 *
 * @constructor
 *
 * @param {Object} [options] Set enable to false to suspend polling.
 *
 * @class
 * @classdesc
 *
 * Polls all exposed controller slots and aggregates per-controller input edges.
 * No four-controller limit is imposed. Devices are reusable snapshots.
 */
runeos.input.Gamepads = function(options) {
    options = options || {};

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable input settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("input", options.config);

    /**
     * Persistent snapshots indexed by browser slot.
     *
     * @type {Array.<runeos.input.Gamepad>}
     * @private
     */
    this.m_gamepads = [];

    /**
     * Independent button holds indexed by button and controller slot.
     *
     * @type {Object.<number, Array.<Object>>}
     * @private
     */
    this.m_holds = {};

    /**
     * Whether OS controller polling is enabled.
     *
     * @type {boolean}
     * @private
     */
    this.m_enabled = options.enable === undefined ? this.m_config.useGamepads : Boolean(options.enable);

    /**
     * Whether the OS window has focus.
     *
     * @type {boolean}
     * @private
     */
    this.m_focused = true;

    /**
     * Whether the manager has been disposed.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    /**
     * Focus subscriptions owned by this manager.
     *
     * @type {runeos.util.EventBindings}
     * @private
     */
    this.m_events = new runeos.util.EventBindings();
    var gamepads = this;
    this.m_events.add(window, "blur", function() {
        gamepads.m_focused = false;
        gamepads.reset();
    });
    this.m_events.add(window, "focus", function() {
        gamepads.m_focused = true;
        gamepads.reset();
    });
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Whether sampled input is held or newly pressed.
 *
 * @member {boolean} active
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "active", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_any("active", null, true);
    }
});

/**
 * Whether OS gamepad polling is enabled.
 *
 * @member {boolean} enabled
 * @memberof runeos.input.Gamepads
 * @instance
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "enabled", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_enabled;
    },
    /**
     * @this runeos.input.Gamepads
     * @ignore
     */
    set : function(value) {
        if (this.m_disposed) return;
        value = Boolean(value);
        if (value !== this.m_enabled) {
            this.m_enabled = value;
            this.reset();
        }
    }
});

/**
 * Compatibility spelling used by the SDK.
 *
 * @member {boolean} enable
 * @memberof runeos.input.Gamepads
 * @instance
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "enable", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.enabled;
    },
    /**
     * @this runeos.input.Gamepads
     * @ignore
     */
    set : function(value) {
        this.enabled = value;
    }
});

/**
 * Number of currently sampled connected controllers.
 *
 * @member {number} numGamepads
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "numGamepads", {
    /**
     * @this runeos.input.Gamepads
     * @returns {number}
     * @ignore
     */
    get : function() {
        var count = 0;
        for (var i = 0; i < this.m_gamepads.length; i++) {
            if (this.m_gamepads[i] && this.m_gamepads[i].connected) count++;
        }
        return count;
    }
});

/**
 * Whether any controller reports stickRightLeft.
 *
 * @member {boolean} stickRightLeft
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "stickRightLeft", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_any("stickRightLeft", null, true);
    }
});

/**
 * Whether any controller reports stickRightJustLeft.
 *
 * @member {boolean} stickRightJustLeft
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "stickRightJustLeft", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_any("stickRightJustLeft", null, true);
    }
});

/**
 * Whether any controller reports stickRightRight.
 *
 * @member {boolean} stickRightRight
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "stickRightRight", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_any("stickRightRight", null, true);
    }
});

/**
 * Whether any controller reports stickRightJustRight.
 *
 * @member {boolean} stickRightJustRight
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "stickRightJustRight", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_any("stickRightJustRight", null, true);
    }
});

/**
 * Whether any controller reports stickRightUp.
 *
 * @member {boolean} stickRightUp
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "stickRightUp", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_any("stickRightUp", null, true);
    }
});

/**
 * Whether any controller reports stickRightJustUp.
 *
 * @member {boolean} stickRightJustUp
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "stickRightJustUp", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_any("stickRightJustUp", null, true);
    }
});

/**
 * Whether any controller reports stickRightDown.
 *
 * @member {boolean} stickRightDown
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "stickRightDown", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_any("stickRightDown", null, true);
    }
});

/**
 * Whether any controller reports stickRightJustDown.
 *
 * @member {boolean} stickRightJustDown
 * @memberof runeos.input.Gamepads
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.input.Gamepads.prototype, "stickRightJustDown", {
    /**
     * @this runeos.input.Gamepads
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_any("stickRightJustDown", null, true);
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Returns a sampled device by browser slot, or null when the slot is unknown.
 *
 * @param {number} index Browser controller index.
 *
 * @returns {runeos.input.Gamepad}
 */
runeos.input.Gamepads.prototype.get = function(index) {
    return this.m_gamepads[index] || null;
};

/**
 * Reads pressed on any controller, preserving each device's own edge state.
 *
 * @param {number} button Standard browser button index.
 *
 * @returns {boolean}
 */
runeos.input.Gamepads.prototype.pressed = function(button) {
    return this.m_any("pressed", button);
};

/**
 * Reads justPressed on any controller, preserving each device's own edge state.
 *
 * @param {number} button Standard browser button index.
 *
 * @returns {boolean}
 */
runeos.input.Gamepads.prototype.justPressed = function(button) {
    return this.m_any("justPressed", button);
};

/**
 * Reads justReleased on any controller, preserving each device's own edge
 * state.
 *
 * @param {number} button Standard browser button index.
 *
 * @returns {boolean}
 */
runeos.input.Gamepads.prototype.justReleased = function(button) {
    return this.m_any("justReleased", button);
};

/**
 * Checks navigation from every connected controller.
 *
 * @param {string} direction LEFT, RIGHT, UP or DOWN.
 *
 * @returns {boolean}
 */
runeos.input.Gamepads.prototype.directionJustPressed = function(direction) {
    return this.m_any("directionJustPressed", direction);
};

/**
 * Advances a button shortcut and fires once per continuous hold on one device.
 * A fresh press is required after reset or device replacement. Call once per
 * frame while the shortcut is available; suspended frames do not count.
 *
 * @param {number} button Standard browser button index.
 * @param {number} duration Required hold duration in milliseconds.
 * @param {number} step Elapsed frame time in milliseconds.
 *
 * @returns {boolean} Whether any controller just completed its own hold.
 */
runeos.input.Gamepads.prototype.justHeld = function(button, duration, step) {
    var holds = this.m_holds[button];
    if (!holds) {
        holds = [];
        this.m_holds[button] = holds;
    }
    var completed = false;
    step = typeof step === "number" && isFinite(step) ? Math.max(0, step) : 0;
    holds.length = this.m_gamepads.length;
    for (var i = 0; i < this.m_gamepads.length; i++) {
        var pad = this.m_gamepads[i];
        if (!pad || !pad.connected || !pad.pressed(button)) {
            holds[i] = null;
            continue;
        }
        var hold = holds[i];
        if (!hold || hold.id !== pad.id) {
            holds[i] = null;
            if (!pad.justPressed(button)) continue;
            hold = {
                id: pad.id,
                elapsed: 0,
                fired: false
            };
            holds[i] = hold;
        } else {
            hold.elapsed += step;
        }
        if (!hold.fired && hold.elapsed >= duration) {
            hold.fired = true;
            completed = true;
        }
    }
    return completed;
};

/**
 * Clears input and primes devices for focus recovery or return from Application.
 *
 * @returns {undefined}
 */
runeos.input.Gamepads.prototype.reset = function() {
    this.m_holds = {};
    for (var i = 0; i < this.m_gamepads.length; i++) {
        if (this.m_gamepads[i]) this.m_gamepads[i].reset();
    }
};

/**
 * Polls the browser once per frame and resets disconnected or replaced slots.
 *
 * @returns {undefined}
 */
runeos.input.Gamepads.prototype.update = function() {
    if (this.m_disposed || !this.m_enabled || !this.m_focused) return;
    var states;
    try {
        states = typeof navigator !== "undefined" && typeof navigator.getGamepads === "function" ?
            navigator.getGamepads() : [];
    } catch (error) {
        states = [];
    }
    states = states || [];
    var count = Math.max(states.length, this.m_gamepads.length);
    for (var i = 0; i < count; i++) {
        var state = states[i];
        if (state && state.connected !== false) {
            if (!this.m_gamepads[i]) this.m_gamepads[i] = new runeos.input.Gamepad({config: this.m_config});
            this.m_gamepads[i].update(state);
        } else if (this.m_gamepads[i]) {
            this.m_gamepads[i].reset();
        }
    }
};

/**
 * Releases focus subscriptions and all device snapshots.
 *
 * @returns {undefined}
 */
runeos.input.Gamepads.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_enabled = false;
    this.m_events.dispose();
    this.reset();
    this.m_gamepads.length = 0;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Aggregates independent device results without merging their held states.
 *
 * @param {string} name Method or property to query.
 * @param {*} value Query argument.
 * @param {boolean} [property=false] Whether to read a property instead of a method.
 *
 * @returns {boolean}
 * @private
 */
runeos.input.Gamepads.prototype.m_any = function(name, value, property) {
    for (var i = 0; i < this.m_gamepads.length; i++) {
        var gamepad = this.m_gamepads[i];
        if (gamepad && gamepad.connected && (property ? gamepad[name] : gamepad[name](value))) return true;
    }
    return false;
};
