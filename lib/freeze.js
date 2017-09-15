const moment = require('moment');
const metadata = require('probot-metadata');

module.exports = class Freeze {

  constructor(github, config) {
    this.github = github;
    this.config = config;
    this.logger = config.logger || console;
  }

  async freeze(context, props) {
    const labels = context.payload.issue.labels;
    if (!labels.find(label => label.name === this.config.label)) {
      labels.push(this.config.label);
    }

    await metadata(context).set(props);

    await this.github.issues.edit(context.issue({labels}));

    await this.github.issues.createComment(context.issue({
      body: `@${context.payload.sender.login} set a reminder for **${moment(props.when).calendar()}**`
    }));
  }

  async checkUnfreeze(context, issue) {
    const props = await metadata(context, issue).get();

    if (moment(props.when) < moment()) {
      return this.unfreeze(issue, props);
    }
  }

  async unfreeze(issue, props) {
    const labels = issue.labels;
    const frozenLabel = labels.find(label => {
      return label.name === this.config.label;
    });
    const pos = labels.indexOf(frozenLabel);
    labels.splice(pos, 1);

    const {owner, repo, number} = issue;

    await this.github.issues.edit({owner, repo, number, labels, state: 'open'});

    await this.github.issues.createComment({
      owner, repo, number,
      body: ':wave: @' + props.who + ', ' + props.what
    });
  }
};
