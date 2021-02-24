// Use UTC for for all Date parsing
process.env.TZ = 'UTC'

const { run } = require('@probot/adapter-github-actions')
const createScheduler = require('probot-scheduler')
const commands = require('probot-commands')
const reminders = require('./lib/reminders')

module.exports = robot => {
  createScheduler(robot, {interval: 15 * 60 * 1000})
  // 'issue_comment.created', 'issues.opened', 'pull_request.opened'
  // new Command(name, callback)
  commands(robot, 'remind', reminders.set)
  // call reminder checks on cron run
  robot.on('schedule.repository', reminders.check)
}
