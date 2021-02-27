// Use UTC for for all Date parsing
process.env.TZ = 'UTC'

const commands = require('probot-commands')
const reminders = require('./lib/reminders')


module.exports = robot => {
 
//  robot.on(['issue_comment.created', 'issues.opened', 'pull_request.opened'], testCommand)
// commands may be a reusable pattern to pass the right octokit downstream for probot and actions usage  
commands(robot, 'remind', reminders.set)
  robot.on('schedule', reminders.check)
}

testCommand = function(context){
  /^\/([\w]+)\b *(.*)?$/m
  //look for remind
  reminders.set(context);
}
