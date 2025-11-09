let canvas, ctx;
let currentTool = 'brush';
let strokeColor = '#1e1e1e';
let strokeWidth = 4;
let strokeOpacity = 1;

let isDrawing = false;
let currentPathId = null;
let lastPoint = null;

const cursorsLayer = document.getElementById('cursors');
const remoteCursors = new Map(); // socketId -> {el}
const remoteLive = new Map(); // pathId -> { last, tool, color, width }

function createCursorEl(name, color) {
  const el = document.createElement('div');
  el.className = 'cursor';
  el.innerHTML = `<span class="dot" style="background:${color}"></span><span class="label">${name}</span>`;
  cursorsLayer.appendChild(el);
  return el;
}

function setActiveTool(name) {
  currentTool = name;
  document.getElementById('tool-brush').classList.toggle('active', name === 'brush');
  document.getElementById('tool-eraser').classList.toggle('active', name === 'eraser');
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.scale(dpr, dpr);
  redrawAllPaths();
}

// In-memory committed paths (from server state)
const committedPaths = [];

function redrawAllPaths() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  for (const path of committedPaths) {
    drawPath(ctx, path);
  }
}

function drawPath(context, path) {
  if (!path.points || path.points.length === 0) return;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const useEraser = path.tool === 'eraser';
  if (useEraser) {
    context.globalCompositeOperation = 'destination-out';
    context.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    context.globalCompositeOperation = 'source-over';
    const alpha = typeof path.opacity === 'number' ? Math.max(0, Math.min(1, path.opacity)) : 1;
    context.strokeStyle = toRgba(path.color || '#000', alpha);
  }
  const widthPx = path.widthN ? path.widthN * canvas.clientWidth : (path.width || 4);
  context.lineWidth = Math.max(0.5, widthPx);

  context.beginPath();
  const [first, ...rest] = path.points;
  const fx = first.xN != null ? first.xN * canvas.clientWidth : first.x;
  const fy = first.yN != null ? first.yN * canvas.clientHeight : first.y;
  context.moveTo(fx, fy);
  for (const pt of rest) {
    const px = pt.xN != null ? pt.xN * canvas.clientWidth : pt.x;
    const py = pt.yN != null ? pt.yN * canvas.clientHeight : pt.y;
    context.lineTo(px, py);
  }
  context.stroke();
  context.restore();
}

function throttle(fn, ms) {
  let last = 0; let timer = null;
  return (...args) => {
    const now = performance.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = performance.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };
}

function lineSegment(a, b, tool, color, width, opacity = 1) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = toRgba(color, opacity);
  }
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  let x, y;
  if (e.touches && e.touches[0]) {
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }
  return { x, y };
}

