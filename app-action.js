// Use UTC for for all Date parsing
process.env.TZ = 'UTC'

const commands = require('probot-commands')
const reminders = require('./lib/reminders')
const { Octokit } = require('@octokit/action')


module.exports = robot => {
 
  // 'issue_comment.created', 'issues.opened', 'pull_request.opened'
  // new Command(name, callback)
  commands(robot, 'remind', reminders.set)

  const octokit = new Octokit();

  // call reminder checks on cron run
  robot.on('schedule', reminders.check, octokit)
}
