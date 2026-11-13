//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Scenes instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Coordinates departure and activation without owning scene resources. Keeps
 * the outgoing scene active until leave completes; the latest requested target
 * wins. Scene disposal remains the responsibility of the caller or scene itself.
 */
runeos.scene.Scenes = function() {

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Active scene instance.
     *
     * @type {runeos.scene.Scene}
     * @private
     */
    this.m_scene = null;

    /**
     * Departure generation used to ignore stale or duplicate continuations.
     *
     * @type {number}
     * @private
     */
    this.m_departureId = 0;

    /**
     * Latest requested destination while departure is pending.
     *
     * @type {?runeos.scene.Scene}
     * @private
     */
    this.m_pending = null;

    /**
     * Whether the current scene is completing its departure.
     *
     * @type {boolean}
     * @private
     */
    this.m_leaving = false;
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Currently active scene.
 *
 * @member {runeos.scene.Scene} current
 * @memberof runeos.scene.Scenes
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Scenes.prototype, "current", {
    /**
     * @this runeos.scene.Scenes
     * @returns {runeos.scene.Scene}
     * @ignore
     */
    get : function() {
        return this.m_scene;
    }
});

/**
 * Latest destination awaiting departure completion, or null.
 *
 * @member {?runeos.scene.Scene} pending
 * @memberof runeos.scene.Scenes
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Scenes.prototype, "pending", {
    /**
     * @this runeos.scene.Scenes
     * @returns {?runeos.scene.Scene}
     * @ignore
     */
    get : function() {
        return this.m_pending;
    }
});

/**
 * Whether activation is waiting for the outgoing scene to leave.
 *
 * @member {boolean} transitioning
 * @memberof runeos.scene.Scenes
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.scene.Scenes.prototype, "transitioning", {
    /**
     * @this runeos.scene.Scenes
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_leaving;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Requests activation after the current scene has left. New requests replace
 * the pending destination without repeating departure. Requesting the current
 * scene while idle is a no-op; while leaving it requests reentry after departure.
 * Neither outgoing nor superseded scene instances are disposed by this manager.
 *
 * @param {runeos.scene.Scene} scene Destination scene.
 *
 * @returns {undefined}
 */
runeos.scene.Scenes.prototype.swap = function(scene) {
    this.m_validateScene(scene);
    if (!this.m_leaving && scene === this.m_scene) return;
    this.m_pending = scene;
    if (this.m_leaving) return;
    if (this.m_scene && typeof this.m_scene.leave === "function") {
        this.m_leaveCurrent();
    } else {
        this.m_activatePending();
    }
};

/**
 * Updates the current scene with the elapsed frame time.
 *
 * @param {number} step Current time step in milliseconds.
 *
 * @returns {undefined}
 */
runeos.scene.Scenes.prototype.update = function(step) {
    var scene = this.m_scene;
    if (scene && !scene["disposed"] && typeof scene.update === "function") scene.update(step);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Checks activation requirements before altering a pending request. Scene-like
 * objects remain supported; application-specific scene types are not inspected.
 *
 * @param {runeos.scene.Scene} scene Requested scene.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Scenes.prototype.m_validateScene = function(scene) {
    if (!scene || typeof scene.init !== "function") throw new TypeError("Expected a scene with init().");
    if (scene.disposed) throw new Error("Cannot activate a disposed scene.");
};

/**
 * Starts one departure and activates the latest destination when it completes.
 * Duplicate or stale continuations cannot activate a scene twice. A failed
 * departure releases pending state so a later explicit request can retry.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Scenes.prototype.m_leaveCurrent = function() {
    var manager = this;
    var departureId = ++this.m_departureId;
    this.m_leaving = true;
    try {
        this.m_scene.leave(function() {
            if (!manager.m_leaving || departureId !== manager.m_departureId) return;
            manager.m_leaving = false;
            manager.m_activatePending();
        });
    } catch (error) {
        if (departureId === this.m_departureId && this.m_leaving) {
            this.m_leaving = false;
            this.m_pending = null;
        }
        throw error;
    }
};

/**
 * Sets the active scene before init so the destination sees itself as
 * current. Initialization may request another scene. Resources remain owned by
 * their scene; an instance disposed while waiting is rejected at activation.
 *
 * @returns {undefined}
 * @private
 */
runeos.scene.Scenes.prototype.m_activatePending = function() {
    var next = this.m_pending;
    var previous = this.m_scene;
    this.m_pending = null;
    this.m_validateScene(next);
    this.m_scene = next;
    next.init(previous);
};
