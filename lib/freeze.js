const moment = require('moment');
const Bravey = require('bravey');
const metadata = require('probot-metadata');
const formatParser = require('./format-parser');
const GitHubHelper = require('./github-helper');

module.exports = class Freeze {

  constructor(github, config) {
    this.github = github;
    this.config = config;
    this.logger = config.logger || console;

    this.nlp = this.getSnoozeBravey();
  }

  freezable(comment) {
    return this.nlp.test(comment.body) !== false;
  }

  propsHelper(assignee, commentBody) {
    const pd = formatParser.parseDateFromComment(commentBody);

    return {
      assignee,
      unfreezeMoment: pd.isValid() ? pd : moment().add(this.config.defaultFreezeDuration, 'days').format(),
      message: formatParser.parseResponseMessageFromComment(commentBody)
    };
  }

  getLastFreeze(comments) {
    return comments.reverse().find(comment => {
      return comment.user.login === this.config.probotUsername;
    });
  }

  async freeze(context, props) {
    const labels = context.payload.issue.labels;
    if (GitHubHelper.isLabelOnIssue(
      context.payload.issue,
      this.config.labelName) === undefined) {
      labels.push(this.config.labelName);
    }

    const kv = metadata(context.github, context.issue(), process.env.APP_ID);
    await kv.set('snooze', props);

    await this.github.issues.edit(context.issue({
      state: 'closed',
      labels
    }));

    await this.github.issues.createComment(context.issue({
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around ' +
      moment(props.unfreezeMoment).calendar() + ' :clock1: '
    }));
  }

  async checkUnfreeze(issue) {
    const kv = metadata(this.github, issue, process.env.APP_ID);
    const props = await kv.get('snooze');

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

  getSnoozeBravey() {
    const nlp = new Bravey.Nlp.Fuzzy();

    nlp.addIntent('snooze_request', [{entity: 'cognomen', id: 'cognomen'}, {entity: 'command', id: 'command'}, {entity: 'reopen_text', id:'reopen_text'}]);

    const robotEntity = new Bravey.StringEntityRecognizer('cognomen');
    robotEntity.addMatch('robot', '@probot');
    robotEntity.addMatch('robot', '@probot-freeze');
    robotEntity.addMatch('robot', 'probot');
    robotEntity.addMatch('robot', 'robot');

    const commandEntity = new Bravey.StringEntityRecognizer('command');
    commandEntity.addMatch('snooze', 'snooze');
    commandEntity.addMatch('freeze', 'freeze');

    const responseEntity = new Bravey.RegexEntityRecognizer('reopen_text');
    responseEntity.addMatch(new RegExp('foo bar (.*) again'), () => {
      return undefined;
    });

    nlp.addEntity(robotEntity);
    nlp.addEntity(commandEntity);
    nlp.addEntity(responseEntity);

    nlp.addDocument('{cognomen}, {command} this thread until dtg. remind me to {reopen_text}', 'snooze_request');

    return nlp;
  }
};
