const WebSocket = require('ws');

const WEB_SOCKET_PORT = 3333;

const webSocketServer = new WebSocket.Server({
  port: WEB_SOCKET_PORT,
});

webSocketServer.on('connection', function() {
  console.log('client connected');
});

console.log('TrainerNeeded server...');
