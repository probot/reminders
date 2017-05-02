const moment = require('moment');
const visitor = require('probot-visitor');

module.exports = robot => {
    // Your plugin code here
  const username = 'probot-freeze[bot]';
  const labelName = 'probot:freeze';
  const labelColor = 'gray';

  const check = msg => {
    const expression = '@probot.*[freeze|archive]';
    if (msg.match(expression)) {
      return true;
    }
  };

  const parseDate = msg => {
    const expression = 'until (.*) with';
    const match = msg.match(expression);
    if (match !== null) {
      const freezeDate = moment(match[1]);
      if (freezeDate.isValid()) {
        return freezeDate;
      }
    }
    return moment().add(7, 'days');
  };

  const parseMessage = msg => {
    const expression = 'until .* with "?(.*)"?';
    const match = msg.match(expression);
    if (match !== null) {
      return match[1];
    }
    return 'Hey, we\'re back awake!';
  };

  const commentUrlToIssueRequest = url => {
    const match = url.match('https://api.github.com/repos/(.*)/(.*)/issues/(.*)/comments');
    if (match === null) {
      return {};
    } else {
      return {
        owner:match[1],
        repo:match[2],
        number:match[3]
      };
    }
  };

  const freeze = function (context, github, props) {
        /*
        Const options = context.repo({path: '.github/ISSUE_REPLY_TEMPLATE.md'});
        const data = await github.repos.getContent(options);
        const template = new Buffer(data.content, 'base64').toString();
        */

    const existing = context.event.payload.issue.labels.find(elm => {
      return typeof (elm) === 'object' && Object.prototype.hasOwnProperty.call(elm, 'name') && elm.name === labelName;
    });

    const labels = context.event.payload.issue.labels;
    if (existing === undefined) {
      labels.push(labelName);
    }

    github.issues.edit(context.issue({
      state: 'closed',
      labels
    }));

    github.issues.createComment(context.issue({
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around ' + props.unfreezeMoment.calendar() + ' :clock1: ' +
      '<!-- ' + JSON.stringify(props) + '-->'
    }));
  };

  const unfreeze = (github, issue, props) => {
    const labels = issue.labels;
    const frozenLabel = labels.find(label => {
      return label.name === labelName;
    });
    const pos = labels.indexOf(frozenLabel);
    labels.splice(pos, 1);
    github.issues.edit(Object.assign(commentUrlToIssueRequest(issue.comments_url), {
      state: 'open',
      labels
    }));

    github.issues.createComment(Object.assign(commentUrlToIssueRequest(issue.comments_url), {
      body: ':wave: @' + props.assignee + ', ' + props.message
    }));
  };

  robot.on('integration_installation.added', async (event, context) => {
    const github = await robot.auth(event.payload.installation.id);
    github.issues.createLabel(context.repositories_added[0]({
      name: labelName,
      color: labelColor
    }));
  });

  const propFromComment = comment => {
// Read comment, find json comment, eval, return
    const match = comment.match('.*<!-- (props = )?(.*)-->');
    if (match !== null) {
      return eval(match[2]);
    }
    return {};
  };

  robot.on('issue_comment', async (event, context) => {
    const github = await robot.auth(event.payload.installation.id);
    const commentBody = event.payload.comment.body;
    if (check(commentBody)) {
      const props = {
        assignee: context.event.payload.comment.user.login,
        unfreezeMoment: parseDate(commentBody),
        message: parseMessage(commentBody)
      };
      freeze(context, github, props);
    }
  });

  visitor(robot, {interval: 60 * 30 * 1000}, async (installation, repository) => {
    const github = await robot.auth(installation.id);

    const frozenIssues = await github.search.issues({q:'label:' + labelName});
    frozenIssues.items.forEach(issue => {
      let props = null;
      github.issues.getComments(commentUrlToIssueRequest(issue.comments_url)).then(comments => {
        comments.reverse().some(comment => {
          if (comment.user.login === username) {
            props = propFromComment(comment.body);
            return true;
          }
          return false;
        });
        if (moment(props.unfreezeMoment) < moment()) {
          console.log('unfreezing');
          unfreeze(github, issue, props);
        }
      });
    });
  });
};
