//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new Sound instance.
 *
 * @constructor
 *
 * @param {runeos.media.SoundChannel} channel Owning channel.
 * @param {string} name Preloaded resource name.
 * @param {boolean} unique Whether natural completion releases this voice.
 *
 * @class
 * @classdesc
 *
 * Wraps an independently playable media element routed through the OS audio
 * graph.
 */
runeos.media.Sound = function(channel, name, unique) {
    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Owning channel.
     *
     * @type {runeos.media.SoundChannel}
     * @private
     */
    this.m_channel = channel;

    /**
     * Resource identifier.
     *
     * @type {string}
     * @private
     */
    this.m_name = name;

    /**
     * Whether this is an automatically released one-shot.
     *
     * @type {boolean}
     * @private
     */
    this.m_unique = unique === true;

    /**
     * Independent media playback element.
     *
     * @type {?HTMLAudioElement}
     * @private
     */
    this.m_element = channel.m_owner.m_getResource(name).cloneNode(true);

    /**
     * Media-element source, created once for this element.
     *
     * @type {MediaElementAudioSourceNode}
     * @private
     */
    this.m_source = null;

    /**
     * Voice-level volume/mute control.
     *
     * @type {GainNode}
     * @private
     */
    this.m_gain = null;

    /**
     * Optional stereo pan node.
     *
     * @type {StereoPannerNode}
     * @private
     */
    this.m_panner = null;

    /**
     * Voice volume.
     *
     * @type {number}
     * @private
     */
    this.m_volume = 1;

    /**
     * Voice mute flag.
     *
     * @type {boolean}
     * @private
     */
    this.m_muted = false;

    /**
     * Stereo position from -1 to 1.
     *
     * @type {number}
     * @private
     */
    this.m_pan = 0;

    /**
     * Playback rate multiplier.
     *
     * @type {number}
     * @private
     */
    this.m_rate = 1;

    /**
     * Whether speed changes preserve the original pitch.
     *
     * @type {boolean}
     * @private
     */
    this.m_preservesPitch = true;

    /**
     * Whether playback loops.
     *
     * @type {boolean}
     * @private
     */
    this.m_loop = false;

    /**
     * Playback intent retained through host/channel pauses.
     *
     * @type {boolean}
     * @private
     */
    this.m_wantsPlay = false;

    /**
     * Current native play request, if any.
     *
     * @type {Promise}
     * @private
     */
    this.m_pending = null;

    /**
     * Invalidates completions from previous playback requests.
     *
     * @type {number}
     * @private
     */
    this.m_generation = 0;

    /**
     * Last playback/decoder error.
     *
     * @type {Error}
     * @private
     */
    this.m_error = null;

    /**
     * Whether native playback resources have been released.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    /**
     * Owned media-event subscriptions.
     *
     * @type {runeos.util.EventBindings}
     * @private
     */
    this.m_events = new runeos.util.EventBindings();

    /**
     * Owned voice fades.
     *
     * @type {runeos.tween.Tweens}
     * @private
     */
    this.m_tweens = new runeos.tween.Tweens();
    //--------------------------------------------------------------------------
    // Constructor call
    //--------------------------------------------------------------------------

    /**
     * Registers event handlers owned by this instance.
     */
    this.m_construct();
};

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Resource name.
 *
 * @member {string} name
 * @memberof runeos.media.Sound
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sound.prototype, "name", {
    /**
     * @this runeos.media.Sound
     * @returns {string}
     * @ignore
     */
    get : function() {
        return this.m_name;
    }
});

/**
 * Owning channel.
 *
 * @member {runeos.media.SoundChannel} channel
 * @memberof runeos.media.Sound
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sound.prototype, "channel", {
    /**
     * @this runeos.media.Sound
     * @returns {runeos.media.SoundChannel}
     * @ignore
     */
    get : function() {
        return this.m_channel;
    }
});

/**
 * Whether the voice is automatically released after completion.
 *
 * @member {boolean} unique
 * @memberof runeos.media.Sound
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sound.prototype, "unique", {
    /**
     * @this runeos.media.Sound
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_unique;
    }
});

/**
 * Whether native media playback is paused.
 *
 * @member {boolean} paused
 * @memberof runeos.media.Sound
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sound.prototype, "paused", {
    /**
     * @this runeos.media.Sound
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return !this.m_element || this.m_element.paused;
    }
});

/**
 * Whether native playback reached its end.
 *
 * @member {boolean} ended
 * @memberof runeos.media.Sound
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sound.prototype, "ended", {
    /**
     * @this runeos.media.Sound
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return Boolean(this.m_element && this.m_element.ended);
    }
});

/**
 * Most recent playback error, or null.
 *
 * @member {Error} error
 * @memberof runeos.media.Sound
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sound.prototype, "error", {
    /**
     * @this runeos.media.Sound
     * @returns {Error}
     * @ignore
     */
    get : function() {
        return this.m_error;
    }
});

