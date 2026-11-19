//------------------------------------------------------------------------------
// Constructor scope
//------------------------------------------------------------------------------

/**
 * Creates a new FileLoader instance.
 *
 * @constructor
 *
 * @param {Object} [options] Optional request timeout in milliseconds.
 *
 * @class
 * @classdesc
 *
 * Owns asynchronous text, JSON and binary requests using the same transport for
 * launcher-relative paths, file URLs and HTTP(S) URLs. Completed and cancelled
 * requests release their callbacks before notifying their consumer.
 */
runeos.util.FileLoader = function(options) {

    //--------------------------------------------------------------------------
    // Default arguments
    //--------------------------------------------------------------------------

    options = options || {};

    //--------------------------------------------------------------------------
    // Public properties
    //--------------------------------------------------------------------------

    var config = runeos.system.Config.getGroup("loading", options.config);

    /**
     * Request timeout in milliseconds. Zero disables the timeout.
     *
     * @type {number}
     * @default 15000
     */
    this.timeout = options.timeout === undefined ? config.timeoutMs : options.timeout;
    if (typeof this.timeout !== "number" || !isFinite(this.timeout) ||
        this.timeout < 0 || Math.floor(this.timeout) !== this.timeout) {
        throw new RangeError("Invalid file request timeout.");
    }

    //--------------------------------------------------------------------------
    // Private properties
    //--------------------------------------------------------------------------

    /**
     * Pending native requests and their completion callbacks.
     *
     * @type {Array.<Object>}
     * @private
     */
    this.m_requests = [];

    /**
     * Whether this loader has been permanently released.
     *
     * @type {boolean}
     * @private
     */
    this.m_disposed = false;
};

//------------------------------------------------------------------------------
// Public static types
//------------------------------------------------------------------------------

/**
 * Native metadata capability supplied by the Electron preload bridge.
 *
 * @typedef {{fileInfo:Function}}
 */
runeos.util.FileLoader.MetadataProvider;

//------------------------------------------------------------------------------
// Public prototype getter and setter methods
//------------------------------------------------------------------------------

/**
 * Number of pending requests owned by this loader.
 *
 * @member {number} length
 * @memberof runeos.util.FileLoader
 * @instance
 * @readonly
 */
Object.defineProperty(runeos.util.FileLoader.prototype, "length", {
    /**
     * @this runeos.util.FileLoader
     * @returns {number}
     * @ignore
     */
    get : function() {
        return this.m_requests.length;
    }
});

//------------------------------------------------------------------------------
// Public prototype methods (API)
//------------------------------------------------------------------------------

/**
 * Reads a UTF-8 text resource without executing its contents.
 *
 * @param {string} url Resource path or URL.
 * @param {Function} onLoad Receives the loaded text.
 * @param {Function} onError Receives a request Error.
 *
 * @returns {?(XMLHttpRequest|Object)} Native request handle, or null on creation failure.
 */
runeos.util.FileLoader.prototype.text = function(url, onLoad, onError) {
    return this.m_load(url, "text", onLoad, onError);
};

/**
 * Reads and parses a JSON document using the shared transport.
 *
 * @param {string} url Resource path or URL.
 * @param {Function} onLoad Receives the parsed JSON value.
 * @param {Function} onError Receives a request or parsing Error.
 *
 * @returns {?(XMLHttpRequest|Object)} Native request handle, or null on creation failure.
 */
runeos.util.FileLoader.prototype.json = function(url, onLoad, onError) {
    return this.m_load(url, "json", onLoad, onError);
};

/**
 * Reads binary bytes for future package or asset preparation.
 *
 * @param {string} url Resource path or URL.
 * @param {Function} onLoad Receives an ArrayBuffer.
 * @param {Function} onError Receives a request Error.
 *
 * @returns {?(XMLHttpRequest|Object)} Native request handle, or null on creation failure.
 */
runeos.util.FileLoader.prototype.binary = function(url, onLoad, onError) {
    return this.m_load(url, "arraybuffer", onLoad, onError);
};

/**
 * Checks availability and size without reading or compiling text contents.
 * Local Electron files use library-scoped metadata; HTTP uses HEAD.
 *
 * @param {string} url Resource path or URL.
 * @param {Function} onLoad Receives metadata with size, or null size if unknown.
 * @param {Function} onError Receives a request Error.
 *
 * @returns {Object} Cancellable request handle.
 */
runeos.util.FileLoader.prototype.probe = function(url, onLoad, onError) {
    return this.m_load(url, "probe", onLoad, onError);
};

/**
 * Cancels a pending request. Completion is delivered exactly once.
 *
 * @param {XMLHttpRequest} request Handle returned by text, json or binary.
 *
 * @returns {undefined}
 */
