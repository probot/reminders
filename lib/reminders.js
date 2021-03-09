const moment = require('moment')
const metadata = require('./metadata')
const parseReminder = require('parse-reminder')
const { Octokit } = require('@octokit/action')

const LABEL = 'reminder'

module.exports = {
  async dispatch (context) {
    const octokit = new Octokit()

    let reminder = {}
    let data = context.payload.client_payload.data
    reminder = {
      what: data['Reminder Message'],
      who: data['Who to notify'],
      when_raw: data['When to notify']
    }
    // TODO: add a better function into reminder-parse to get around the required regex matching
    let text = 'remind @me on ' + reminder.when_raw + ' foo me then'
    let parseResult = parseReminder(text)
    if (parseResult) {
      reminder.when = parseResult.when
      console.log('reminder', reminder)
      // Could do graphql get issue node by id

      const issueQuery = `query MyQuery($issueId: ID!) {
        node(id: $issueId) {
          id
          ... on Issue {
            id
            number
            title
            author {
              login
            }
            closed
            createdAt
            repository {
              name
              nameWithOwner
              owner {
                id
                login
              }
            }
            labels(first: 20) {
              nodes {
                name
              }
            }
          }
        }
      }`
      let resp = await octokit.graphql(issueQuery, { 'issueId': context.payload.client_payload.command.resource.id })
      let issue = {
        owner: resp.node.repository.owner.login,
        repo: resp.node.repository.name,
        issue_number: resp.node.number
      }
      console.log('issue', issue)
      // context.payload.client_payload.command.resource
      await processObject(reminder, context, issue, resp.node.labels.nodes, octokit)
    } else {
      await octokit.issues.createComment(context.issue({
        body: `@${context.payload.sender.login} we had trouble parsing your reminder. Try:\n\n\`/remind me [what] [when]\``
      }))
      throw new Error(`Unable to parse reminder: remind ${context.payload.client_payload.data}`)
    }
  },

  async set (context, command) {
    let octokit
    if (!context.octokit) { octokit = new Octokit() } else { octokit = context.octokit }

    const reminder = parseReminder(command.name + ' ' + command.arguments)

    if (reminder) {
      if (reminder.who === 'me') {
        reminder.who = '@' + context.payload.sender.login
      }

      await processObject(reminder, context, context.issue(), context.payload.issue.labels , octokit)
    } else {
      await octokit.issues.createComment(context.issue({
        body: `@${context.payload.sender.login} we had trouble parsing your reminder. Try:\n\n\`/remind me [what] [when]\``
      }))
      throw new Error(`Unable to parse reminder: remind ${command.arguments}`)
    }
  },
  async check (context) {
    let octokit
    if (!context.octokit) { octokit = new Octokit() } else { octokit = context.octokit }

    let owner, repo
    if (process.env.GITHUB_ACTIONS) {
      owner = process.env.GITHUB_REPOSITORY.split('/')[0]
      repo = process.env.GITHUB_REPOSITORY.split('/')[1]
    } else {
      owner = context.repo().owner
      repo = context.repo().repo
    }

    const q = `label:"${LABEL}" repo:${owner}/${repo}`

    const resp = await octokit.search.issuesAndPullRequests({ q })

    await Promise.all(resp.data.items.map(async issue => {
      // Issue objects from the API don't include owner/repo params, so
      // setting them here with `context.repo` so we don't have to worry
      // about it later. :/
      if (process.env.GITHUB_ACTIONS) {
        issue = Object.assign(
          {
            owner: process.env.GITHUB_REPOSITORY.split('/')[0],
            repo: process.env.GITHUB_REPOSITORY.split('/')[1]
          }, issue)
      } else {
        issue = Object.assign(
          context.repo(), issue)
      }

      const { owner, repo, number } = issue

      const issueNumber = number

      const reminder = await metadata.get(octokit, issue)

      if (!reminder) {
        // Malformed metadata, not much we can do
        await octokit.issues.removeLabel({
          owner,
          repo,
          'issue_number': issueNumber,
          name: LABEL
        })
        // TODO: Probably could be some sort of try/catch
        await octokit.issues.createComment({
          owner,
          repo,
          'issue_number': issueNumber,
          body: `couldn't parse the reminders metadata. If you think this is in error, open an issue in github.com/probot/reminders`
        })
      } else if (moment(reminder.when) < moment()) {
        console.log('attempting to respond....')
        await octokit.issues.createComment({
          owner,
          repo,
          'issue_number': issueNumber,
          body: `:wave: ${reminder.who}, ${reminder.what}`
        })

        const labels = issue.labels
        const frozenLabel = labels.find(({ name }) => name === LABEL)
        const pos = labels.indexOf(frozenLabel)
        labels.splice(pos, 1)

        // TODO: Should absract all of this into a remove label helper
        await octokit.issues.update({ owner, repo, 'issue_number': issueNumber, labels, state: 'open' })
      }
    }))
  }
}

let processObject = async function (reminder, context, issue, labels, octokit) {
  // Add reminder label if it doesn't already exist.
  if (!labels.find(({ name }) => name === LABEL)) {
    labels.push(LABEL)
  }

  // ACTION CODE!
  // const repo = Object.assign({
  //   owner: process.env.GITHUB_REPOSITORY.split('/')[0],
  //   repo: process.env.GITHUB_REPOSITORY.split('/')[1]
  // }, {})

  await octokit.issues.update(Object.assign({"labels":labels}, issue))

  await metadata.set(octokit, issue, reminder)

  await octokit.issues.createComment(Object.assign({
    body: `@${context.payload.sender.login} set a reminder for **${moment(reminder.when).format('MMM Do YYYY')}**`
  }, issue))
}
