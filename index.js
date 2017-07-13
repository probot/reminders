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
  robot.on('test.visit', context => {
    handleThaw(75, context.payload.repository);
  });

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
    const github = await robot.auth(installation.id);
    const freeze = await forRepository(github, repository);

    github.search.issues({q:'label:' + this.labelName}).then(issues => {
      issues.items.forEach(issue => {
        github.issues.getComments(githubHelper.commentUrlToIssueRequest(issue.comments_url)).then(comments => {
          return freeze.getLastFreeze(comments);
        }).then(lastFreezeComment => {
          if (freeze.unfreezable(lastFreezeComment)) {
            freeze.unfreeze(issue, formatParser.propFromComment(lastFreezeComment));
          }
        });
      });
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
