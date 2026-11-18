//------------------------------------------------------------------------------
// Namespace
//------------------------------------------------------------------------------

/**
 * The root namespace for Rune OS. Groups the components used to discover,
 * present and run Rune SDK applications on a shared output canvas.
 * Access OS classes through runeos and its package namespaces.
 *
 * @namespace runeos
 * @global
 *
 * @license
 * Copyright (c) 2026 Henrik Andersen
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
var runeos = function() {

    //--------------------------------------------------------------------------
    // Public static scope
    //--------------------------------------------------------------------------

    /**
     * Shared public namespace containing packages and runtime entry points.
     *
     * @type {Object}
     * @private
     */
    var m_this = {};

    //--------------------------------------------------------------------------
    // Package structure
    //--------------------------------------------------------------------------

    /**
     * Application launch requests, readiness checks and cancellation.
     * Also coordinates timed replacement of running screensavers.
     *
     * @namespace application
     * @memberof runeos
     */
    m_this.application = {};

    /**
     * Two-dimensional viewport positioning for OS scenes.
     * Converts scene coordinates for rendering and navigation.
     *
     * @namespace camera
     * @memberof runeos
     * @since 1.0
     */
    m_this.camera = {};

    /**
     * Game and category metadata, tag vocabularies and visibility rules.
     * Calculates category membership and relevance independently of the UI.
     *
     * @namespace catalog
     * @memberof runeos
     */
    m_this.catalog = {};

    /**
     * Adapts catalog data to the game-selection interface.
     * Coordinates Tile priorities, display labels, inactivity and library refresh.
     *
     * @namespace launcher
     * @memberof runeos
     */
    m_this.launcher = {};

    /**
     * Content-provider contracts and local game and screensaver discovery.
     * Loads metadata, resolves resource locations and checks installed content.
     *
     * @namespace library
     * @memberof runeos
     */
    m_this.library = {};

    /**
     * The display hierarchy, drawing buffers and shared output canvas.
     * Provides display groups, screen management and temporary pixel restoration.
     *
     * @namespace display
     * @memberof runeos
     * @since 1.0
     */
    m_this.display = {};

    /**
     * Keyboard and gamepad input with configurable device handling.
     * Tracks button states, directional navigation and user activity.
     *
     * @namespace input
     * @memberof runeos
     */
    m_this.input = {};

    /**
     * Audio loading and playback through a shared sound system.
     * Organizes channels, playback voices, volume and application suspension.
     *
     * @namespace media
     * @memberof runeos
     */
    m_this.media = {};

    /**
     * Scene lifecycle and transitions between OS screens.
     * Includes Boot, Launcher, hosted applications and screensavers.
     *
     * @namespace scene
     * @memberof runeos
     * @since 1.0
     */
    m_this.scene = {};

    /**
     * Provider contracts and scheduling for staged library updates.
     * Coordinates cancellable preparation and publication at safe boundaries.
     *
     * @namespace sync
     * @memberof runeos
     */
    m_this.sync = {};

    /**
     * OS startup, immutable configuration and the main runtime loop.
     * Coordinates shared input, audio, scenes, camera and output.
     *
     * @namespace system
     * @memberof runeos
     * @since 1.0
     */
    m_this.system = {};

    /**
     * Configuration copying and validation, independent of runtime components.
     *
     * @namespace config
     * @memberof runeos.system
     */
    m_this.system.config = {};

    /**
     * Time-based interpolation of numeric properties and easing functions.
     * Manages reusable animation collections and completed tween cleanup.
     *
     * @namespace tween
     * @memberof runeos
     */
    m_this.tween = {};

    /**
     * Reusable interface components rendered through the display hierarchy.
     * Includes category headings, notifications, dimming and transition feedback.
     *
     * @namespace ui
     * @memberof runeos
     */
    m_this.ui = {};

    /**
     * The Tilemap interface component and its owned presentation classes.
     * Packs Tiles, displays artwork and labels, and animates directional navigation.
     *
     * @namespace tilemap
     * @memberof runeos.ui
     */
    m_this.ui.tilemap = {};

    /**
     * Text fields, font loading and shared typography settings.
     * Measures labels and controls scrolling when text exceeds the available width.
     *
     * @namespace text
     * @memberof runeos
     */
    m_this.text = {};

    /**
     * Shared file loading, URL resolution, validation and calculation helpers.
     * Provides common operations used across independent runtime components.
     *
     * @namespace util
     * @memberof runeos
     */
    m_this.util = {};

    //--------------------------------------------------------------------------
    // Bootstrap
    //--------------------------------------------------------------------------

    /**
     * Creates the main runtime with optional configuration and content providers.
     * Runtime initialization starts when the document is ready.
     *
     * @param {Object} [options] Runtime settings, library provider and optional sync provider.
     *
     * @returns {runeos.system.Main} Created OS runtime.
     */
    m_this.bootstrap = function(options) {
        return new m_this.system.Main(options);
    };

    //--------------------------------------------------------------------------
    // Return public scope object
    //--------------------------------------------------------------------------

    /**
     * Exposes the package namespaces and bootstrap entry point.
     */
    return m_this;

}();

/**
 * Registers the namespace exported by a loaded application bundle.
 * The hosted execution scene uses its bootstrap method to start the application.
 *
 * @param {Object} application Exported namespace exposing a bootstrap method.
 *
 * @returns {undefined}
 */
runeos.install = function(application) {
    runeos.app = application;
};

/**
 * Requests synchronization for the currently running game's highscore tables.
 *
 * @param {string} id SDK application identifier.
 * @param {Object} highscores Active SDK highscore object.
 * @param {Function} callback Completion callback.
 * @returns {undefined}
 */
runeos.syncHighscores = function(id, highscores, callback) {
    var instance = runeos.instance;
    var scene = instance && instance.scenes && instance.scenes.current;
    if (scene && typeof scene.syncHighscores === "function") {
        scene.syncHighscores(id, highscores, callback);
    } else if (typeof callback === "function") {
        callback({success: false, updated: false});
    }
};
