const moment = require('moment')
const metadata = require('probot-metadata')
const parseReminder = require('parse-reminder')
const { Octokit } = require('@octokit/action')


const LABEL = 'reminder'

module.exports = {
  async set(context, command) {

    const octokit = new Octokit();

    const reminder = parseReminder(command.name + ' ' + command.arguments)

    if (reminder) {
      if (reminder.who === 'me') {
        reminder.who = context.payload.sender.login
      }

      let { labels } = context.payload.issue
      // Add reminder label if it doesn't already exist.
      if (!labels.find(({ name }) => name === LABEL)) {
        labels.push(LABEL)
      }
      await octokit.issues.update(context.issue({ labels }))

      let metadataset = async function(octokit, issue, key){

        const regex = /\n\n<!-- probot = (.*) -->/

        let body = issue.body
        let data = {}
  
        if (!body) body = (await octokit.issues.get(issue)).data.body || ''
  
        body = body.replace(regex, (_, json) => {
          data = JSON.parse(json)
          return ''
        })
  
        if (!data['foo']) data['foo'] = {}
  
        if (typeof key === 'object') {
          Object.assign(data['foo'], key)
        } else {
          data['foo'][key] = value
        }
  
        body = `${body}\n\n<!-- probot = ${JSON.stringify(data)} -->`
  
        const { owner, repo, issue_number } = issue
        return octokit.issues.update({ owner, repo, issue_number, body })

      } 
      await metadataset(octokit, context.payload.issue, reminder)

       
      await octokit.issues.createComment(context.issue({
        body: `@${context.payload.sender.login} set a reminder for **${moment(reminder.when).format('MMM Do YYYY')}**`
      }))
    } else {
      await octokit.issues.createComment(context.issue({
        body: `@${context.payload.sender.login} we had trouble parsing your reminder. Try:\n\n\`/remind me [what] [when]\``
      }))
      throw new Error(`Unable to parse reminder: remind ${command.arguments}`)
    }
  },

  async check(context) {

    const octokit = new Octokit();

    const { owner, repo } = Object.assign({
      owner: process.env.GITHUB_REPOSITORY.split("/")[0],
      repo: process.env.GITHUB_REPOSITORY.split("/")[1]
    }, {});

    const q = `label:"${LABEL}" repo:${owner}/${repo}`

    const resp = await octokit.search.issuesAndPullRequests({ q })

    await Promise.all(resp.data.items.map(async issue => {
      // Issue objects from the API don't include owner/repo params, so
      // setting them here with `context.repo` so we don't have to worry
      // about it later. :/
      issue = Object.assign(
        {
          owner: process.env.GITHUB_REPOSITORY.split("/")[0],
          repo: process.env.GITHUB_REPOSITORY.split("/")[1]
        }, issue)
      const { owner, repo, number } = issue

      const issueNumber = number
      
      get = async function(octokit, issue){
        const regex = /\n\n<!-- probot = (.*) -->/

        let body = issue.body
  
        if (!body) {
          body = (await octokit.issues.get(issue)).data.body || ''
        }
  
        const match = body.match(regex)
  
        if (match) {
          const data = JSON.parse(match[1])[prefix]
          return reminder = key ? data && data[key] : data
        }
      }

      const reminder = get(octokit, issue);
      console.log("issue body", issue.body);
      console.log("reminder", reminder.toString());

      if (!reminder) {
        // Malformed metadata, not much we can do
        await octokit.issues.removeLabel({
          owner,
          repo,
          'issue_number': issueNumber,
          name: LABEL
        })
      } else if (moment(reminder.when) < moment()) {
        const labels = issue.labels
        const frozenLabel = labels.find(({ name }) => name === LABEL)
        const pos = labels.indexOf(frozenLabel)
        labels.splice(pos, 1)

        await octokit.issues.update({ owner, repo, 'issue_number': issueNumber, labels, state: 'open' })

        console.log('trying to respond....');
        await octokit.issues.createComment({
          owner,
          repo,
          'issue_number': issueNumber,
          body: `:wave: @${reminder.who}, ${reminder.what}`
        })
      }
    }))
  }
}
