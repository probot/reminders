// Use UTC for for all Date parsing
process.env.TZ = 'UTC';

const parseReminder = require('parse-reminder');
const createScheduler = require('probot-scheduler');
const commands = require('probot-commands');
const Freeze = require('./lib/freeze');

const defaults = {
  reminders: {
    label: 'reminder'
  }
};

module.exports = robot => {
  commands(robot, 'remind', async (context, command) => {
    const reminder = parseReminder(command.name + ' ' + command.arguments);

    if (reminder) {
      if (reminder.who === 'me') {
        reminder.who = context.payload.comment.user.login;
      }

      const config = await context.config('config.yml', defaults);
      const freeze = new Freeze(context.github, config.reminders);

      freeze.freeze(context, reminder);
    }
  });

  createScheduler(robot);

  robot.on('schedule.repository', handleThaw);

  async function handleThaw(context) {
    const config = await context.config('config.yml', defaults);

    const freeze = new Freeze(context.github, config.reminders);
    const {owner, repo} = context.repo();
    const q = `label:"${freeze.config.label}" repo:${owner}/${repo}`;

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
