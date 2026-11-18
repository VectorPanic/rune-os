const {settings} = require('./manifest.cjs');

const MAX_BYTES = 65536;
const TIMEOUT_MS = 3500;

/** Owns bounded highscore requests for a single Rune OS window. */
class HighscoreService {
    constructor() {
        this.baseUrl = null;
        this.active = null;
        this.disposed = false;
    }

    configure(options) {
        if (this.disposed || !options || typeof options.highscoresEnabled !== 'boolean') throw Error('Invalid highscore settings.');
        this.baseUrl = options.highscoresEnabled ? settings({baseUrl: options.baseUrl}).baseUrl : null;
    }

    async sync(appId, tables) {
        if (this.disposed || !this.baseUrl || this.active) throw Error('Highscore synchronization unavailable.');
        if (typeof appId !== 'string' || appId.length > 100 || !/^[a-z]{2,3}\.[a-z0-9-]{1,50}\.[a-zA-Z0-9_-]+$/.test(appId) || !Array.isArray(tables)) {
            throw Error('Invalid highscore request.');
        }
        const body = JSON.stringify({appId, tables});
        if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) throw Error('Highscore request too large.');
        const controller = new AbortController();
        this.active = controller;
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(new URL('highscores/sync', this.baseUrl), {
                method: 'POST', redirect: 'error', cache: 'no-store',
                headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body, signal: controller.signal
            });
            if (!response.ok) {
                await response.body?.cancel();
                throw Error('Highscore sync HTTP ' + response.status);
            }
            const chunks = [];
            let size = 0;
            for await (const chunk of response.body) {
                size += chunk.length;
                if (size > MAX_BYTES) throw Error('Highscore response too large.');
                chunks.push(chunk);
            }
            const document = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)));
            if (!document || typeof document !== 'object' || !Array.isArray(document.tables)) throw Error('Invalid highscore response.');
            return document.tables;
        } finally {
            clearTimeout(timer);
            controller.abort();
            if (this.active === controller) this.active = null;
        }
    }

    dispose() {
        this.disposed = true;
        if (this.active) this.active.abort();
        this.baseUrl = null;
    }
}

module.exports = HighscoreService;
