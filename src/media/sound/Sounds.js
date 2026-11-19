//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Sounds instance.
 *
 * @constructor
 *
 * @param {Object} [options] Optional audio and loading configuration.
 *
 * @class
 * @classdesc
 *
 * Owns URL resources and three channels sharing one lazily created Web Audio
 * context.
 */
runeos.media.Sounds = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Immutable audio settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_config = runeos.system.Config.getGroup("audio", options.config);

    /**
     * Immutable loading settings used by this component.
     *
     * @type {Object}
     * @private
     */
    this.m_loadingConfig = runeos.system.Config.getGroup("loading", options.loadingConfig);

    /**
     * OS-owned context, created only on first playback.
     *
     * @type {AudioContext}
     * @private
     */
    this.m_context = null;

    /**
     * Preloaded audio templates indexed by resource name.
     *
     * @type {!Object}
     * @private
     */
    this.m_assets = Object.create(null);

    /**
     * Whether the system has been permanently released.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    /**
     * Whether the OS owns playback (false during Application).
     *
     * @type {boolean}
     * @private
     */
    this.m_enabled = true;

    /**
     * Whether playback may run while the window has focus.
     *
     * @type {boolean}
     * @private
     */
    this.m_focused = true;

    /**
     * Master bus and persistent shared audio channel.
     *
     * @type {runeos.media.SoundChannel}
     * @private
     */
    this.m_master = new runeos.media.SoundChannel(this, true);

    /**
     * Background music channel.
     *
     * @type {runeos.media.SoundChannel}
     * @private
     */
    this.m_music = new runeos.media.SoundChannel(this, false);

    /**
     * Sound-effect channel.
     *
     * @type {runeos.media.SoundChannel}
     * @private
     */
    this.m_sound = new runeos.media.SoundChannel(this, false);

    /**
     * Stable channel collection for updates and teardown.
     *
     * @type {Array.<runeos.media.SoundChannel>}
     * @private
     */
    this.m_channels = [this.m_master, this.m_music, this.m_sound];

    /**
     * User-activation and focus subscriptions.
     *
     * @type {runeos.util.EventBindings}
     * @private
     */
    this.m_events = new runeos.util.EventBindings();
    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Registers event handlers owned by this instance.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Private static methods
//------------------------------------------------------------------------------

/**
 * Validates and clamps an audio control value.
 *
 * @param {number} value Requested value.
 * @param {number} min Lower bound.
 * @param {number} max Upper bound.
 *
 * @returns {number} Bounded value.
 * @package
 */
runeos.media.Sounds.m_clamp = function(value, min, max) {
    if (typeof value !== "number" || !isFinite(value)) throw new TypeError("Expected a finite audio value.");
    return Math.max(min, Math.min(max, value));
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Master audio channel.
 *
 * @member {runeos.media.SoundChannel} master
 * @memberof runeos.media.Sounds
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sounds.prototype, "master", {
    /**
     * @this runeos.media.Sounds
     * @returns {runeos.media.SoundChannel}
     * @ignore
     */
    get : function() {
        return this.m_master;
    }
});

/**
 * Music audio channel.
 *
 * @member {runeos.media.SoundChannel} music
 * @memberof runeos.media.Sounds
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sounds.prototype, "music", {
    /**
     * @this runeos.media.Sounds
     * @returns {runeos.media.SoundChannel}
     * @ignore
     */
    get : function() {
        return this.m_music;
    }
});

/**
 * Sound audio channel.
 *
 * @member {runeos.media.SoundChannel} sound
 * @memberof runeos.media.Sounds
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sounds.prototype, "sound", {
    /**
     * @this runeos.media.Sounds
     * @returns {runeos.media.SoundChannel}
     * @ignore
     */
    get : function() {
        return this.m_sound;
    }
});

/**
 * Suspends OS playback without losing intended playback or music position.
 *
 * @member {boolean} enabled
 * @memberof runeos.media.Sounds
 * @instance
 */
