class Command {
  constructor(name, callback) {
    this.name = name;
    this.callback = callback;
  }

  get matcher() {
    return /^\/([\w]+)\b *(.*)?$/m;
  }

  listener(context) {
    const command = context.payload.comment.body.match(this.matcher);

    if (command && this.name.match(command[1])) {
      return this.callback(context, {name: command[1], arguments: command[2]});
    }
  }
}

/**
 * Probot extension to abstract pattern for receiving slash commands in comments.
 *
 * @example
 *
 * // Type `/label foo, bar` in a comment box to add labels
 * commands(robot, 'label', (context, command) => {
 *   const labels = command.arguments.split(/, *\/);
 *   context.github.issues.addLabels(context.issue({labels}));
 * });
 */
module.exports = (robot, name, callback) => {
  const command = new Command(name, callback);
  robot.on('issue_comment.created', command.listener.bind(command));
};

module.exports.Command = Command;