runeos.util.FileLoader.prototype.cancel = function(request) {
    for (var i = 0; i < this.m_requests.length; i++) {
        var entry = this.m_requests[i];
        if (entry.request !== request) continue;
        this.m_detach(request);
        try {
            request.abort();
        } finally {
            this.m_finish(entry, this.m_error(entry.url, "ABORT", "Loading cancelled"));
        }
        return;
    }
};

/**
 * Cancels pending requests while allowing later reuse of this loader.
 *
 * @returns {undefined}
 */
runeos.util.FileLoader.prototype.clear = function() {
    var requests = this.m_requests.slice();
    var failure = null;
    for (var i = 0; i < requests.length; i++) {
        try {
            this.cancel(requests[i].request);
        } catch (error) {
            if (!failure) failure = error;
        }
    }
    if (failure) throw failure;
};

/**
 * Cancels all requests and prevents future loading.
 *
 * @returns {undefined}
 */
runeos.util.FileLoader.prototype.dispose = function() {
    if (this.m_disposed) return;
    this.m_disposed = true;
    this.clear();
};

//------------------------------------------------------------------------------
// Private prototype methods
//------------------------------------------------------------------------------

/**
 * Creates one request and applies the common success, error and cleanup rules.
 *
 * @param {string} url Resource URL.
 * @param {string} type Text, JSON, arraybuffer or probe response mode.
 * @param {Function} onLoad Completion callback.
 * @param {Function} onError Failure callback.
 *
 * @returns {?(XMLHttpRequest|Object)} Native request or cancellable probe handle.
 * @private
 */
runeos.util.FileLoader.prototype.m_load = function(url, type, onLoad, onError) {
    if (this.m_disposed) throw new Error("FileLoader is disposed.");
    if (typeof url !== "string" || !url.trim()) throw new TypeError("Expected a resource URL.");
    if (typeof onLoad !== "function" || typeof onError !== "function") {
        throw new TypeError("FileLoader requires success and error callbacks.");
    }
    var request;
    try {
        url = runeos.util.Paths.resolve(url);
        var environment = typeof window !== "undefined" && window.runeosEnvironment;
        if (type === "probe" && /^file:/i.test(url) && environment && typeof environment.fileInfo === "function") {
            return this.m_probeNative(url, environment, onLoad, onError);
        }
        request = new XMLHttpRequest();
    } catch (error) {
        onError(this.m_error(url, "REQUEST", error.message));
        return null;
    }
    var entry = {
        request: request,
        url: url,
        onLoad: onLoad,
        onError: onError,
        finished: false
    };
    this.m_requests.push(entry);
    this.m_bindRequest(entry, type);
    try {
        this.m_sendRequest(entry, type);
    } catch (error) {
        if (entry.finished) throw error;
        this.m_finish(entry, this.m_error(url, "REQUEST", error.message));
    }
    return request;
};

/**
 * Connects transport events to the shared completion and error paths.
 *
 * @param {Object} entry Owned request record.
 * @param {string} type Text, JSON, arraybuffer or probe response mode.
 *
 * @returns {undefined}
 * @private
 */
runeos.util.FileLoader.prototype.m_bindRequest = function(entry, type) {
    var loader = this;
    var request = entry.request;
    request.onload = function() { loader.m_receive(entry, type); };
    request.onerror = function() {
        loader.m_finish(entry, loader.m_error(entry.url, "NETWORK", "Could not load resource"));
    };
    request.ontimeout = function() {
        loader.m_finish(entry, loader.m_error(entry.url, "TIMEOUT", "Loading timed out"));
    };
    request.onabort = function() {
        loader.m_finish(entry, loader.m_error(entry.url, "ABORT", "Loading cancelled"));
    };
};

/**
 * Configures and sends the transport, including bounded local file probes.
 *
 * @param {Object} entry Owned request record.
 * @param {string} type Text, JSON, arraybuffer or probe response mode.
 *
 * @returns {undefined}
 * @private
 */
runeos.util.FileLoader.prototype.m_sendRequest = function(entry, type) {
    var loader = this;
    var request = entry.request;
    var url = entry.url;
    var localProbe = type === "probe" && /^file:/i.test(url);
    request.open(type === "probe" && !localProbe ? "HEAD" : "GET", url, true);
    request.timeout = this.timeout;
    if (type === "arraybuffer" || type === "probe") request.responseType = "arraybuffer";
    if (localProbe) {
        // Browser-only fallback: stop at the first byte-progress event.
        // Chromium's file transport ignores HEAD and otherwise loads the whole file.
        request.onprogress = function(event) {
            if (entry.finished || event.loaded <= 0) return;
            var value = {size: event.lengthComputable ? event.total : null};
            loader.m_detach(request);
            request.abort();
            loader.m_finish(entry, null, value);
        };
    }
    request.send();
};

