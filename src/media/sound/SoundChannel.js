//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new SoundChannel instance.
 *
 * @constructor
 *
 * @param {runeos.media.Sounds} owner Audio system.
 * @param {boolean} shared Whether only reusable voices are allowed.
 *
 * @class
 * @classdesc
 *
 * Owns reusable or unique voices and a gain bus connected to the shared master.
 */
runeos.media.SoundChannel = function(owner, shared) {
    //--------------------------------------------------------------------------
    // Internal properties
    //--------------------------------------------------------------------------

    /**
     * Owning audio system.
     *
     * @type {runeos.media.Sounds}
     * @package
     */
    this.m_owner = owner;

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Whether unique voices are forbidden.
     *
     * @type {boolean}
     * @private
     */
    this.m_shared = shared === true;

    /**
     * Registered playback voices.
     *
     * @type {Array.<runeos.media.Sound>}
     * @private
     */
    this.m_sounds = [];

    /**
     * Lazily created channel output.
     *
     * @type {GainNode}
     * @private
     */
    this.m_gain = null;

    /**
     * Channel volume.
     *
     * @type {number}
     * @private
     */
    this.m_volume = 1;

    /**
     * Whether output is muted.
     *
     * @type {boolean}
     * @private
     */
    this.m_muted = false;

    /**
     * Channel playback-rate multiplier.
     *
     * @type {number}
     * @private
     */
    this.m_rate = 1;

    /**
     * Manual channel pause independent of OS suspension.
     *
     * @type {boolean}
     * @private
     */
    this.m_paused = false;

    /**
     * Whether the channel has been released.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;

    /**
     * Owned channel-volume fades.
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
 * Number of registered voices.
 *
 * @member {number} length
 * @memberof runeos.media.SoundChannel
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.SoundChannel.prototype, "length", {
    /**
     * @this runeos.media.SoundChannel
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_sounds.length;
    }
});

/**
 * Whether only shared voices are permitted.
 *
 * @member {boolean} shared
 * @memberof runeos.media.SoundChannel
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.SoundChannel.prototype, "shared", {
    /**
     * @this runeos.media.SoundChannel
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_shared;
    }
});

/**
 * Shared OS audio context, created on demand.
 *
 * @member {AudioContext} context
 * @memberof runeos.media.SoundChannel
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.media.SoundChannel.prototype, "context", {
    /**
     * @this runeos.media.SoundChannel
     * @returns {AudioContext}
     * @ignore
     */
    get : function() {
        return this.m_owner.m_getContext();
    }
});

/**
 * Volume from zero to one. Master volume also affects the other channels.
 *
 * @member {number} volume
 * @memberof runeos.media.SoundChannel
 * @instance
 */
Object.defineProperty(runeos.media.SoundChannel.prototype, "volume", {
    /**
     * @this runeos.media.SoundChannel
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_volume;
    },

    /**
     * @this runeos.media.SoundChannel
     * @ignore
     */
    set : function(value) {
        this.m_volume = runeos.media.Sounds.m_clamp(value, 0, 1);
        this.m_updateGain();
    }
});

/**
 * Mutes output without losing playback position.
 *
 * @member {boolean} muted
 * @memberof runeos.media.SoundChannel
 * @instance
 */
Object.defineProperty(runeos.media.SoundChannel.prototype, "muted", {
    /**
     * @this runeos.media.SoundChannel
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_muted;
    },

    /**
     * @this runeos.media.SoundChannel
     * @ignore
     */
    set : function(value) {
        this.m_muted = Boolean(value);
        this.m_updateGain();
    }
});

/**
 * Playback-rate multiplier from 0.25 to 4.
 *
 * @member {number} rate
 * @memberof runeos.media.SoundChannel
 * @instance
 */
Object.defineProperty(runeos.media.SoundChannel.prototype, "rate", {
    /**
     * @this runeos.media.SoundChannel
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_rate;
    },

    /**
     * @this runeos.media.SoundChannel
     * @ignore
     */
    set : function(value) {
        this.m_rate = runeos.media.Sounds.m_clamp(value, 0.25, 4);
        this.m_owner.m_updateRates();
    }
});

/**
 * Manual pause state, retained while apps execute.
 *
 * @member {boolean} paused
 * @memberof runeos.media.SoundChannel
 * @instance
 */