/**
 * Loaded playback duration in seconds, or zero when unavailable.
 *
 * @member {number} duration
 * @memberof runeos.media.Sound
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.Sound.prototype, "duration", {
    /**
     * @this runeos.media.Sound
     * @returns {number}
     * @ignore
     */
    get : function() {
        var duration = this.m_element ? this.m_element.duration : 0;
        return typeof duration === "number" && isFinite(duration) ? Math.max(0, duration) : 0;
    }
});

/**
 * Voice volume from zero to one.
 *
 * @member {number} volume
 * @memberof runeos.media.Sound
 * @instance
 */
Object.defineProperty(runeos.media.Sound.prototype, "volume", {
    /**
     * @this runeos.media.Sound
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_volume;
    },

    /**
     * @this runeos.media.Sound
     * @ignore
     */
    set : function(value) {
        this.m_volume = runeos.media.Sounds.m_clamp(value, 0, 1);
        this.m_applyProperties();
    }
});

/**
 * Voice mute flag.
 *
 * @member {boolean} muted
 * @memberof runeos.media.Sound
 * @instance
 */
Object.defineProperty(runeos.media.Sound.prototype, "muted", {
    /**
     * @this runeos.media.Sound
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_muted;
    },

    /**
     * @this runeos.media.Sound
     * @ignore
     */
    set : function(value) {
        this.m_muted = Boolean(value);
        this.m_applyProperties();
    }
});

/**
 * Stereo pan from -1 to 1.
 *
 * @member {number} pan
 * @memberof runeos.media.Sound
 * @instance
 */
Object.defineProperty(runeos.media.Sound.prototype, "pan", {
    /**
     * @this runeos.media.Sound
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_pan;
    },

    /**
     * @this runeos.media.Sound
     * @ignore
     */
    set : function(value) {
        this.m_pan = runeos.media.Sounds.m_clamp(value, -1, 1);
        this.m_applyProperties();
    }
});

/**
 * Whether playback-rate changes preserve pitch. Disable for pitched UI effects.
 *
 * @member {boolean} preservesPitch
 * @memberof runeos.media.Sound
 * @instance
 */
Object.defineProperty(runeos.media.Sound.prototype, "preservesPitch", {
    /**
     * @this runeos.media.Sound
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_preservesPitch;
    },
    /**
     * @this runeos.media.Sound
     * @ignore
     */
    set : function(value) {
        this.m_preservesPitch = Boolean(value);
        this.m_applyProperties();
    }
});

/**
 * Playback-rate multiplier from 0.25 to 4.
 *
 * @member {number} rate
 * @memberof runeos.media.Sound
 * @instance
 */
Object.defineProperty(runeos.media.Sound.prototype, "rate", {
    /**
     * @this runeos.media.Sound
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_rate;
    },

    /**
     * @this runeos.media.Sound
     * @ignore
     */
    set : function(value) {
        this.m_rate = runeos.media.Sounds.m_clamp(value, 0.25, 4);
        this.m_applyProperties();
    }
});

/**
 * Whether the media loops.
 *
 * @member {boolean} loop
 * @memberof runeos.media.Sound
 * @instance
 */
