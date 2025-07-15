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
  });

  socket.on('join_room', (code) => {
    if (rooms[code] && rooms[code].length === 1) {
      rooms[code].push(socket.id);
      socket.join(code);
      io.to(code).emit('start_game');
      io.to(rooms[code][0]).emit('your-turn');
      io.to(rooms[code][1]).emit('opponent-turn');
    } else {
      socket.emit('error_msg', 'Room full or does not exist');
    }
  });

  // WebRTC signaling
  socket.on('offer', ({ offer, room }) => {
    socket.to(room).emit('offer', { offer });
  });

  socket.on('answer', ({ answer, room }) => {
    socket.to(room).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ candidate, room }) => {
    socket.to(room).emit('ice-candidate', { candidate });
  });

  // Chat & Game
  socket.on('message', (msg) => {
    const room = Object.keys(rooms).find(code => rooms[code].includes(socket.id));
    if (room) socket.to(room).emit('message', msg);
  });

  socket.on('correct', () => {
    const room = Object.keys(rooms).find(code => rooms[code].includes(socket.id));
    if (room) {
      io.to(room).emit('message', '✅ Correct guess!');
      io.to(room).emit('switch-turns');
    }
  });

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
