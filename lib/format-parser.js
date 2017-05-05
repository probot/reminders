const moment = require('moment');
const chrono = require('chrono-node');
const defaultFreezeDuration = 7;
const probotUsername = 'probot-freeze[bot]';

module.exports = {
  parseDateFromComment(msg) {
    const parseDate = chrono.parse(msg);
    return moment(parseDate) || moment().add(defaultFreezeDuration, 'days');
  },

  parseResponseMessageFromComment(msg) {
    const expression = 'until .* with "?(.*)"?';
    const match = msg.match(expression);
    if (match !== null) {
      return match[1];
    }
    return 'Hey, we\'re back awake!';
  },

  propFromComment(comment) {
    const match = comment.body.match('.*<!-- (props = )?(.*)-->');
    if (match !== null) {
      return JSON.parse(match[2]);
    }
    return {};
  },

  getLastFreeze(thread) {
    let mainComment = {};
    thread.then(comments => {
      comments.reverse().some(comment => {
        if (comment.user.login === probotUsername) {
          mainComment = comment;
          return true;
        }
        return false;
      });
    });
    return mainComment;
  }

};
