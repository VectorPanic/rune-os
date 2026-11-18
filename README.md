# Rune OS

**Small games. Big nostalgia. Just press Start.**

Rune OS is an open-source desktop launcher designed to make games built with Rune SDK easy to discover, access, and play.

Inspired by the charm of classic desktop computing, arcade games, and the early days of interactive web entertainment, Rune OS brings small, independent games together in one dedicated interface.

Built with Electron, it runs on top of your existing operating system, offering an OS-inspired experience with animated tiles, gamepad navigation, screensavers, and a good old-fashioned boot sequence.

No accounts, no subscriptions, and no always-online requirements. Just free games, ready to play.

## Features

- **Pick up and play** — Browse and launch Rune SDK games from a single interface.
- **Classic desktop spirit** — An OS-inspired launcher with animated tiles, sound effects, and a boot sequence.
- **Keyboard & gamepad support** — Navigate and play using a keyboard or compatible controller.
- **Smart game discovery** — Games are automatically organized into categories using weighted metadata tags.
- **Screensavers** — Bring a little life to idle screens with rotating Rune SDK screensavers.
- **Offline first** — Games are stored and executed locally, without requiring an internet connection.
- **Optional library synchronization** — Keep games updated across multiple computers through Rune Cloud.

## The Rune Ecosystem

Rune OS is part of an open-source ecosystem built around a simple idea: **making small, independent games easy to create, share, and play.**

Each project has its own purpose:

- **[Rune SDK](https://github.com/VectorPanic/rune-sdk)** — The JavaScript development kit used to create games, applications, and screensavers.
- [**Rune Tools**](https://github.com/VectorPanic/rune-tools) — A command-line toolkit for creating, updating, and managing Rune SDK projects.
- **Rune OS** — The desktop launcher that brings Rune SDK creations together and makes them accessible to players.
- **[Rune Cloud](https://github.com/VectorPanic/rune-cloud)** — A self-hosted server for publishing and distributing shared game libraries across multiple Rune OS installations.
- **[Rune Cloud Client](https://github.com/VectorPanic/rune-cloud-client)** — A graphical application for uploading, publishing, and managing games on a Rune Cloud server.

Together, these projects provide a complete path from creating a game to making it available on multiple computers.

Rune OS works independently. Rune Cloud and Rune Cloud Client are optional tools for anyone who wants to maintain and distribute a shared library.

## Local Library

Rune OS stores games, screensavers, and configuration files in a local library. Games are discovered automatically from their directories, so adding new content doesn't require modifying the launcher itself.

```text
library/
├── config.json
├── local/
│   ├── categories.json
│   ├── tags.json
│   ├── games/
│   │   └── example/
│   │       ├── example.js
│   │       ├── example.json
│   │       ├── example.png
│   │       └── assets/
│   └── screensaver/
│       └── clock/
│           ├── clock.js
│           └── clock.json
└── remote/
```

Each game includes its compiled JavaScript, metadata, and an optional icon atlas. Additional assets can be stored alongside the game.

### Game Metadata

Games use a simple JSON file to describe their content and capabilities.

```json
{
  "name": "Example Game",
  "developer": "Example Studio",
  "year": 2026,
  "stage": "gold",
  "type": "game",
  "players": {
    "min": 1,
    "max": 1
  },
  "input": ["keyboard", "gamepad"],
  "baseTags": {
    "action": 100
  },
  "tags": {
    "score-attack": 100,
    "fast-paced": 70
  },
  "modes": {
    "coop": false,
    "versus": false
  }
}
```

Rather than relying on traditional genres, Rune OS uses weighted tags to organize games by their characteristics. A single game can appear in multiple categories, with its position determined by relevance.

Categories and ranking rules are defined in `categories.json`, while available tags are declared in `tags.json`.

## Configuration

Rune OS is configured through `library/config.json`. Settings control input devices, available games, audio, screensavers, and synchronization.

```json
{
  "library": {
    "stages": ["gold", "beta"]
  },
  "input": {
    "useKeyboard": true,
    "useGamepads": true
  },
  "audio": {
    "masterVolume": 1,
    "muted": false
  },
  "selector": {
    "screensaverEnabled": true,
    "screensaverDelayMs": 30000
  }
}
```

Only settings that differ from their defaults need to be specified.

During development, `npm test` uses the project's `library/` directory. Compiled and packaged versions on macOS use:

```text
~/Library/Application Support/Rune OS/library/
```

## Rune Cloud Integration

**One library. Multiple machines.**

Rune OS works entirely offline, but can optionally connect to a Rune Cloud server to keep its game library synchronized.

Rune Cloud is an independent, open-source server application that allows developers and communities to maintain a shared collection of Rune SDK games.

Enable synchronization in `config.json`:

```json
{
  "sync": {
    "enabled": true,
    "apiEnabled": true,
    "baseUrl": "http://localhost:8888/rune-cloud/v1/"
  }
}
```

Rune OS automatically checks for updates, downloads and verifies new content, and activates complete library snapshots without interrupting running games.

Downloaded games remain available offline, and the original local library is preserved.

Highscore synchronization is separately opt-in. Set `sync.highscoresEnabled` to `true` and set `sync.baseUrl` to the Rune Cloud API URL. It works independently of `sync.apiEnabled`, which controls library synchronization. Games request synchronization at a suitable time through the Rune SDK's `highscores.sync()`; when synchronization fails or is disabled, the existing local list remains available.

Rune Cloud Client provides a graphical interface for managing and publishing content to the server, completing the workflow without requiring direct interaction with its API.

## Third-party assets

Rune OS uses Norse Bold by Joël Carrouché. The font file is not included in this repository and is ignored by Git.

Before running or packaging Rune OS:

Run the following command from the project root to automatically download Norse Bold and save it to `asset/otf/runeos_font_header.otf` (requires `curl` and `unzip`):

```sh
bash scripts/shell/download_font.sh
```

Alternatively, install the font manually:

1. Download Norse from [the author's website](https://www.joelcarrouche.com/fonts/norse).
2. Extract the archive and copy `Norsebold.otf` to `asset/otf/runeos_font_header.otf`. Only rename the file; do not modify its contents.
3. Keep the font installed at that path for local development and application packaging.

The font has separate terms from the application code; see [the original font license](asset/otf/Norse-LICENSE.txt) and the license supplied with your download. The license permits embedding in applications and web pages, but requires the author's written permission to redistribute or share the standalone font file. Do not commit the downloaded font to the repository.

---

*Made for the joy of pressing Start.*
