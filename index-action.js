const { run } = require('@probot/adapter-github-actions')
const app = require('./app-action')

run(app)
