// Use UTC for for all Date parsing
process.env.TZ = 'UTC';

const createScheduler = require('probot-scheduler');
const commands = require('probot-commands');
const reminders = require('./lib/reminders');

module.exports = robot => {
  createScheduler(robot, {interval: 5 * 60 * 1000 /* 5 minutes */});
  commands(robot, 'remind', reminders.set);
  robot.on('schedule.repository', reminders.check);
};
