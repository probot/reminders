module.exports = {
  probotUsername: (process.env.APP_NAME || 'probot-snooze') + '[bot]',
  labelName: 'probot:snooze',
  labelColor: 'gray',
  defaultFreezeDuration: 7,
  sampleFormat: '@probot, freeze this thread until 2100-01-01 with "A message I\'ll respond with"'
};
