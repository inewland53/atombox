# AtomBox

A standalone desktop app for browsing, installing, and managing [Reactor](https://gitlab.com/WeSuckLess/Reactor) atoms for DaVinci Resolve Fusion.

## Requirements

- DaVinci Resolve installed
- Internet connection (fetches catalog from GitLab)

## Installation

- **Mac**: Download `AtomBox.dmg` → drag to Applications
- **Windows**: Download `AtomBox Setup.exe` → run installer

### First Launch — Security Warning

**Mac (Gatekeeper):** Right-click → "Open" → "Open". One time only.

**Windows (SmartScreen):** "More info" → "Run anyway".

These warnings appear because the app is not code-signed.

## Usage

1. Launch — auto-detects your DaVinci Resolve Fusion folder
2. Browse the full Reactor catalog, search by name/author, or filter by category
3. Click an atom to view details, then Install / Update / Uninstall
4. Restart DaVinci Resolve to load newly installed atoms
5. If auto-detection fails: Settings → General → set Fusion folder path manually

## Custom Repositories

Add your own .atom repositories from Settings → Repositories:

- **GitLab / GitHub** — any public repo with an `/Atoms` directory
- **Local folder** — a directory on your machine containing `.atom` files
- **HTTP server** — a URL serving an `index.json` + `.atom` files

Repos can be tagged with a category label (e.g. "Work", "Personal") visible as a filter in the sidebar.

Export your repo list as JSON to share with others; import a shared list with one click.

## Building from Source

    git clone <repo>
    cd atombox
    npm install
    npm start          # dev mode
    npm run make       # build installers
    npm test           # run unit tests
