
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

app.post('/api/test', (req,res)=>{
  io.emit('chat', req.body);
  res.json({ok:true});
});

io.on('connection', (socket)=>{
  console.log('connected');
});

server.listen(3000, ()=>console.log('http://localhost:3000'));
