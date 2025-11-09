const { v4: uuidv4 } = require('uuid');

class DrawingState {
  constructor() {
    this.paths = []; // committed paths
    this.undone = []; // undone stack for redo
    this.livePaths = new Map(); // pathId -> temp path points before commit
  }

  // payload: { pathId, point: {x,y,pressure?,time}, tool, color, width, userId }
  addPointLive(payload) {
    if (!payload || !payload.pathId || !payload.point) return;
    if (!this.livePaths.has(payload.pathId)) {
      this.livePaths.set(payload.pathId, {
        id: payload.pathId,
        userId: payload.userId,
        tool: payload.tool || 'brush',
        color: payload.color || '#000000',
        opacity: typeof payload.opacity === 'number' ? payload.opacity : 1,
        // normalized width (fraction of canvas width)
        widthN: typeof payload.widthN === 'number' ? payload.widthN : undefined,
        points: []
      });
    }
    const path = this.livePaths.get(payload.pathId);
    const p = payload.point;
    // store normalized coordinates if provided; fall back to absolute for backward compatibility
    path.points.push({
      xN: typeof p.xN === 'number' ? p.xN : undefined,
      yN: typeof p.yN === 'number' ? p.yN : undefined,
      x: typeof p.x === 'number' ? p.x : undefined,
      y: typeof p.y === 'number' ? p.y : undefined,
      t: p.t
    });
  }

  // payload: { pathId }
  commitPath(payload) {
    if (!payload || !payload.pathId) return null;
    const path = this.livePaths.get(payload.pathId);
    if (!path || !path.points || path.points.length === 0) return null;
    this.livePaths.delete(payload.pathId);
    // New commit invalidates redo stack
    this.undone = [];
    this.paths.push(path);
    return { path };
  }

  undo() {
    if (this.paths.length === 0) return null;
    const path = this.paths.pop();
    this.undone.push(path);
    return { path };
  }

  redo() {
    if (this.undone.length === 0) return null;
    const path = this.undone.pop();
    this.paths.push(path);
    return { path };
  }

  serialize() {
    return {
      paths: this.paths.map((p) => ({
        id: p.id || uuidv4(),
        userId: p.userId,
        tool: p.tool,
        color: p.color,
        opacity: typeof p.opacity === 'number' ? p.opacity : 1,
        widthN: p.widthN,
        points: p.points
      }))
    };
  }
}

module.exports = { DrawingState };


