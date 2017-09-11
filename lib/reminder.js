const chrono = require('chrono-node');

const matcher = /^remind (me)(?: to )?(.*)$/;

module.exports = (input, from) => {
  const match = input.match(matcher);
  if (!match) {
    return null;
  }

  let [, who, what] = match;

  const when = chrono.parse(what, from, {forwardDate: true});
  when[0].start.assign('timezoneOffset', 0);

  when.forEach(w => {
    what = what.replace(w.text, '');
  });

  what = what.trim();
  what = what.replace(/^(to|that) /, '').replace(/ on$/, '');

  return {who, what, when: when[0].start.date()};
};
