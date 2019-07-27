const WebSocket = require('ws');

const WEB_SOCKET_PORT = 3333;

const ROLES = {
  TRAINER: 'trainer',
  STUDENT: 'student',
};

const freeTrainers = [];

const webSocketServer = new WebSocket.Server({
  port: WEB_SOCKET_PORT,
});

function putTrainerOnFreeTrainerList(trainer) {
  freeTrainers.push(trainer);
}

function printCurrentState() {
  console.log('number of free trainers:', freeTrainers.length);
}

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
    switch (connectedPerson.role) {
      case ROLES.TRAINER:
        console.log('trainer disconnected');
        break;
      case ROLES.STUDENT:
        console.log(`student (${connectedPerson.identification}) disconnected`);
        break;
    }
  });
});

console.log('TrainerNeeded server...');
