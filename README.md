# Collar Replay

Browser app that loads painted dog GPS collar CSVs (one file per pack, filename = pack name), shows each pack's 95% MCP range on a map, and replays movement over time.

CSVs are read in the browser via **Open CSV files…** or by dropping them on the map; their contents are never uploaded. The map does load imagery from Esri and OpenStreetMap, so those providers can see which area is on screen (more precisely the further you zoom in).

## Setup (once)

1. Install [Node.js](https://nodejs.org/) (`brew install node`).
2. Open this folder in VS Code.
3. In the VS Code terminal (**⌃`**), run `npm install`.

## Build in VS Code

Press **⇧⌘B** (**Terminal → Run Build Task…**).

The output is a single self-contained file, `dist/index.html`. Type errors appear in the Problems panel.

## Try it locally

- Double-click `dist/index.html` after a build, or
- run `npm run dev` in the terminal and open <http://localhost:5173>. The page reloads as you edit.

Run the unit tests with `npm test`.

## Publish

Every push to `main` builds the app on GitHub and publishes it as a new release. The newest build is always at:

<https://github.com/DonLakeFlyer/CollarReplay/releases/latest/download/collar-replay.html>

Download that file and upload it to the public S3 folder. Share the S3 URL of the file.
