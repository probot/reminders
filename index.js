const yaml = require('js-yaml');
const visitor = require('probot-visitor');
const Freeze = require('./lib/freeze');
const formatParser = require('./lib/format-parser');

/* Configuration Variables */

module.exports = robot => {
  robot.on('integration_installation.added', config);
  robot.on('issue_comment', handleFreeze);
  const visit = visitor(robot, {interval: 60 * 30 * 1000}, handleThaw);

  async function config(event) {
    const github = await robot.auth(event.payload.installation.id);
    const freeze = forRepository(github, event.payload.repository);

    github.issues.getLabel(context.repositories_added[0]({
      name: freeze.labelName}).catch(() => {
        return github.issues.createLabel(context.repositories_added[0]({
          name: freeze.config.labelName,
          color: freeze.config.labelColor
        }));
      }));
  }

  async function handleFreeze(event, context) {
    const github = await robot.auth(event.payload.installation.id);
    const freeze = forRepository(github, event.payload.repository);
    const comment = event.payload.comment;
    if (!context.isBot && freeze.freezable(comment.body)) {
      freeze.freeze(
        context,
        freeze.propsHelper(context.event.payload.comment.user.login, comment.body)
    );
    }
  }

  async function handleThaw(installation, repository) {
    const github = await robot.auth(installation.id);
    const freeze = forRepository(github, repository);

    const frozenIssues = await github.search.issues({q:'label:' + this.labelName});
    frozenIssues.items.forEach(issue => {
      const comment = formatParser.getLastFreeze(github.issues.getComments(formatParser.commentUrlToIssueRequest(issue.comments_url)));

      if (freeze.unfreezable(comment)) {
        freeze.unfreeze(issue, formatParser.propFromComment(comment));
      }
    });
  }

  async function forRepository(github, repository) {
    const owner = repository.owner.login;
    const repo = repository.name;
    const path = '.github/probot-freeze.yml';
    let config;

    try {
      const data = await github.repos.getContent({owner, repo, path});
      config = yaml.load(new Buffer(data.content, 'base64').toString()) || {};
    } catch (err) {
      visit.stop(repository);
      // Don't actually perform for repository without a config
      config = {perform: false};
    }

    config = Object.assign(config, {owner, repo, logger: robot.log});

    return new Freeze(github, config);
  }
};