/**
 * Checks response status and reports decoding failures before notifying consumers.
 *
 * @param {Object} entry Owned request record.
 * @param {string} type Text, JSON, arraybuffer or probe response mode.
 *
 * @returns {undefined}
 * @private
 */
runeos.util.FileLoader.prototype.m_receive = function(entry, type) {
    if (entry.finished) return;
    var request = entry.request;
    var url = entry.url;
    if ((request.status < 200 || request.status >= 300) && request.status !== 0) {
        this.m_finish(entry, this.m_error(url, "HTTP", "HTTP " + request.status, request.status));
        return;
    }
    var value;
    try {
        value = this.m_readResponse(request, url, type);
    } catch (error) {
        this.m_finish(entry, this.m_error(url, "PARSE", error.message, request.status));
        return;
    }
    this.m_finish(entry, null, value);
};

/**
 * Decodes a completed response without changing request state or invoking callbacks.
 *
 * @param {XMLHttpRequest} request Completed transport.
 * @param {string} url Absolute resource URL.
 * @param {string} type Text, JSON, arraybuffer or probe response mode.
 *
 * @returns {*}
 * @private
 */
runeos.util.FileLoader.prototype.m_readResponse = function(request, url, type) {
    if (type === "probe") return this.m_probeResult(request, url);
    if (type === "arraybuffer") return request.response;
    if (type === "json") return JSON.parse(request.responseText);
    return request.responseText;
};

/**
 * Checks local file metadata through the restricted Electron bridge.
 *
 * @param {string} url Absolute file URL.
 * @param {runeos.util.FileLoader.MetadataProvider} environment Native metadata provider.
 * @param {Function} onLoad Completion callback.
 * @param {Function} onError Failure callback.
 *
 * @returns {Object} Cancellable metadata request handle.
 * @private
 */
runeos.util.FileLoader.prototype.m_probeNative = function(url, environment, onLoad, onError) {
    var loader = this;
    var request = {abort: function() {}};
    var entry = {
        request: request,
        url: url,
        onLoad: onLoad,
        onError: onError,
        finished: false
    };
    this.m_requests.push(entry);
    Promise.resolve().then(function() {
        if (!entry.finished) return environment.fileInfo(url);
    }).then(function(info) {
        if (!entry.finished) loader.m_finish(entry, null, info);
    }, function(error) {
        if (!entry.finished) loader.m_finish(entry, loader.m_error(url, "FILE", error.message));
    });
    return request;
};

/**
 * Extracts size metadata without decoding a response body as JavaScript text.
 *
 * @param {XMLHttpRequest} request Completed probe.
 * @param {string} url Absolute resource URL.
 *
 * @returns {Object} Size in bytes, or null when the server omits it.
 * @private
 */
runeos.util.FileLoader.prototype.m_probeResult = function(request, url) {
    if (/^file:/i.test(url)) return {size: request.response ? request.response.byteLength : 0};
    var header = typeof request.getResponseHeader === "function" ? request.getResponseHeader("Content-Length") : null;
    var size = header === null || header === "" ? null : Number(header);
    return {size: size !== null && isFinite(size) && size >= 0 ? size : null};
};

/**
 * Releases transport references before invoking the consumer callback.
 *
 * @param {Object} entry Owned request record.
 * @param {?Error} error Failure, or null on success.
 * @param {*} [value] Loaded response.
 *
 * @returns {undefined}
 * @private
 */
runeos.util.FileLoader.prototype.m_finish = function(entry, error, value) {
    if (entry.finished) return;
    entry.finished = true;
    this.m_detach(entry.request);
    var index = this.m_requests.indexOf(entry);
    if (index !== -1) this.m_requests.splice(index, 1);
    var callback = error ? entry.onError : entry.onLoad;
    entry.onError = null;
    entry.onLoad = null;
    entry.request = null;
    callback(error || value);
};

/**
 * Removes every transport callback, including cancellation handlers.
 *
 * @param {XMLHttpRequest} request Native transport.
 *
 * @returns {undefined}
 * @private
 */
runeos.util.FileLoader.prototype.m_detach = function(request) {
    request.onprogress = null;
    request.onabort = null;
    request.ontimeout = null;
    request.onerror = null;
    request.onload = null;
};

/**
 * Creates a consistent transport error for both local and remote resources.
 *
 * @param {string} url Resource URL.
 * @param {string} code HTTP, NETWORK, TIMEOUT, ABORT, PARSE, FILE or REQUEST.
 * @param {string} message Failure description.
 * @param {number} [status=0] HTTP response status when available.
 *
 * @returns {Error} Error with code, url and status metadata.
 * @private
 */
runeos.util.FileLoader.prototype.m_error = function(url, code, message, status) {
    var error = new Error(url + ": " + message);
    error.code = code;
    error.url = url;
    error.status = status || 0;
    return error;
};
