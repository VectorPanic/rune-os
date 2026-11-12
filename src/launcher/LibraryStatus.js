//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new LibraryStatus instance.
 *
 * @constructor
 *
 * @class
 * @classdesc
 *
 * Selects manual-sync feedback and empty-library guidance from explicit state.
 * Owns no runtime, configuration, notification or synchronization resources.
 */
runeos.launcher.LibraryStatus = function() {};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Describes manual synchronization without changing the coordinator or UI.
 *
 * @param {Object} sync Current synchronization state, or null.
 * @param {Object} messages Configured English notification text.
 *
 * @returns {{pending: boolean, persistent: boolean, message: ?string}} Presentation decision.
 */
runeos.launcher.LibraryStatus.prototype.manual = function(sync, messages) {
    if (!sync) return {pending: false, persistent: false, message: null};
    var active = sync.state !== "idle" && sync.state !== "disposed";
    if (!active || (sync.error && sync.state === "refresh")) {
        return {pending: false, persistent: false, message: sync.error ? messages.syncError : messages.libraryUpToDate};
    }
    var updating = ["ready", "publishing", "refresh", "refreshing"].indexOf(sync.state) !== -1;
    return {pending: true, persistent: true, message: updating ? messages.updatingLibrary : messages.syncingLibrary};
};

/**
 * Selects guidance when the current catalog has no selectable games.
 *
 * @param {boolean} hasGames Whether unfiltered games exist.
 * @param {Object} sync Current synchronization state, or null.
 * @param {Object} settings Sync enablement settings.
 * @param {Object} messages Configured notification text.
 *
 * @returns {string} Filtered, local or online guidance.
 */
runeos.launcher.LibraryStatus.prototype.empty = function(hasGames, sync, settings, messages) {
    if (hasGames) return messages.noAvailableGames;
    if (!settings.enabled || !settings.apiEnabled || !sync) return messages.emptyLibrary;
    return this.m_online(sync, messages);
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Gives an active retry precedence over the previous attempt's failure.
 *
 * @param {Object} sync Current synchronization state.
 * @param {Object} messages Configured notification text.
 *
 * @returns {string} Active, failed or empty online-library guidance.
 * @private
 */
runeos.launcher.LibraryStatus.prototype.m_online = function(sync, messages) {
    var active = ["checking", "staging", "publishing", "refreshing"].indexOf(sync.state) !== -1;
    if (active) return messages.syncingLibrary;
    if (sync.error) return messages.syncError;
    var pending = ["available", "ready", "refresh"].indexOf(sync.state) !== -1;
    return pending ? messages.syncingLibrary : messages.emptySyncedLibrary;
};
