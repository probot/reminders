const yaml = require('js-yaml');
const visitor = require('probot-visitor');
const Freeze = require('./lib/freeze');
const formatParser = require('./lib/format-parser');
const githubHelper = require('./lib/github-helper');

/* Configuration Variables */

module.exports = robot => {
  robot.on('integration_installation.added', config);
  robot.on('issue_comment', handleFreeze);
  const visit = visitor(robot, {interval: 60 * 5 * 1000}, handleThaw);

  async function config(event) {
    const freeze = await forRepository(context.github, event.payload.repository);

    context.github.issues.getLabel(context.repositories_added[0]({
      name: freeze.labelName}).catch(() => {
        return context.github.issues.createLabel(context.repositories_added[0]({
          name: freeze.config.labelName,
          color: freeze.config.labelColor
        }));
      }));
  }

  async function handleFreeze(context) {
    const freeze = await forRepository(context.github, context.payload.repository);
    const comment = context.payload.comment;
    freeze.config.perform = true;
    if (freeze.config.perform && !context.isBot && freeze.freezable(comment)) {
      freeze.freeze(
        context,
        freeze.propsHelper(comment.user.login, comment.body)
    );
    }
  }

  async function handleThaw(installation, repository) {
    const freeze = await forRepository(context.github, repository);

    const frozenIssues = await context.github.search.issues({q:'label:' + this.labelName});
    frozenIssues.items.forEach(issue => {
      const comment = freeze.getLastFreeze(context.github.issues.getComments(githubHelper.commentUrlToIssueRequest(issue.comments_url)));

      if (freeze.unfreezable(comment)) {
        freeze.unfreeze(issue, formatParser.propFromComment(comment));
      }
    });
  }

  async function forRepository(github, repository) {
    const owner = repository.owner.login;
    const repo = repository.name;
    const path = '.github/probot-freeze.yml';
    let config = {};

    try {
      const data = await github.repos.getContent({owner, repo, path});

      config = Object.assign(yaml.load(Buffer.from(data.content, 'base64').toString()) || {}, {perform:true});
    } catch (err) {
      console.log('error', err);
      visit.stop(repository);
    }

    config = Object.assign(config, {owner, repo, logger: robot.log});

    return new Freeze(github, config);
  }
};
