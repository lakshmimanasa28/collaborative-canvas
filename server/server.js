const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getRoomForSocket, joinRoom, leaveRoom, getOrCreateRoom } = require('./rooms');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Static files
app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

io.on('connection', (socket) => {
  const query = socket.handshake.query || {};
  const roomId = (query.room && typeof query.room === 'string') ? query.room : 'default';
  const username = (query.username && typeof query.username === 'string') ? query.username : `User-${socket.id.slice(0, 4)}`;
  const color = (query.color && typeof query.color === 'string') ? query.color : undefined;

  joinRoom(io, socket, roomId, { username, color });

  // Send current state to the newly joined user
  const room = getOrCreateRoom(roomId);
  socket.emit('update-state', room.state.serialize());

  socket.on('draw', (payload) => {
    const roomInfo = getRoomForSocket(socket.id);
    if (!roomInfo) return;
    try {
      roomInfo.state.addPointLive(payload);
      socket.to(roomInfo.id).emit('draw', payload);
    } catch (err) {
      socket.emit('error-message', { message: 'Failed to process draw event.' });
    }
  });

  socket.on('path-end', (payload) => {
    const roomInfo = getRoomForSocket(socket.id);
    if (!roomInfo) return;
    try {
      const change = roomInfo.state.commitPath(payload);
      if (change) {
        io.to(roomInfo.id).emit('path-end', change);
      }
    } catch (err) {
      socket.emit('error-message', { message: 'Failed to end path.' });
    }
  });

  socket.on('cursor', (payload) => {
    const roomInfo = getRoomForSocket(socket.id);
    if (!roomInfo) return;
    // Forward normalized coordinates (xN, yN) to others
    socket.to(roomInfo.id).emit('cursor', { ...payload, socketId: socket.id });
  });

  socket.on('undo', () => {
    const roomInfo = getRoomForSocket(socket.id);
    if (!roomInfo) return;
    const change = roomInfo.state.undo();
    if (change) {
      io.to(roomInfo.id).emit('undo', change);
      io.to(roomInfo.id).emit('update-state', roomInfo.state.serialize());
    }
  });

  socket.on('redo', () => {
    const roomInfo = getRoomForSocket(socket.id);
    if (!roomInfo) return;
    const change = roomInfo.state.redo();
    if (change) {
      io.to(roomInfo.id).emit('redo', change);
      io.to(roomInfo.id).emit('update-state', roomInfo.state.serialize());
    }
  });

  socket.on('request-state', () => {
    const roomInfo = getRoomForSocket(socket.id);
    if (!roomInfo) return;
    socket.emit('update-state', roomInfo.state.serialize());
  });

  socket.on('disconnect', () => {
    leaveRoom(socket.id);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});


