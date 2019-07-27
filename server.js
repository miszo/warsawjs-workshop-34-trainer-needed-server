const WebSocket = require('ws');
const { pull } = require('lodash');

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

function handleStudentRequestingHelp(student) {
  if (freeTrainers.length > 0) {
    assignFirstFreeTrainerToStudent(student);
  }
}

function assignFirstFreeTrainerToStudent(student) {
  const trainer = freeTrainers.shift();
  assignTrainerToStudent(trainer, student);
}

function assignTrainerToStudent(trainer, student) {
  trainer.student = student;
  student.trainer = trainer;
  trainer.webSocket.send(JSON.stringify({ type: 'help-request', studentIdentification: student.identification }));
  student.webSocket.send(JSON.stringify({ type: 'trainer-assigned' }));
}

function printCurrentState() {
  console.log('number of free trainers:', freeTrainers.length);
}

webSocketServer.on('connection', function(webSocket) {
  console.log('client connected');

  const connectedPerson = {
    webSocket,
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
          connectedPerson.student = null;
          putTrainerOnFreeTrainerList(connectedPerson);
          break;
        case ROLES.STUDENT:
          messagesHandler = studentMessagesHandler;
          connectedPerson.trainer = null;
          break;
      }

      printCurrentState();
    },
  };

  const studentMessagesHandler = {
    'help-request': function() {
      handleStudentRequestingHelp(connectedPerson);
      printCurrentState();
    }
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
        pull(freeTrainers, connectedPerson);
        console.log('trainer disconnected');
        break;
      case ROLES.STUDENT:
        console.log(`student (${connectedPerson.identification}) disconnected`);
        break;
    }

    printCurrentState();
  });
});

console.log('TrainerNeeded server...');
