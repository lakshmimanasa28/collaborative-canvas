const { DrawingState } = require('./drawing-state');

// roomId -> { id, sockets: Set<socketId>, state: DrawingState, users: Map<socketId, {username,color}> }
const rooms = new Map();
// socketId -> room
const socketIdToRoom = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      sockets: new Set(),
      users: new Map(),
      state: new DrawingState()
    });
  }
  return rooms.get(roomId);
}

function joinRoom(io, socket, roomId, userInfo) {
  const room = getOrCreateRoom(roomId);
  room.sockets.add(socket.id);
  room.users.set(socket.id, userInfo || {});
  socket.join(roomId);
  socketIdToRoom.set(socket.id, room);
  io.to(roomId).emit('presence', {
    type: 'join',
    socketId: socket.id,
    user: userInfo || {}
  });
}

function leaveRoom(socketId) {
  const room = socketIdToRoom.get(socketId);
  if (!room) return;
  room.sockets.delete(socketId);
  room.users.delete(socketId);
  socketIdToRoom.delete(socketId);
}

function getRoomForSocket(socketId) {
  return socketIdToRoom.get(socketId);
}

module.exports = {
  getOrCreateRoom,
  joinRoom,
  leaveRoom,
  getRoomForSocket
};



