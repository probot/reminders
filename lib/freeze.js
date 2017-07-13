const moment = require('moment');
const formatParser = require('./format-parser');
const GitHubHelper = require('./github-helper');

module.exports = class Freeze {

  constructor(github, config = {}) {
    this.github = github;
    this.config = Object.assign({}, require('./defaults'), config);
    this.logger = config.logger || console;
  }

  freezable(comment) {
    const expression = '@probot(-freeze[bot])?.*[freeze|archive|suspend]';
    if (comment.body.match(expression)) {
      return true;
    }
    return false;
  }
  unfreezable(comment) {
    return moment(formatParser.propFromComment(comment.body).unfreezeMoment) < moment();
  }
  propsHelper(assignee, commentBody) {
    return {
      assignee,
      unfreezeMoment: formatParser.parseDateFromComment(commentBody) || moment().add(this.config.defaultFreezeDuration, 'days'),
      message: formatParser.parseResponseMessageFromComment(commentBody)
    };
  }

  getLastFreeze(thread) {
    let mainComment = {};
    thread.then(comments => {
      comments.reverse().some(comment => {
        if (comment.user.login === this.config.probotUsername) {
          mainComment = comment;
          return true;
        }
        return false;
      });
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
    this.github.issues.edit(Object.assign(GitHubHelper.commentUrlToIssueRequest(issue.comments_url), {
      state: 'open',
      labels
    }));

    this.github.issues.createComment(Object.assign(GitHubHelper.commentUrlToIssueRequest(issue.comments_url), {
      body: ':wave: @' + props.assignee + ', ' + props.message
    }));
  }
};
