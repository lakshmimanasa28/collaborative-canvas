# Architecture

## Data Flow

User → WebSocket (Socket.io client) → Server → Other Clients

- Client emits drawing events (`draw`, `path-end`) and control events (`cursor`, `undo`, `redo`, `request-state`).
- Server updates in-memory global state per room and broadcasts to room members.
- New clients receive `update-state` on join or on reconnect.

## WebSocket Protocol

Events emitted by client:
- `draw`: `{ pathId, userId, tool, color, width, point: { x, y, t } }`
- `path-end`: `{ pathId }`
- `cursor`: `{ x, y, name, color }`
- `undo`: `void`
- `redo`: `void`
- `request-state`: `void`

Events emitted by server:
- `update-state`: `{ paths: Array<Path> }`
- `draw`: same payload as client `draw` (to others)
- `path-end`: `{ path: Path }`
- `cursor`: `{ socketId, x, y, name, color }`
- `undo`: `{ path }`
- `redo`: `{ path }`
- `error-message`: `{ message }`

`Path` shape:
```
{
  id: string,
  userId: string,
  tool: 'brush' | 'eraser',
  color: string,
  width: number,
  points: { x: number, y: number, t?: number }[]
}
```

## Undo/Redo Strategy
- Global stacks per room:
  - `paths`: committed paths in order
  - `undone`: stack of paths removed by undo
- `undo`: pop from `paths` → push to `undone`, broadcast `update-state`
- `redo`: pop from `undone` → push to `paths`, broadcast `update-state`
- Any new committed path clears `undone` to avoid branching histories.

## Conflict Resolution
- Server is source of truth. All commits go through server.
- Live `draw` events are applied locally for preview; the authoritative state comes from `update-state`.
- Overlapping strokes are composited with `source-over` for brush and `destination-out` for eraser.

## Performance Decisions
- Throttled cursor broadcasts (~25 fps) to reduce chatter.
- Rendering uses `requestAnimationFrame` for smoothness.
- Live segments are drawn incrementally to avoid redrawing the entire canvas each move.
- Full redraw only on `update-state` (e.g., after undo/redo or join/reconnect).

## Global State Synchronization
- On connect and reconnect, client requests/receives `update-state`.
- Server holds per-room `DrawingState` in memory. New clients immediately get current `paths`.
- After any undo/redo or commit, server broadcasts `update-state` ensuring everyone converges.

## Rooms
- Each `room` is an isolated `DrawingState` and member set.
- Client chooses room via `?room=...` query.



