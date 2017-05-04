const formatParser = require('./format-parser');
const GitHubHelper = require('./github-helper');
const moment = require('moment');

const labelName = 'probot:freeze';
const labelColor = 'gray';

module.exports = class Freeze {

  constructor(github, config = {}) {
    this.github = github;
    this.config = Object.assign({}, require('./defaults'), config || {});
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
      unfreezeMoment: formatParser.parseDateFromComment(commentBody),
      message: formatParser.parseResponseMessageFromComment(commentBody)
    };
  }
  repoConfig(event, context) {
    // Const github = await robot.auth(event.payload.installation.id);
    const github = {};
    this.github.issues.getLabel(context.repositories_added[0]({
      name: labelName}).catch(() => {
        return github.issues.createLabel(context.repositories_added[0]({
          name: labelName,
          color: labelColor
        }));
      }));
  }
  freeze(context, props) {
    const currentLabels = context.event.payload.issue.labels.find(elm => {
      return typeof (elm) === 'object' && Object.prototype.hasOwnProperty.call(elm, 'name') && elm.name === labelName;
    });

    const labels = context.event.payload.issue.labels;
    if (currentLabels === undefined) {
      labels.push(labelName);
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
      return label.name === labelName;
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
