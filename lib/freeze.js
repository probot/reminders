const moment = require('moment');
const Bravey = require('bravey');
const formatParser = require('./format-parser');
const GitHubHelper = require('./github-helper');

module.exports = class Freeze {

  constructor(github, config = {}) {
    this.github = github;
    this.config = Object.assign({}, require('./defaults'), config);
    this.logger = config.logger || console;

    this.nlp = this.getSnoozeBravey();
  }

  freezable(comment) {
    return this.nlp.test(comment.body) !== false;
  }

  unfreezable(comment) {
    return moment(formatParser.propFromComment(comment).unfreezeMoment) < moment();
  }

  propsHelper(assignee, commentBody) {
    const pd = formatParser.parseDateFromComment(commentBody);
    console.log('parsed this comment: ', commentBody, '\nParsed this date: ', pd);
    return {
      assignee,
      unfreezeMoment: pd || moment().add(this.config.defaultFreezeDuration, 'days'),
      message: formatParser.parseResponseMessageFromComment(commentBody)
    };
  }

  getLastFreeze(comments) {
    let mainComment = {};
    comments.reverse().some(comment => {
      if (comment.user.login === this.config.probotUsername) {
        mainComment = comment;
        return true;
      }
      return false;
    });
    return mainComment;
  }

  freeze(context, props) {
    const labels = context.payload.issue.labels;
    if (GitHubHelper.isLabelOnIssue(
      context.payload.issue,
      this.config.labelName) === undefined) {
      labels.push(this.config.labelName);
    }

    this.github.issues.edit(context.issue({
      state: 'closed',
      labels
    }));

    this.github.issues.createComment(context.issue({
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around ' + props.unfreezeMoment.calendar() + ' :clock1: ' +
      '<!-- ' + JSON.stringify(props) + '-->'
    }));
  }

  unfreeze(issue, props) {
    const labels = issue.labels;
    const frozenLabel = labels.find(label => {
      return label.name === this.config.labelName;
    });
    const pos = labels.indexOf(frozenLabel);
    labels.splice(pos, 1);

    this.github.issues.edit(Object.assign(GitHubHelper.parseCommentURL(issue.comments_url), {
      state: 'open',
      labels
    }));

    this.github.issues.createComment(Object.assign(GitHubHelper.parseCommentURL(issue.comments_url), {
      body: ':wave: @' + props.assignee + ', ' + props.message
    }));
  }

  getSnoozeBravey() {
    const nlp = new Bravey.Nlp.Fuzzy();

    nlp.addIntent('snooze_request', [{entity: 'cognomen', id: 'cognomen'}, {entity: 'command', id: 'command'}, {entity: 'reopen_text', id:'reopen_text'}]);

    const robotEntity =
  new Bravey.StringEntityRecognizer('cognomen');
    robotEntity.addMatch('robot', '@probot');
    robotEntity.addMatch('robot', '@probot-freeze');
    robotEntity.addMatch('robot', 'probot');
    robotEntity.addMatch('robot', 'robot');

    const commandEntity =
  new Bravey.StringEntityRecognizer('command');
    commandEntity.addMatch('snooze', 'snooze');
    commandEntity.addMatch('freeze', 'freeze');

    const responseEntity = new Bravey.RegexEntityRecognizer('reopen_text');
    /* ResponseEntity.addMatch(new RegExp('remind me to (.*) again'), vals  => { */
    responseEntity.addMatch(new RegExp('remind me to (.*) again'), () => {
      return undefined;
    // Return {
    //   position: 1,
    //   entity: 'reopen_text',
    //   value: 'foo',
    //   string: 'foo',
    //   priority: .9
    // };
    });

  /*  */
    nlp.addEntity(robotEntity);
    nlp.addEntity(commandEntity);
    nlp.addEntity(responseEntity);

  // Nlp.addDocument("{command_name} this issue", "snooze_request", {fromTaggedSentence: true});
  // nlp.addDocument("{command_name} this thread until dtg", "snooze_request", {fromTaggedSentence: true});
  // nlp.addDocument("Hey {robot_address}! Will you {command_name} this issue until dtg?", "snooze_request", {fromTaggedSentence: true});
  // nlp.addDocument("I'm going to pause this for the time being. I'll {command_name} this til dtg", "snooze_request", {fromTaggedSentence: true});

  // nlp.addDocument("", "snooze_request", {fromTaggedSentence: true});

    nlp.addDocument('{cognomen}, {command} this thread until dtg. remind me to {reopen_text}', 'snooze_request');

    return nlp;
  }
};