Object.defineProperty(runeos.media.SoundChannel.prototype, "paused", {
    /**
     * @this runeos.media.SoundChannel
     * @returns {boolean}
     * @ignore
     */
    get : function() {
        return this.m_paused;
    },

    /**
     * @this runeos.media.SoundChannel
     * @ignore
     */
    set : function(value) {
        this.m_paused = Boolean(value);
        this.m_owner.m_syncPlayback();
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Returns a shared voice or a unique one-shot voice for a preloaded resource.
 *
 * @param {string} name Resource identifier.
 * @param {boolean} [unique=false] Whether concurrent playback needs its own voice.
 *
 * @returns {runeos.media.Sound}
 */
runeos.media.SoundChannel.prototype.get = function(name, unique) {
    if (this.m_disposed) throw new Error("SoundChannel is disposed.");
    this.m_owner.m_getResource(name);
    unique = !this.m_shared && unique === true;
    if (!unique) {
        for (var i = 0; i < this.m_sounds.length; i++) {
            if (this.m_sounds[i]["name"] === name && !this.m_sounds[i]["unique"]) return this.m_sounds[i];
        }
    }
    var sound = new runeos.media.Sound(this, name, unique);
    this.m_sounds.push(sound);
    return sound;
};

/**
 * Unregisters a voice and optionally releases it.
 *
 * @param {runeos.media.Sound} sound Voice to remove.
 * @param {boolean} [dispose=true] Whether to dispose the removed voice.
 *
 * @returns {undefined}
 */
runeos.media.SoundChannel.prototype.remove = function(sound, dispose) {
    var index = this.m_sounds.indexOf(sound);
    if (index === -1) return;
    this.m_sounds.splice(index, 1);
    if (dispose !== false) sound.dispose();
};

/**
 * Disposes all owned voices, retaining channel settings and loaded resources.
 *
 * @returns {undefined}
 */
runeos.media.SoundChannel.prototype.clear = function() {
    while (this.m_sounds.length > 0) this.m_sounds.pop().dispose();
};

/**
 * Stops all voices without disposing shared playback objects.
 *
 * @returns {undefined}
 */
runeos.media.SoundChannel.prototype.stop = function() {
    for (var i = 0; i < this.m_sounds.length; i++) this.m_sounds[i].stop();
};

/**
 * Manually pauses this channel.
 *
 * @returns {undefined}
 */
runeos.media.SoundChannel.prototype.pause = function() {
    this.paused = true;
};

/**
 * Resumes only voices that were intended to play before the channel paused.
 *
 * @returns {undefined}
 */
runeos.media.SoundChannel.prototype.resume = function() {
    this.paused = false;
};

/**
 * Replaces the current volume fade.
 *
 * @param {number} to Target volume from zero to one.
 * @param {number} duration Duration in milliseconds.
 *
 * @returns {undefined}
 */
runeos.media.SoundChannel.prototype.fade = function(to, duration) {
    this.m_tweens.replace({
        target: this,
        args: {volume: runeos.media.Sounds.m_clamp(to, 0, 1)},
        duration: duration
    });
};

/**
 * Updates channel and voice fades.
 *
 * @param {number} step Elapsed milliseconds.
 *
 * @returns {undefined}
 */
runeos.media.SoundChannel.prototype.update = function(step) {
    if (this.m_disposed) return;
    this.m_tweens.update(step);
    var sounds = this.m_sounds.slice();
    for (var i = 0; i < sounds.length; i++) sounds[i].update(step);
};

/**
 * Releases voices, fades and channel output.
 *
 * @returns {undefined}
 */
runeos.media.SoundChannel.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.clear();
    this.m_tweens.dispose();
    if (this.m_gain) this.m_gain.disconnect();
    this.m_gain = null;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Connects this bus to master, or master to the audio destination.
 *
 * @returns {!GainNode}
 * @package
 */
runeos.media.SoundChannel.prototype.m_getOutput = function() {
    if (this.m_disposed) throw new Error("SoundChannel is disposed.");
    if (!this.m_gain) {
        var context = this.m_owner.m_getContext();
        var gain = context.createGain();
        try {
            gain.connect(this === this.m_owner["master"] ? context.destination : this.m_owner["master"].m_getOutput());
        } catch (error) {
            gain.disconnect();
            throw error;
        }
        this.m_gain = gain;
        this.m_updateGain();
    }
    return this.m_gain;
};

/**
 * Applies volume/mute to a bus that has already been created.
 *
 * @returns {undefined}
 * @private
 */
runeos.media.SoundChannel.prototype.m_updateGain = function() {
    if (this.m_gain) this.m_gain.gain.value = this.m_muted ? 0 : this.m_volume;
};

/**
 * Synchronizes voices with combined manual/host pause state.
 *
 * @returns {undefined}
 * @package
 */
runeos.media.SoundChannel.prototype.m_syncPlayback = function() {
    for (var i = 0; i < this.m_sounds.length; i++) this.m_sounds[i].m_syncPlayback();
};

/**
 * Applies rate changes without recreating playback nodes.
 *
 * @returns {undefined}
 * @package
 */
runeos.media.SoundChannel.prototype.m_updateRates = function() {
    for (var i = 0; i < this.m_sounds.length; i++) this.m_sounds[i].m_applyProperties();
};

/**
 * Disposes every voice referring to an unloaded resource.
 *
 * @param {string} name Resource identifier.
 *
 * @returns {undefined}
 * @package
 */
runeos.media.SoundChannel.prototype.m_removeResource = function(name) {
    for (var i = this.m_sounds.length - 1; i >= 0; i--) {
        if (this.m_sounds[i]["name"] === name) this.remove(this.m_sounds[i]);
    }
};
