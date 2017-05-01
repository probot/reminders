module.exports = robot => {
    // Your plugin code here
  const labelName = 'probot:stale';
  const labelColor = 'gray';

  const check = msg => {
    const expression = '@probot.*freeze';
    if (msg.match(expression)) {
      return true;
    }
  };

  const getDate = msg => {
    const expression = 'until (.*)';
    const match = msg.match(expression);
    if (match !== null) {
      console.log(match);
      console.log(match[1]);
    }
    return new Date();
  };

  const freeze = function (context, github, freezeDate) {
        /*
        Const options = context.repo({path: '.github/ISSUE_REPLY_TEMPLATE.md'});
        const data = await github.repos.getContent(options);
        const template = new Buffer(data.content, 'base64').toString();
        */
    github.issues.createComment(context.issue({
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around ' + freezeDate.toString()
    }));
    const existing = context.event.payload.issue.labels.find(elm => {
      return typeof (elm) === 'object' && Object.prototype.hasOwnProperty.call(elm, 'name') && elm.name === labelName;
    });
    const labels = context.event.payload.issue.labels;
    if (existing === undefined) {
      labels.push(labelName);
    }
    return github.issues.edit(context.issue({
      state: 'closed',
      labels
    }));
  };

/*
Const unfreeze = function(github, context) => {
const labels = context.event.payload.issue.labels.filter(elm => {
  return !(typeof (elm) === 'object' && Object.prototype.hasOwnProperty.call(elm, 'name') && elm.name === labelName);
});
Github.issues.edit(context.issue({
  state: 'open',
  labels
}));
};
*/
    // For more information on building plugins
    // https://github.com/probot/probot/blob/master/docs/plugins.md

    // To get your plugin running against GitHub, see:
    // https://github.com/probot/probot/blob/master/docs/development.md

  robot.on('integration_installation.created', async (event, context) => {
    const github = await robot.auth(event.payload.installation.id);
    github.issues.createLabel(context.repositories_added[0]({
      name: labelName,
      color: labelColor
    }));
  });

  robot.on('issue_comment', async (event, context) => {
    /* Event is a wrapper around a GitHub WebHook
    // event.payload is the payload example
    // event also has an "event" which is the wehook name, an if in GUID form, protocol which is??, host which is the webhook destination, and url which is the webhook destination full address
    // context is a special object with some of the good event payload info, with tons of helper functions
    */
    const github = await robot.auth(event.payload.installation.id);
    if (check(event.payload.comment.body)) {
      const freezeDate = getDate(event.payload.comment.body);
      freeze(context, github, freezeDate);
    }
  });
};
