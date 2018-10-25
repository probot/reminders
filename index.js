// Use UTC for for all Date parsing
process.env.TZ = 'UTC'

const createScheduler = require('probot-scheduler')
const commands = require('probot-commands')
const reminders = require('./lib/reminders')

module.exports = app => {
  createScheduler(app, {interval: 15 * 60 * 1000})
  commands(app, 'remind', reminders.set)
  app.on('schedule.repository', reminders.check)
}
