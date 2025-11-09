# Real-Time Collaborative Canvas

Vanilla JS + HTML5 Canvas frontend with Express + Socket.io backend. Multiple users draw together in real-time with global undo/redo.

## Quick Start

```bash
npm install
npm start
```

Open `http://localhost:3000` in multiple tabs to test multi-user collaboration.

### Rooms (optional)
Use the `room` query param for isolated canvases:
- `http://localhost:3000/?room=alpha`
- `http://localhost:3000/?room=beta`

## Features
- Brush / Eraser tools
- Color picker and stroke width
- Live drawing sync (point-by-point, not only after stroke finishes)
- Live cursors with name/color
- Global undo/redo (applies to the shared canvas)
- Efficient rendering: throttled cursor updates, requestAnimationFrame for drawing
- Reconnect handling and full-state resync on reconnect
- Basic touch support

## Scripts
- `npm start` – start server at port 3000
- `npm run dev` – start with nodemon for development

## How It Works (High Level)
- Client emits `draw` for each pointer move and `path-end` when finishing
- Server accumulates live points until `path-end`, then commits a path to global state
- Global state is a stack of paths with an undo stack for redo
- `undo`/`redo` mutate the global state and broadcast state updates to all clients

## Test With Multiple Users
- Open multiple tabs of `http://localhost:3000`
- Try different `room` values to isolate groups

## Known Limitations
- Memory-only state (no persistence across server restarts)
- Simple path model (polyline); no smoothing
- Eraser removes by compositing, not by object-level hit testing
- No per-user undo; undo is global

## Time Spent
- Architecture + implementation: ~3-4 hours

## Future Improvements
- Persistence to disk or database and replay on startup
- Path smoothing (Bezier, Chaikin) and pressure support
- Selection and transform tools
- Export/import canvas as image or JSON
- Presence list UI and per-user permissions
- Optimistic batching for fewer network events