export function setupCanvas({ socket, user }) {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');

  // Controls
  document.getElementById('tool-brush').addEventListener('click', () => setActiveTool('brush'));
  document.getElementById('tool-eraser').addEventListener('click', () => setActiveTool('eraser'));
  const colorInput = document.getElementById('color');
  const widthInput = document.getElementById('width');
  // Optional opacity slider support: if present, wire it
  const opacityInput = document.getElementById('opacity');
  colorInput.addEventListener('input', (e) => { strokeColor = e.target.value; });
  widthInput.addEventListener('input', (e) => { strokeWidth = Number(e.target.value); });
  if (opacityInput) opacityInput.addEventListener('input', (e) => { strokeOpacity = Number(e.target.value); });
  document.getElementById('undo').addEventListener('click', () => socket.emit('undo'));
  document.getElementById('redo').addEventListener('click', () => socket.emit('redo'));

  // Initial tool state
  strokeColor = colorInput.value;
  strokeWidth = Number(widthInput.value);
  if (opacityInput) strokeOpacity = Number(opacityInput.value);

  // Canvas sizing
  const onResize = () => resizeCanvas();
  window.addEventListener('resize', onResize);
  resizeCanvas();

  const sendCursor = throttle((pos) => {
    const xN = pos.x / canvas.clientWidth;
    const yN = pos.y / canvas.clientHeight;
    socket.emit('cursor', { xN, yN, name: user.name, color: user.color });
  }, 40);

  function beginDraw(e) {
    isDrawing = true;
    lastPoint = pointerPos(e);
    currentPathId = `${socket.id}-${Date.now()}`;
  }

  function moveDraw(e) {
    const pos = pointerPos(e);
    sendCursor(pos);
    if (!isDrawing) return;
    const nowPoint = pos;
    if (lastPoint) {
      requestAnimationFrame(() => lineSegment(lastPoint, nowPoint, currentTool, strokeColor, strokeWidth, strokeOpacity));
    }
    socket.emit('draw', {
      pathId: currentPathId,
      userId: user.id,
      tool: currentTool,
      color: strokeColor,
      opacity: strokeOpacity,
      widthN: strokeWidth / canvas.clientWidth,
      point: { xN: nowPoint.x / canvas.clientWidth, yN: nowPoint.y / canvas.clientHeight, t: Date.now() }
    });
    lastPoint = nowPoint;
  }

  function endDraw() {
    if (!isDrawing) return;
    isDrawing = false;
    lastPoint = null;
    socket.emit('path-end', { pathId: currentPathId });
    currentPathId = null;
  }

  // Mouse
  canvas.addEventListener('mousedown', beginDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);
  // Touch
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); beginDraw(e); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveDraw(e); }, { passive: false });
  window.addEventListener('touchend', (e) => { e.preventDefault(); endDraw(e); }, { passive: false });

  // Remote handlers
  socket.on('draw', (payload) => {
    if (!payload || !payload.pathId || !payload.point) return;
    const key = payload.pathId;
    const entry = remoteLive.get(key) || {
      last: null,
      tool: payload.tool || 'brush',
      color: payload.color || '#000',
      width: (typeof payload.widthN === 'number' ? Math.max(0.5, payload.widthN * canvas.clientWidth) : (typeof payload.width === 'number' ? payload.width : 2)),
      opacity: typeof payload.opacity === 'number' ? payload.opacity : 1
    };
    const nowPoint = {
      x: payload.point.xN != null ? payload.point.xN * canvas.clientWidth : payload.point.x,
      y: payload.point.yN != null ? payload.point.yN * canvas.clientHeight : payload.point.y
    };
    if (entry.last) {
      requestAnimationFrame(() => lineSegment(entry.last, nowPoint, entry.tool, entry.color, entry.width, entry.opacity));
    }
    entry.last = nowPoint;
    remoteLive.set(key, entry);
  });

  socket.on('path-end', ({ path }) => {
    if (!path) return;
    committedPaths.push(path);
    drawPath(ctx, path);
    // clear live cache for this path
    if (path.id) remoteLive.delete(path.id);
  });

  socket.on('undo', () => {
    // State update will refresh full canvas; we no-op here
  });

  socket.on('redo', () => {
    // State update will refresh full canvas; we no-op here
  });

  socket.on('update-state', (state) => {
    const { paths } = state || { paths: [] };
    committedPaths.splice(0, committedPaths.length, ...paths);
    redrawAllPaths();
  });

  socket.on('cursor', ({ socketId, xN, yN, name, color, x, y }) => {
    if (!socketId) return;
    let rec = remoteCursors.get(socketId);
    if (!rec) {
      const el = createCursorEl(name || 'User', color || '#000');
      rec = { el };
      remoteCursors.set(socketId, rec);
    }
    const px = xN != null ? xN * canvas.clientWidth : x;
    const py = yN != null ? yN * canvas.clientHeight : y;
    rec.el.style.left = `${px}px`;
    rec.el.style.top = `${py}px`;
  });
}

function toRgba(hexOrCss, opacity) {
  // If already rgba(...) just replace alpha
  if (/^rgba?\(/i.test(hexOrCss)) {
    try {
      const nums = hexOrCss.replace(/rgba?\(|\)/g, '').split(',').map((s) => s.trim());
      const r = Number(nums[0]);
      const g = Number(nums[1]);
      const b = Number(nums[2]);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    } catch {
      // fallthrough to hex
    }
  }
  const { r, g, b } = hexToRgb(hexOrCss) || { r: 0, g: 0, b: 0 };
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function hexToRgb(hex) {
  let h = (hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}


