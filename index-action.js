const { run } = require('@probot/adapter-github-actions')
const app = require('./app')

run(app)
