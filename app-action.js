// Use UTC for for all Date parsing
process.env.TZ = 'UTC'

const commands = require('probot-commands')
const reminders = require('./lib/reminders')

module.exports = robot => {

  /*
{o

   const repo = this.payload.repository;
        if (!repo) {
            throw new Error("context.repo() is not supported for this webhook event.");
        }
        return Object.assign({
            owner: repo.owner.login || repo.owner.name,
            repo: repo.name,
        }, object);
        */
  // 'issue_comment.created', 'issues.opened', 'pull_request.opened'
  // new Command(name, callback)
  commands(robot, 'remind', reminders.set)
  // call reminder checks on cron run
  robot.on('schedule', reminders.check)
}
