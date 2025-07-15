const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

let rooms = {};

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('create_room', () => {
    const code = Math.random().toString(36).substr(2, 6);
    rooms[code] = [socket.id];
    socket.join(code);
    socket.emit('room_created', code);
    console.log(`Room created: ${code} by ${socket.id}`);
  });

  socket.on('join_room', (code) => {
    if (rooms[code] && rooms[code].length === 1) {
      rooms[code].push(socket.id);
      socket.join(code);
      console.log(`Player joined room: ${code} - ${socket.id}`);
      io.to(code).emit('start_game');
      io.to(rooms[code][0]).emit('your-turn');
      io.to(rooms[code][1]).emit('opponent-turn');
    } else {
      socket.emit('error_msg', 'Room full or does not exist');
    }
  });

  // ✅ Video frame relay: drawer sends to opponent
  socket.on('frame', ({ room, image }) => {
    console.log(`Frame relayed from ${socket.id} in room ${room}`);
    socket.to(room).emit('remote_frame', image);
  });

  // (Optional) WebRTC retained for potential future upgrade
  socket.on('offer', ({ offer, room }) => {
    socket.to(room).emit('offer', { offer });
  });

  socket.on('answer', ({ answer, room }) => {
    socket.to(room).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ candidate, room }) => {
    socket.to(room).emit('ice-candidate', { candidate });
  });

  // Chat messages
  socket.on('message', (msg) => {
    const room = Object.keys(rooms).find(code => rooms[code].includes(socket.id));
    if (room) {
      socket.to(room).emit('message', msg);
    }
  });

  // Handle correct guess
  socket.on('correct', () => {
    const room = Object.keys(rooms).find(code => rooms[code].includes(socket.id));
    if (room) {
      io.to(room).emit('message', '✅ Correct guess!');
      io.to(room).emit('switch-turns');
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    for (const code in rooms) {
      if (rooms[code].includes(socket.id)) {
        delete rooms[code];
        io.to(code).emit('message', '⚠️ Opponent left.');
        break;
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
