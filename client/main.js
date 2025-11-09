import { setupCanvas } from './canvas.js';
import { createSocket } from './websocket.js';

const qs = new URLSearchParams(location.search);
const roomId = qs.get('room') || 'default';

function randomColor() {
  const colors = ['#e53935','#8e24aa','#3949ab','#1e88e5','#00897b','#43a047','#fdd835','#fb8c00','#6d4c41','#d81b60'];
  return colors[Math.floor(Math.random() * colors.length)];
}

const user = {
  id: Math.random().toString(36).slice(2,8),
  name: `User-${Math.random().toString(36).slice(2,6)}`,
  color: randomColor()
};

document.getElementById('room-label').textContent = `Room: ${roomId}`;
document.getElementById('user-label').textContent = `${user.name}`;

const socket = createSocket({ room: roomId, username: user.name, color: user.color });

setupCanvas({ socket, user });