Object.defineProperty(runeos.media.Sound.prototype, "loop", {
    /**
     * @this runeos.media.Sound
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_loop;
    },

    /**
     * @this runeos.media.Sound
     * @ignore
     */
    set : function(value) {
        this.m_loop = Boolean(value);
        this.m_applyProperties();
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Requests playback. Browser rejections are recorded in error and resolve
 * false.
 *
 * @param {boolean} [restart=false] Whether to restart from the beginning.
 *
 * @returns {Promise}
 */
runeos.media.Sound.prototype.play = function(restart) {
    if (this.m_disposed) return Promise.resolve(false);
    if (restart) this.stop();
    this.m_wantsPlay = true;
    return this.m_syncPlayback();
};

/**
 * Pauses this voice manually; automatic OS resume will not restart it.
 *
 * @returns {undefined}
 */
runeos.media.Sound.prototype.pause = function() {
    if (this.m_disposed) return;
    this.m_wantsPlay = false;
    this.m_generation++;
    this.m_pending = null;
    this.m_element.pause();
};

/**
 * Resumes from the retained media position.
 *
 * @returns {Promise}
 */
runeos.media.Sound.prototype.resume = function() {
    return this.play(false);
};

/**
 * Cancels playback and rewinds without destroying the shared voice.
 *
 * @returns {undefined}
 */
runeos.media.Sound.prototype.stop = function() {
    if (this.m_disposed) return;
    this.pause();
    try { this.m_element.currentTime = 0; } catch (error) {}
};

/**
 * Replaces the current voice-volume fade.
 *
 * @param {number} to Target volume.
 * @param {number} duration Duration in milliseconds.
 *
 * @returns {undefined}
 */
runeos.media.Sound.prototype.fade = function(to, duration) {
    this.m_tweens.replace({
        target: this,
        args: {volume: runeos.media.Sounds.m_clamp(to, 0, 1)},
        duration: duration
    });
};

/**
 * Updates the voice-volume fade.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 */
runeos.media.Sound.prototype.update = function(step) {
    if (!this.m_disposed) this.m_tweens.update(step);
};

/**
 * Stops media and detaches every node, callback and channel reference.
 *
 * @returns {undefined}
 */
runeos.media.Sound.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.stop();
    this.m_disposed = true;
    this.m_events.dispose();
    this.m_tweens.dispose();
    if (this.m_source) this.m_source.disconnect();
    if (this.m_gain) this.m_gain.disconnect();
    if (this.m_panner) this.m_panner.disconnect();
    this.m_panner = null;
    this.m_gain = null;
    this.m_source = null;
    var channel = this.m_channel;
    channel.m_owner.m_releaseElement(this.m_element);
    this.m_element = null;
    this.m_channel = null;
    channel.remove(this, false);
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
runeos.media.Sound.prototype.m_construct = function() {
    this.m_constructEvents();
};

/**
 * Creates one media source per element and connects it to the channel bus.
 *
 * @returns {undefined}
 * @private
 */
runeos.media.Sound.prototype.m_constructGraph = function() {
    if (this.m_source) return;
    if (!this.m_element) throw Error("Sound is disposed.");
    try {
        var context = /** @type {!AudioContext} */ (this.m_channel["context"]);
        this.m_source = context.createMediaElementSource(this.m_element);
        this.m_gain = context.createGain();
        this.m_source.connect(this.m_gain);
        if (typeof context.createStereoPanner === "function") {
            var panner = context.createStereoPanner();
            this.m_panner = panner;
            this.m_gain.connect(panner);
            panner.connect(this.m_channel.m_getOutput());
        } else {
            this.m_gain.connect(this.m_channel.m_getOutput());
        }
        this.m_applyProperties();
    } catch (error) {
        // A failed partial graph cannot reuse the same media element source.
        this.dispose();
        throw error;
    }
};

/**
 * Applies current controls without allocating a new source.
 *
 * @returns {undefined}
 * @package
 */
runeos.media.Sound.prototype.m_applyProperties = function() {
    if (this.m_disposed || !this.m_element) return;
    this.m_element.loop = this.m_loop;
    var owner = this.m_channel.m_owner;
    var masterRate = this.m_channel === owner["master"] ? 1 : owner["master"].rate;
    this.m_element.preservesPitch = this.m_preservesPitch;
    if ("webkitPreservesPitch" in this.m_element) this.m_element["webkitPreservesPitch"] = this.m_preservesPitch;
    this.m_element.playbackRate = runeos.media.Sounds.m_clamp(this.m_rate * this.m_channel["rate"] * masterRate, 0.0625, 16);
    if (this.m_gain) this.m_gain.gain.value = this.m_muted ? 0 : this.m_volume;
    if (this.m_panner) this.m_panner.pan.value = this.m_pan;
};

/**
 * Combines playback intent with global/channel availability and handles stale
 * play promises.
 *
 * @returns {Promise}
 * @package
 */
runeos.media.Sound.prototype.m_syncPlayback = function() {
    if (this.m_disposed) return Promise.resolve(false);
    var owner = this.m_channel.m_owner;
    if (!this.m_wantsPlay || !owner.m_canPlay(this.m_channel)) {
        if (!this.m_element.paused || this.m_pending) {
            this.m_generation++;
            this.m_pending = null;
            this.m_element.pause();
        }
        return Promise.resolve(false);
    }
    if (this.m_pending) return this.m_pending;
    if (!this.m_element.paused) return Promise.resolve(true);
    var sound = this;
    var generation = ++this.m_generation;
    try {
        this.m_constructGraph();
        owner.unlock().catch(function() {});
        var request = this.m_element.play();
        this.m_pending = Promise.resolve(request).then(function() {
            if (sound.m_disposed || generation !== sound.m_generation) return false;
            sound.m_pending = null;
            sound.m_error = null;
            return sound.m_wantsPlay && owner.m_canPlay(sound.m_channel);
            }, function(error) {
            if (!sound.m_disposed && generation === sound.m_generation) {
                sound.m_pending = null;
                sound.m_error = error instanceof Error ? error : new Error(String(error));
                if (sound.m_unique) sound.dispose();
            }
            return false;
        });
    } catch (error) {
        this.m_error = error;
        if (this.m_unique) this.dispose();
        return Promise.resolve(false);
    }
    return this.m_pending;
};

/**
 * Registers playback and focus handlers in the owned event collection.
 *
 * @returns {undefined}
 * @private
 */
runeos.media.Sound.prototype.m_constructEvents = function() {
    var sound = this;
    this.m_events.add(this.m_element, "ended", function() {
        sound.m_wantsPlay = false;
        if (sound.m_unique) sound.dispose();
    });
    this.m_events.add(this.m_element, "error", function() {
        sound.m_error = new Error("Audio playback failed: " + sound.m_name);
        sound.stop();
        if (sound.m_unique) sound.dispose();
    });
};
