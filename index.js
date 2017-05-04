const visitor = require('probot-visitor');
const Freeze = require('./lib/freeze');
const formatParser = require('./lib/format-parser');

/* Configuration Variables */

module.exports = robot => {
  robot.on('integration_installation.added', config);
  robot.on('issue_comment', handleFreeze);
  visitor(robot, {interval: 60 * 30 * 1000}, handleThaw);

  async function config(event) {
    const github = await robot.auth(event.payload.installation.id);
    const freeze = new Freeze(github, {});

    freeze.repoConfig();
  }

  async function handleFreeze(event, context) {
    const github = await robot.auth(event.payload.installation.id);
    const freeze = new Freeze(github, {});
    const comment = event.payload.comment;
    if (!context.isBot && freeze.freezable(comment.body)) {
      freeze.freeze(
        context,
        freeze.propsHelper(context.event.payload.comment.user.login, comment.body)
    );
    }
  }

  async function handleThaw(installation) {
    const github = await robot.auth(installation.id);
    const freeze = new Freeze(github, {});

    const frozenIssues = await github.search.issues({q:'label:' + this.labelName});
    frozenIssues.items.forEach(issue => {
      const comment = formatParser.getLastFreeze(github.issues.getComments(formatParser.commentUrlToIssueRequest(issue.comments_url)));

      if (freeze.unfreezable(comment)) {
        freeze.unfreeze(issue, formatParser.propFromComment(comment));
      }
    });
  }
};
