//------------------------------------------------------------------------------
// Global scope aliases
//------------------------------------------------------------------------------

/**
 * Exposes Rune-OS to application bundles without overwriting an existing
 * namespace.
 */
if (typeof window !== "undefined") {
    if (typeof window.runeos === "undefined") {
        window.runeos = runeos;
    }
}
