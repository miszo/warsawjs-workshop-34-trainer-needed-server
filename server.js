const WebSocket = require('ws');
const { pull } = require('lodash');

const WEB_SOCKET_PORT = 3333;

const ROLES = {
  TRAINER: 'trainer',
  STUDENT: 'student',
};

const freeTrainers = [];
const studentsWaitingForHelp = [];

const webSocketServer = new WebSocket.Server({
  port: WEB_SOCKET_PORT,
});

function handleFreeTrainer(trainer) {
  if (studentsWaitingForHelp.length > 0) {
    assignTrainerToFirstWaitingStudent(trainer);
  } else {
    putTrainerOnFreeTrainerList(trainer);
  }
}

function assignTrainerToFirstWaitingStudent(trainer) {
  const student = studentsWaitingForHelp.shift();
  assignTrainerToStudent(trainer, student);
  notifyStudentsAboutTheirPositionsInWaitingQueue();
}

function putTrainerOnFreeTrainerList(trainer) {
  freeTrainers.push(trainer);
}

function handleStudentRequestingHelp(student) {
  if (freeTrainers.length > 0) {
    assignFirstFreeTrainerToStudent(student);
  } else {
    putStudentAtTheEndWaitingQueue(student);
  }
}

function handleStudentReassignment(student) {
  if (freeTrainers.length > 0) {
    assignFirstFreeTrainerToStudent(student);
  } else {
    putStudentAtTheBeginningOfWaitingQueue(student);
  }
}

function putStudentAtTheEndWaitingQueue(student) {
  studentsWaitingForHelp.push(student);
  student.webSocket.send(JSON.stringify({ type: 'position-in-waiting-queue', positionInWaitingQueue: studentsWaitingForHelp.length }));
}

function assignFirstFreeTrainerToStudent(student) {
  const trainer = freeTrainers.shift();
  assignTrainerToStudent(trainer, student);
}

function putStudentAtTheBeginningOfWaitingQueue(student) {
  studentsWaitingForHelp.unshift(student);
  notifyStudentsAboutTheirPositionsInWaitingQueue();
}

function assignTrainerToStudent(trainer, student) {
  trainer.student = student;
  student.trainer = trainer;
  trainer.webSocket.send(JSON.stringify({ type: 'help-request', studentIdentification: student.identification }));
  student.webSocket.send(JSON.stringify({ type: 'trainer-assigned' }));
}

function notifyStudentsAboutTheirPositionsInWaitingQueue() {
  studentsWaitingForHelp.forEach(function(student, index) {
    student.webSocket.send(JSON.stringify({ type: 'position-in-waiting-queue', positionInWaitingQueue: index + 1 }));
  });
}

function handleTrainerLeaving(trainer) {
  if (trainer.student) {
    handleStudentReassignment(trainer.student);
  } else {
    pull(freeTrainers, trainer);
  }
}

function printCurrentState() {
  console.log('number of free trainers:', freeTrainers.length);
  console.log('number of students waiting for help', studentsWaitingForHelp.length);
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
          handleFreeTrainer(connectedPerson);
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
    'help-provided': function() {
      const trainer = connectedPerson;
      const student = trainer.student;

      trainer.student = null;
      student.trainer = null;

      trainer.webSocket.send(JSON.stringify({ type: 'help-provided' }));
      student.webSocket.send(JSON.stringify({ type: 'help-provided' }));

      handleFreeTrainer(trainer);

      printCurrentState();
    },
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
        handleTrainerLeaving(connectedPerson);
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
