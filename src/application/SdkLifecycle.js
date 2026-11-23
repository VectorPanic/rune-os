//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Provides lifecycle operations for hosted Rune SDK applications.
 *
 * @constructor
 * @class
 * @classdesc
 *
 * Uses the hosted SDK API and handles legacy bundles whose frame clock and
 * asynchronous shutdown must be accessed through internal fields.
 */
runeos.application.SdkLifecycle = function() {};

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * The hosted application methods and the fields needed by legacy bundles.
 *
 * @typedef {{
 *     tick: (Function|undefined),
 *     stop: (Function|undefined),
 *     m_time: (Object|null|undefined),
 *     m_screen: (Object|null|undefined),
 *     m_callback: (Function|null|undefined)
 * }}
 */
runeos.application.SdkLifecycle.Instance;

//------------------------------------------------------------------------------
// Public static methods
//------------------------------------------------------------------------------

/**
 * Advances the hosted application by one frame.
 *
 * @param {runeos.application.SdkLifecycle.Instance} app Running application.
 * @returns {undefined}
 */
runeos.application.SdkLifecycle.tick = function(app) {
    if (typeof app.tick === "function") app.tick();
    else if (app.m_time) app.m_time.m_tick();
};

/**
 * Stops the application and completes once the SDK releases the screen.
 *
 * @param {?runeos.application.SdkLifecycle.Instance} app Application to stop.
 * @param {function():void} onStopped Host cleanup callback.
 * @returns {undefined}
 */
runeos.application.SdkLifecycle.stop = function(app, onStopped) {
    if (!app || typeof app.stop !== "function") {
        onStopped();
        return;
    }

    var completed = false;
    var timer = null;
    function finish() {
        if (completed) return;
        completed = true;
        if (timer !== null) window.clearTimeout(timer);
        // Some legacy bundles retain the callback after disposing.
        if (app.m_callback === finish) app.m_callback = null;
        onStopped();
    }

    try {
        app.stop(finish);
        if (!completed) {
            // Legacy bundles queue disposal without invoking the callback.
            timer = window.setTimeout(function() {
                timer = null;
                if (app.m_time === null && app.m_screen === null) finish();
            }, 0);
        }
    } catch (error) {
        finish();
    }
};
