export function createSocket({ room, username, color }) {
  const socket = io({ query: { room, username, color } });

  socket.on('connect_error', () => {
    // try to reconnect automatically (socket.io default), here we just log
    console.warn('Socket connect_error');
  });

  socket.on('error-message', (err) => {
    console.warn(err?.message || 'Server error');
  });

  // Re-request state after reconnect
  socket.io.on('reconnect', () => {
    socket.emit('request-state');
  });

  return socket;
}



