// Use UTC for for all Date parsing
process.env.TZ = 'UTC';

const fs = require('fs');
const parseReminder = require('parse-reminder');
const createScheduler = require('probot-scheduler');
const commands = require('probot-commands');
const Freeze = require('./lib/freeze');

/* Configuration Variables */

module.exports = robot => {
  commands(robot, 'remind', async (context, command) => {
    const reminder = parseReminder(command.name + ' ' + command.arguments);

    if (reminder) {
      if (reminder.who === 'me') {
        reminder.who = context.payload.comment.user.login;
      }

      const config = await context.config('probot-snooze.yml', JSON.parse(fs.readFileSync('./etc/defaults.json', 'utf8')));
      const freeze = new Freeze(context.github, config);

      freeze.freeze(context, {
        assignee: reminder.who,
        unfreezeMoment: reminder.when,
        message: reminder.what
      });
    }
  });

  robot.on('integration_installation.added', installationEvent);

  robot.on('issue_comment', handleFreeze);
  createScheduler(robot);

  robot.on('schedule.repository', handleThaw);

  async function installationEvent(context) {
    const config = await context.config('probot-snooze.yml', JSON.parse(fs.readFileSync('./etc/defaults.json', 'utf8')));

    context.github.issues.getLabel(context.repositories_added[0]({
      name: config.labelName}).catch(() => {
        return context.github.issues.createLabel(context.repositories_added[0]({
          name: config.labelName,
          color: config.labelColor
        }));
      }));
  }

  async function handleFreeze(context) {
    const config = await context.config('probot-snooze.yml', JSON.parse(fs.readFileSync('./etc/defaults.json', 'utf8')));
    const freeze = new Freeze(context.github, config);

    const comment = context.payload.comment;
    freeze.config.perform = true;
    if (freeze.config.perform && !context.isBot && freeze.freezable(comment)) {
      freeze.freeze(
        context,
        freeze.propsHelper(comment.user.login, comment.body)
    );
    }
  }

  async function handleThaw(context) {
    const config = await context.config('probot-snooze.yml', JSON.parse(fs.readFileSync('./etc/defaults.json', 'utf8')));

    const freeze = new Freeze(context.github, config);
    const {owner, repo} = context.repo();
    const q = `label:"${freeze.config.labelName}" repo:${owner}/${repo}`;

    const resp = await context.github.search.issues({q});

    await Promise.all(resp.data.items.map(issue => {
      // Issue objects from the API don't include owner/repo params, so
      // setting them here with `context.repo` so we don't have to worry
      // about it later. :/
      return freeze.checkUnfreeze(context, context.repo(issue));
    }));
    robot.log('scheduled thaw run complete');
  }
};
