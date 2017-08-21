var fs = require("fs");
const createScheduler = require('probot-scheduler');
const Freeze = require('./lib/freeze');
const formatParser = require('./lib/format-parser');
const githubHelper = require('./lib/github-helper');

/* Configuration Variables */

module.exports = robot => {
  robot.on('integration_installation.added', installationEvent);
  robot.on('issue_comment', handleFreeze);
  createScheduler(robot);

  robot.on('schedule.repository', handleThaw);

  async function installationEvent(context) {
    const config = await context.config('probot-snooze.yml', JSON.parse(fs.readFileSync('./etc/defaults.js','utf8')));

    context.github.issues.getLabel(context.repositories_added[0]({
      name: config.labelName}).catch(() => {
        return context.github.issues.createLabel(context.repositories_added[0]({
          name: config.labelName,
          color: config.labelColor
        }));
      }));
  }

  async function handleFreeze(context) {
    const config = await context.config('probot-snooze.yml', JSON.parse(fs.readFileSync('./etc/defaults.js','utf8')));
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
     const config = await context.config('probot-snooze.yml', JSON.parse(fs.readFileSync('./etc/defaults.js','utf8')));

    const freeze = new Freeze(context.github, config);

    context.github.search.issues({q:'label:' + freeze.config.labelName, repo:context.repo().full_name}).then(resp => {
      resp.data.items.forEach(issue => {
        context.github.issues.getComments(githubHelper.parseCommentURL(issue.comments_url)).then(resp => {
          return freeze.getLastFreeze(resp.data);
        }).then(lastFreezeComment => {
          if (freeze.unfreezable(lastFreezeComment)) {
            freeze.unfreeze(issue, formatParser.propFromComment(lastFreezeComment));
          }
        });
      });
    });
    console.log('scheduled thaw run complete');
  }
};
