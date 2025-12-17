Lil Minesweeper

## Play
- Open `index.html` in a browser (or serve the folder with any static server).

## Better boards
- `Seed`: deterministic mine placement (same seed + same first click = same board).
- `No-guess board`: tries to generate a board solvable by basic Minesweeper logic (falls back if it can’t find one quickly).

## Replay
- Paste a seed from a previous game to auto-replay that exact board (this remembers the first-click cell in `localStorage`).
- You can also paste `seed@row,col` to force a specific first click.
- Use “Copy replay link” after the first click to share a URL that replays the same board on another device.

## Tests
- Run: `node --test`
