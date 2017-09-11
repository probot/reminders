const moment = require('moment');
const metadata = require('probot-metadata');
const GitHubHelper = require('./github-helper');

module.exports = class Freeze {

  constructor(github, config) {
    this.github = github;
    this.config = config;
    this.logger = config.logger || console;
  }

  async freeze(context, props) {
    const labels = context.payload.issue.labels;
    if (GitHubHelper.isLabelOnIssue(
      context.payload.issue,
      this.config.labelName) === undefined) {
      labels.push(this.config.labelName);
    }

    await metadata(context).set(props);

    await this.github.issues.edit(context.issue({
      state: 'closed',
      labels
    }));

    await this.github.issues.createComment(context.issue({
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around ' +
      moment(props.unfreezeMoment).calendar() + ' :clock1: '
    }));
  }

  async checkUnfreeze(context, issue) {
    const props = await metadata(context, issue).get();

    if (moment(props.unfreezeMoment) < moment()) {
      return this.unfreeze(issue, props);
    }
  }

  async unfreeze(issue, props) {
    const labels = issue.labels;
    const frozenLabel = labels.find(label => {
      return label.name === this.config.labelName;
    });
    const pos = labels.indexOf(frozenLabel);
    labels.splice(pos, 1);

    const {owner, repo, number} = issue;

    await this.github.issues.edit({owner, repo, number, labels, state: 'open'});

    await this.github.issues.createComment({
      owner, repo, number,
      body: ':wave: @' + props.assignee + ', ' + props.message
    });
  }
};
