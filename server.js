const socketIO = require('socket.io');
const { pull } = require('lodash');

const WEB_SOCKET_PORT = 3333;

const ROLES = {
  TRAINER: 'trainer',
  STUDENT: 'student',
};

const freeTrainers = [];
const studentsWaitingForHelp = [];

const webSocketServer = socketIO(WEB_SOCKET_PORT);

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
  student.webSocket.emit('position-in-waiting-queue', { positionInWaitingQueue: studentsWaitingForHelp.length });
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
  trainer.webSocket.emit('help-request', { studentIdentification: student.identification });
  student.webSocket.emit('trainer-assigned');
}

function notifyStudentsAboutTheirPositionsInWaitingQueue() {
  studentsWaitingForHelp.forEach(function(student, index) {
    student.webSocket.emit('position-in-waiting-queue', { positionInWaitingQueue: index + 1 });
  });
}

function handleTrainerLeaving(trainer) {
  if (trainer.student) {
    handleStudentReassignment(trainer.student);
  } else {
    pull(freeTrainers, trainer);
  }
}

function handleStudentLeaving(student) {
  if (student.trainer) {
    const trainer = student.trainer;
    trainer.student = null;
    trainer.webSocket.emit('help-request-cancellation');
    handleFreeTrainer(trainer);
  } else if (studentsWaitingForHelp.includes(student)) {
    pull(studentsWaitingForHelp, student);
    notifyStudentsAboutTheirPositionsInWaitingQueue();
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

  webSocket.on('identification', function(message) {
    connectedPerson.role           = message.role;
    connectedPerson.identification = message.identification;

    switch (message.role) {
      case ROLES.TRAINER:
        connectedPerson.student = null;
        handleFreeTrainer(connectedPerson);
        break;
      case ROLES.STUDENT:
        connectedPerson.trainer = null;
        break;
    }

    printCurrentState();
  });

  webSocket.on('help-request', function() {
    handleStudentRequestingHelp(connectedPerson);
    printCurrentState();
  });

  webSocket.on('help-provided', function() {
    const trainer = connectedPerson;
    const student = trainer.student;

    trainer.student = null;
    student.trainer = null;

    trainer.webSocket.emit('help-provided');
    student.webSocket.emit('help-provided');

    handleFreeTrainer(trainer);

    printCurrentState();
  });

  webSocket.on('disconnect', function() {
    switch (connectedPerson.role) {
      case ROLES.TRAINER:
        handleTrainerLeaving(connectedPerson);
        console.log('trainer disconnected');
        break;
      case ROLES.STUDENT:
        handleStudentLeaving(connectedPerson);
        console.log(`student (${connectedPerson.identification}) disconnected`);
        break;
    }

    printCurrentState();
  });
});

console.log('TrainerNeeded server...');