Object.defineProperty(runeos.media.Sounds.prototype, "enabled", {
    /**
     * @this runeos.media.Sounds
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_enabled;
    },

    /**
     * @this runeos.media.Sounds
     * @ignore
     */
    set : function(value) {
        if (this.m_disposed) return;
        value = Boolean(value);
        if (value !== this.m_enabled) {
            this.m_enabled = value;
            this.m_syncPlayback();
        }
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Preloads an audio URL once per resource name. Repeated identical requests
 * share a promise.
 *
 * @param {string} name Resource identifier.
 * @param {string} url Audio URL, relative path or data URL.
 *
 * @returns {Promise}
 */
runeos.media.Sounds.prototype.load = function(name, url) {
    if (this.m_disposed) return Promise.reject(new Error("Sounds is disposed."));
    if (typeof name !== "string" || !name.trim() || typeof url !== "string" || !url.trim()) {
        return Promise.reject(new TypeError("Audio name and URL must be nonempty strings."));
    }
    var current = this.m_assets[name];
    if (current) {
        return current.url === url ? current.promise : Promise.reject(new Error("Audio name is already registered."));
    }
    return this.m_register(name, url);
};

/**
 * Stops all uses of a resource and releases its cached media template.
 *
 * @param {string} name Resource identifier.
 *
 * @returns {undefined}
 */
runeos.media.Sounds.prototype.unload = function(name) {
    var asset = this.m_assets[name];
    if (!asset) return;
    for (var i = 0; i < this.m_channels.length; i++) this.m_channels[i].m_removeResource(name);
    if (asset.cancel) asset.cancel();
    else this.m_releaseElement(asset.element);
    delete this.m_assets[name];
};

/**
 * Resumes Web Audio after a trusted key, pointer or touch interaction.
 *
 * @returns {Promise}
 */
runeos.media.Sounds.prototype.unlock = function() {
    if (this.m_disposed || !this.m_enabled || !this.m_context) return Promise.resolve(false);
    var owner = this;
    try {
        return Promise.resolve(this.m_context.state === "suspended" ? this.m_context.resume() : undefined).then(function() {
            if (owner.m_disposed) return false;
            owner.m_syncPlayback();
            return owner.m_context.state === "running";
        });
    } catch (error) {
        return Promise.reject(error);
    }
};

/**
 * Clears sound and music voices while keeping master voices and preloaded
 * resources.
 *
 * @returns {undefined}
 */
runeos.media.Sounds.prototype.clear = function() {
    this.m_sound.clear();
    this.m_music.clear();
};

/**
 * Stops every voice, including master voices, without unloading reusable
 * resources.
 *
 * @returns {undefined}
 */
runeos.media.Sounds.prototype.stop = function() {
    for (var i = 0; i < this.m_channels.length; i++) this.m_channels[i].stop();
};

/**
 * Updates volume fades while OS audio is active.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 */
runeos.media.Sounds.prototype.update = function(step) {
    if (this.m_disposed || !this.m_enabled || !this.m_focused) return;
    for (var i = 0; i < this.m_channels.length; i++) this.m_channels[i].update(step);
};

/**
 * Stops playback, cancels pending loads and releases every graph, listener and
 * context.
 *
 * @returns {undefined}
 */
runeos.media.Sounds.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.m_enabled = false;
    this.m_events.dispose();
    for (var i = 0; i < this.m_channels.length; i++) this.m_channels[i].dispose();
    var names = Object.keys(this.m_assets);
    for (var n = 0; n < names.length; n++) this.unload(names[n]);
    if (this.m_context) {
        var closing = this.m_context.close();
        if (closing && typeof closing.catch === "function") closing.catch(function() {});
        this.m_context = null;
    }
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Runs the initialization steps owned by this instance.
 *
 * @returns {undefined}
 * @private
 */
runeos.media.Sounds.prototype.m_construct = function() {
    this.m_master.volume = this.m_config.masterVolume;
    this.m_master.muted = this.m_config.muted;
    this.m_constructEvents();
};

/**
 * Registers a new template before starting its shared loading promise.
 *
 * @param {string} name Resource identifier.
 * @param {string} url Audio URL.
 *
 * @returns {Promise}
 * @private
 */
runeos.media.Sounds.prototype.m_register = function(name, url) {
    var asset = {
        url: url,
        element: null,
        ready: false,
        events: new runeos.util.EventBindings(),
        timer: null,
        cancel: null
    };
    this.m_assets[name] = asset;
    asset.promise = this.m_loadAsset(name, asset);
    return asset.promise;
};

/**
 * Owns completion, cancellation and cleanup for one loading attempt.
 *
 * @param {string} name Resource identifier.
 * @param {Object} asset Registered audio template.
 *
 * @returns {Promise}
 * @private
 */
runeos.media.Sounds.prototype.m_loadAsset = function(name, asset) {
    var owner = this;
    return new Promise(function(resolve, reject) {
        var settled = false;
        function finish(error) {
            if (settled) return;
            settled = true;
            asset.events.dispose();
            if (asset.timer !== null) window.clearTimeout(asset.timer);
            asset.timer = null;
            asset.cancel = null;
            if (error) {
                owner.m_releaseElement(asset.element);
                if (owner.m_assets[name] === asset) delete owner.m_assets[name];
                reject(error);
            } else {
                asset.ready = true;
                resolve(name);
            }
        }
        asset.cancel = function() {
            finish(new Error("Audio load cancelled: " + name));
        };
        try {
            owner.m_startLoading(name, asset, finish);
        } catch (error) {
            finish(error);
        }
    });
};

/**
 * Configures the media element and starts loading with a bounded wait.
 *
 * @param {string} name Resource identifier.
 * @param {Object} asset Registered audio template.
 * @param {Function} finish Shared once-only completion callback.
 *
 * @returns {undefined}
 * @private
 */
runeos.media.Sounds.prototype.m_startLoading = function(name, asset, finish) {
    var element = new Audio();
    asset.element = element;
    element.preload = "auto";
    element.crossOrigin = "anonymous";
    asset.events.add(element, "canplaythrough", function() {
        finish(null);
    });
    asset.events.add(element, "error", function() {
        finish(new Error("Unable to load audio: " + name));
    });
    if (this.m_loadingConfig.audioTimeoutMs > 0) {
        asset.timer = window.setTimeout(function() {
            finish(new Error("Audio load timed out: " + name));
        }, this.m_loadingConfig.audioTimeoutMs);
    }
    element.src = runeos.util.Paths.resolve(asset.url);
    element.load();
};

/**
 * Creates the shared context only when a voice first needs Web Audio.
 *
 * @returns {AudioContext}
 * @package
 */
runeos.media.Sounds.prototype.m_getContext = function() {
    if (this.m_disposed) throw new Error("Sounds is disposed.");
    if (!this.m_context) {
        var Context = window.AudioContext || window.webkitAudioContext;
        if (typeof Context !== "function") throw new Error("Web Audio is unavailable.");
        this.m_context = new Context();
    }
    return this.m_context;
};

/**
 * Returns a ready media template; callers must await load() first.
 *
 * @param {string} name Resource identifier.
 *
 * @returns {HTMLAudioElement}
 * @package
 */
runeos.media.Sounds.prototype.m_getResource = function(name) {
    var asset = this.m_assets[name];
    if (this.m_disposed || !asset || !asset.ready) throw new Error("Audio resource is not ready: " + name);
    return asset.element;
};

/**
 * Combines host, focus and manual channel pause state.
 *
 * @param {runeos.media.SoundChannel} channel Voice channel.
 *
 * @returns {boolean}
 * @package
 */
runeos.media.Sounds.prototype.m_canPlay = function(channel) {
    return !this.m_disposed && this.m_enabled && this.m_focused &&
        !channel.paused && !this.m_master.paused;
};

/**
 * Pauses or resumes intended playback without changing manual pause flags.
 *
 * @returns {undefined}
 * @package
 */
runeos.media.Sounds.prototype.m_syncPlayback = function() {
    for (var i = 0; i < this.m_channels.length; i++) this.m_channels[i].m_syncPlayback();
};

/**
 * Applies master and channel rate changes to every existing voice.
 *
 * @returns {undefined}
 * @package
 */
runeos.media.Sounds.prototype.m_updateRates = function() {
    for (var i = 0; i < this.m_channels.length; i++) this.m_channels[i].m_updateRates();
};

/**
 * Stops media, removes its URL and aborts further network/decoder work.
 *
 * @param {HTMLAudioElement} element Media element to release.
 *
 * @returns {undefined}
 * @package
 */
runeos.media.Sounds.prototype.m_releaseElement = function(element) {
    if (!element) return;
    element.pause();
    element.removeAttribute("src");
    element.load();
};

/**
 * Registers playback and focus handlers in the owned event collection.
 *
 * @returns {undefined}
 * @private
 */
runeos.media.Sounds.prototype.m_constructEvents = function() {
    var sounds = this;
    function unlock() {
        sounds.unlock().catch(function() {});
    }
    this.m_events.add(window, "pointerdown", unlock, true);
    this.m_events.add(window, "keydown", unlock, true);
    this.m_events.add(window, "touchend", unlock, true);
    this.m_events.add(window, "blur", function() {
        sounds.m_focused = false;
        sounds.m_syncPlayback();
    });
    this.m_events.add(window, "focus", function() {
        sounds.m_focused = true;
        sounds.m_syncPlayback();
    });
};
