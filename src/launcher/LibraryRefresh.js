//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new LibraryRefresh instance.
 *
 * @constructor
 * @param {runeos.library.Library} library Borrowed local content provider.
 * @param {Object} [environment] Native change tracking, when available.
 *
 * @class
 * @classdesc
 *
 * Serializes explicit library refreshes and remembers the last applied native
 * revision. Callers choose a safe presentation boundary; this controller never
 * changes scenes, reads executable contents or owns the library.
 */
runeos.launcher.LibraryRefresh = function(library, environment) {
    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    /**
     * Whether native changes can be checked on scene reentry.
     *
     * @type {boolean}
     */
    this.watching = Boolean(environment && environment.libraryRevision);

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Borrowed provider.
     *
     * @type {runeos.library.Library}
     * @private
     */
    this.m_library = library;

    /**
     * Optional native revision reader.
     *
     * @type {Object}
     * @private
     */
    this.m_environment = environment || null;

    /**
     * Last completely refreshed revision.
     *
     * @type {number}
     * @private
     */
    this.m_revision = 0;

    /**
     * Shared refresh operation, preventing overlapping file requests.
     *
     * @type {Promise}
     * @private
     */
    this.m_pending = null;
};

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Refreshes changed content, or forces a scan for manual requests. Failed
 * revisions remain pending for the next safe boundary.
 *
 * @param {boolean} [force=false] Whether to scan even without a native change.
 *
 * @returns {Promise.<Object>} New catalog, or null when nothing changed.
 */
runeos.launcher.LibraryRefresh.prototype.refresh = function(force) {
    if (this.m_pending) return this.m_pending;
    if (!this.m_library) return Promise.resolve(null);
    var controller = this;
    var operation = this.m_readRevision(force).then(function(revision) {
        return controller.m_refreshRevision(revision, force);
    });
    this.m_pending = this.m_finishRefresh(operation);
    return this.m_pending;
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Reads the native revision. Manual scans can continue when tracking is
 * unavailable; automatic refreshes retain the original error.
 *
 * @param {boolean} [force=false] Whether an explicit scan may bypass tracking errors.
 *
 * @returns {Promise.<number>} Revision to associate with the loaded content.
 * @private
 */
runeos.launcher.LibraryRefresh.prototype.m_readRevision = function(force) {
    var controller = this;
    var environment = this.m_environment;
    return Promise.resolve().then(function() {
        return environment && environment.libraryRevision ? environment.libraryRevision() : 0;
    }).catch(function(error) {
        if (!force) throw error;
        return controller.m_revision;
    });
};

/**
 * Reloads changed content and records its revision only after both lists are
 * ready. Changes detected during loading remain available for a later refresh.
 *
 * @param {number} revision Native revision observed before loading.
 * @param {boolean} [force=false] Whether unchanged content must also be reloaded.
 *
 * @returns {Promise.<Object>} Refreshed catalog, or null when unchanged.
 * @private
 */
runeos.launcher.LibraryRefresh.prototype.m_refreshRevision = function(revision, force) {
    if (!force && revision === this.m_revision) return Promise.resolve(null);
    var controller = this;
    return this.m_reload().then(function(catalog) {
        controller.m_revision = revision;
        return catalog;
    });
};

/**
 * Releases the shared pending operation after success or failure, preserving
 * its result so callers can apply the catalog or present the original error.
 *
 * @param {Promise.<Object>} operation Revision check and optional content reload.
 *
 * @returns {Promise.<Object>} Settled refresh result.
 * @private
 */
runeos.launcher.LibraryRefresh.prototype.m_finishRefresh = function(operation) {
    var controller = this;
    return operation.then(function(catalog) {
        controller.m_pending = null;
        return catalog;
    }, function(error) {
        controller.m_pending = null;
        throw error;
    });
};

/**
 * Refreshes independent content lists before handing the catalog to the UI.
 * Each provider retains its last valid list on failure.
 *
 * @returns {Promise.<Object>} Refreshed catalog.
 * @private
 */
runeos.launcher.LibraryRefresh.prototype.m_reload = function() {
    var library = this.m_library;
    return library.refreshScreensavers().then(function() {
        return library.refreshCatalog();
    });
};
