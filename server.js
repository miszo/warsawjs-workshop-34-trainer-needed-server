const WebSocket = require('ws');

const WEB_SOCKET_PORT = 3333;

const webSocketServer = new WebSocket.Server({
  port: WEB_SOCKET_PORT,
});

webSocketServer.on('connection', function(webSocket) {
  console.log('client connected');

  const connectedPerson = {
    role: null,
    identification: null,
  };

  const freshConnectionMessagesHandler = {
    'identification': function(message) {
      connectedPerson.role           = message.role;
      connectedPerson.identification = message.identification;

      switch (message.role) {
        case ROLES.TRAINER:
          messagesHandler = trainerMessagesHandler;
          putTrainerOnFreeTrainerList(connectedPerson);
          break;
        case ROLES.STUDENT:
          messagesHandler = studentMessagesHandler;
          break;
      }

      printCurrentState();
    },
  };

  const studentMessagesHandler = {
  };

  const trainerMessagesHandler = {
  };

  let messagesHandler = freshConnectionMessagesHandler;

  webSocket.on('message', function(json) {
    const message = JSON.parse(json);
    console.log('received message:', message);

    const messageHandler = messagesHandler[message.type];
    if (messageHandler) {
      messageHandler(message);
    }
  });

  webSocket.on('close', function() {
    console.log('client disconnected');
  });
});

console.log('TrainerNeeded server...');
