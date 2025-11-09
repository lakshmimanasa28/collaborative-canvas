const http = require('http');
const { Server } = require('socket.io');
const { getRoomForSocket, joinRoom, leaveRoom, getOrCreateRoom } = require('./rooms');

// Global Socket.IO server instance (initialized once)
let io = null;
let httpServer = null;

function getSocketIO() {
  if (io) return io;

  // Create HTTP server for Socket.IO
  httpServer = http.createServer();
  
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    path: '/api/socket'
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] User connected: ${socket.id}`);
    
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
        console.error('[Socket.IO] Draw error:', err);
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
        console.error('[Socket.IO] Path-end error:', err);
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
      console.log(`[Socket.IO] User disconnected: ${socket.id}`);
      leaveRoom(socket.id);
    });
  });

  return io;
}

// Vercel serverless function handler
module.exports = async (req, res) => {
  // Initialize Socket.IO
  const socketIO = getSocketIO();
  
  // Handle WebSocket upgrade
  if (req.headers.upgrade === 'websocket') {
    httpServer.emit('upgrade', req, req.socket, Buffer.alloc(0));
    res.end();
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'Socket.IO server ready', connected: socketIO.engine.clientsCount }));
  }
};

