const WebSocket = require('ws');
const { pull } = require('lodash');

const WEB_SOCKET_PORT = 3333;

// eslint-disable-next-line no-unused-vars
const ROLES = {
  STUDENT: 'student',
  TRAINER: 'trainer'
};

const freeTrainers = [];

const studentsWaitingForHelp = [];

function putStudentAtTheEndOfQueue(student) {
  studentsWaitingForHelp.push(student);

  student.webSocket.send(
    JSON.stringify({
      type: 'position-in-waiting-queue',
      positionInWaitingQueue: studentsWaitingForHelp.length
    })
  );
}

function handleFreeTrainer(trainer) {
  if (studentsWaitingForHelp.length) {
    assignFirstFreeTrainerToTheFirstWaitingStudent(trainer);
  } else {
    putTrainerOnFreeTrainersQueue(trainer);
  }
}

function assignFirstFreeTrainerToTheFirstWaitingStudent(trainer) {
  const student = studentsWaitingForHelp.shift();

  assignTrainerToStudent(trainer, student);
}

function putTrainerOnFreeTrainersQueue(trainer) {
  freeTrainers.push(trainer);
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

  updateWaitingStudentsPositionInQueue();
}

function handleStudentRequestingHelp(student) {
  if (freeTrainers.length) {
    assignFirstFreeTrainerToStudent(student);
  } else {
    putStudentAtTheEndOfQueue(student);
  }
}

function handleStudentLeaving(student) {
  if (student.trainer) {
    const trainer = student.trainer;
    student.trainer = null;
    trainer.student = null;
    trainer.webSocket.send(JSON.stringify({ type: 'help-request-cancellation' }));
    handleFreeTrainer(trainer);
  } else if (studentsWaitingForHelp.includes(student)) {
    pull(studentsWaitingForHelp, student);
    updateWaitingStudentsPositionInQueue();
  }
}

function updateWaitingStudentsPositionInQueue() {
  studentsWaitingForHelp.forEach(function aaa(student, index) {
    student.webSocket.send(JSON.stringify({ type: 'position-in-waiting-queue', positionInWaitingQueue: index + 1 }));
  });
}

function printState() {
  console.log('number of free trainers: ', freeTrainers.length);
  console.log('number of waiting students: ', studentsWaitingForHelp.length);
}

const webSocketServer = new WebSocket.Server({ port: WEB_SOCKET_PORT });

webSocketServer.on('listening', function listening() {
  console.log(`TrainerNeeded server listening on port ${WEB_SOCKET_PORT}...`);
});

webSocketServer.on('connection', function connection(webSocket) {
  console.log('client connected');

  const connectedPerson = {
    webSocket,
    role: null,
    identification: null
  };

  const freshConnectionMessageHandler = {
    identification: function(message) {
      console.log('handling identification');
      connectedPerson.role = message.role;
      connectedPerson.identification = message.identification;

      const handlerScenarios = {
        [ROLES.STUDENT]: () => {
          connectedPerson.trainer = null;
          messagesHandler = studentMessageHandler;
        },
        [ROLES.TRAINER]: () => {
          connectedPerson.student = null;
          messagesHandler = trainerMessageHandler;
          handleFreeTrainer(connectedPerson);
        }
      };

      handlerScenarios[message.role]();
    }
  };

  const studentMessageHandler = {
    'help-request': () => {
      handleStudentRequestingHelp(connectedPerson);
    }
  };

  const trainerMessageHandler = {
    'help-provided': () => {
      const trainer = connectedPerson;
      const { student } = trainer;

      trainer.student = null;
      student.trainer = null;

      student.webSocket.send(JSON.stringify({ type: 'help-provided' }));
      handleFreeTrainer(trainer);
    }
  };

  let messagesHandler = freshConnectionMessageHandler;

  webSocket.on('message', function webSocketMessageHandler(json) {
    const message = JSON.parse(json);
    console.log();
    console.log('received message: ', message);

    const messageHandler = messagesHandler[message.type];

    if (messageHandler) {
      messageHandler(message);
    }

    printState();
  });

  webSocket.on('close', function webSocketCloseHandler() {
    console.log();
    const disconnectionScenario = {
      [ROLES.STUDENT]: () => {
        console.log(`Student ${connectedPerson.identification} disconnected`);
        handleStudentLeaving(connectedPerson);
      },
      [ROLES.TRAINER]: () => {
        pull(freeTrainers, connectedPerson);
        console.log('Trainer disconnected');
      },
      default: () => console.log('Client disconnected')
    };

    disconnectionScenario[connectedPerson.role || 'default']();

    printState();
  });

  webSocket.on('error', function webSocketErrorHandler(error) {
    console.log('error: ', error);
  });
});
