const WebSocket = require('ws');

const WEB_SOCKET_PORT = 3333;

const webSocketServer = new WebSocket.Server({
  port: WEB_SOCKET_PORT,
});

webSocketServer.on('connection', function(webSocket) {
  console.log('client connected');

  webSocket.on('close', function() {
    console.log('client disconnected');
  });
});

console.log('TrainerNeeded server...');
