const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waiting = [];

io.on('connection', (socket) => {
    socket.isVideo = false;
    socket.partner = null;

    socket.on('find-partner', (isVideo) => {
        socket.isVideo = isVideo;
        const idx = waiting.findIndex(s => s.isVideo === isVideo && s.id !== socket.id);
        if (idx !== -1) {
            const partner = waiting.splice(idx, 1)[0];
            socket.partner = partner.id;
            partner.partner = socket.id;
            io.to(socket.id).emit('partner-found', { initiator: true });
            io.to(partner.id).emit('partner-found', { initiator: false });
        } else {
            waiting.push(socket);
        }
    });

    socket.on('offer', data => {
        if (socket.partner) io.to(socket.partner).emit('offer', data);
    });

    socket.on('answer', data => {
        if (socket.partner) io.to(socket.partner).emit('answer', data);
    });

    socket.on('ice-candidate', data => {
        if (socket.partner) io.to(socket.partner).emit('ice-candidate', data);
    });

    socket.on('message', msg => {
        if (socket.partner) io.to(socket.partner).emit('message', msg);
    });

    socket.on('next', () => {
        if (socket.partner) {
            io.to(socket.partner).emit('partner-disconnected');
            io.to(socket.id).emit('partner-disconnected');
        }
        socket.partner = null;
        socket.emit('reset-ui');
        socket.emit('find-partner', socket.isVideo);
    });

    socket.on('disconnect', () => {
        if (socket.partner) io.to(socket.partner).emit('partner-disconnected');
        waiting = waiting.filter(s => s.id !== socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
