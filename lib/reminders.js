const moment = require('moment');
const metadata = require('probot-metadata');
const parseReminder = require('parse-reminder');

const defaults = {
  reminders: {
    label: 'reminder'
  }
};

module.exports = {
  async set(context, command) {
    const reminder = parseReminder(command.name + ' ' + command.arguments);

    if (reminder) {
      if (reminder.who === 'me') {
        reminder.who = context.payload.comment.user.login;
      }

      const config = await context.config('config.yml', defaults);

      const labels = context.payload.issue.labels;
      if (!labels.find(label => label.name === config.reminders.label)) {
        labels.push(config.reminders.label);
      }
      await context.github.issues.edit(context.issue({labels}));

      await metadata(context).set(reminder);

      await context.github.issues.createComment(context.issue({
        body: `@${context.payload.sender.login} set a reminder for **${moment(reminder.when).calendar()}**`
      }));
    }
  },

  async check(context) {
    const config = await context.config('config.yml', defaults);

    const {owner, repo} = context.repo();
    const q = `label:"${config.reminders.label}" repo:${owner}/${repo}`;

    const resp = await context.github.search.issues({q});

    await Promise.all(resp.data.items.map(async issue => {
      // Issue objects from the API don't include owner/repo params, so
      // setting them here with `context.repo` so we don't have to worry
      // about it later. :/
      issue = context.repo(issue);

      const reminder = await metadata(context, issue).get();

      if (moment(reminder.when) < moment()) {
        const labels = issue.labels;
        const frozenLabel = labels.find(label => {
          return label.name === config.reminders.label;
        });
        const pos = labels.indexOf(frozenLabel);
        labels.splice(pos, 1);

        const {owner, repo, number} = issue;

        await context.github.issues.edit({owner, repo, number, labels, state: 'open'});

        await context.github.issues.createComment({
          owner, repo, number,
          body: ':wave: @' + reminder.who + ', ' + reminder.what
        });
      }
    }));
  }
};
