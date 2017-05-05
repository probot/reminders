const moment = require('moment');
const chrono = require('chrono-node');

module.exports = {
  parseDateFromComment(msg) {
    const parseDate = chrono.parseDate(msg);
    return moment(parseDate);
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
  }

};
