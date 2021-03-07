const moment = require('moment')
const metadata = require('probot-metadata')
const parseReminder = require('parse-reminder')
const { Octokit } = require('@octokit/action')

const LABEL = 'reminder'

module.exports = {
  async dispatch(context) {
    let reminder = {};
    let data = context.payload.client_payload.data;
    reminder.what = data['Reminder Message'];
    reminder.who = data['Who to notify']
    reminder.when_raw = data['When to notify']
    let text = "remind @me on "+reminder.when_raw+ ' foo me then'
    let parse_result = parseReminder(text);
    reminder.when = parse_result.when;
    console.log('reminder',reminder);
    await processObject(reminder, new Octokit())
  },

  async set(context, command) {

    const octokit = new Octokit();

    const reminder = parseReminder(command.name + ' ' + command.arguments)

    if (reminder) {
      if (reminder.who === 'me') {
        reminder.who = context.payload.sender.login
      }
      await processObject(reminder, octokit);
    } else {
      await octokit.issues.createComment(context.issue({
        body: `@${context.payload.sender.login} we had trouble parsing your reminder. Try:\n\n\`/remind me [what] [when]\``
      }))
      throw new Error(`Unable to parse reminder: remind ${command.arguments}`)
    }
  },

  async processObject(reminder, octokit) {
    let { labels } = context.payload.issue
    // Add reminder label if it doesn't already exist.
    if (!labels.find(({ name }) => name === LABEL)) {
      labels.push(LABEL)
    }

    const repo = Object.assign({
      owner: process.env.GITHUB_REPOSITORY.split("/")[0],
      repo: process.env.GITHUB_REPOSITORY.split("/")[1]
    }, {});

    issue = Object.assign(
      { labels }, context.issue(repo));

    console.log('og issue', context.issue());
    console.log('assigned issue', issue);
    await octokit.issues.update(context.issue({ labels }))

    let metadataset = async function (octokit, issue, key) {

      const regex = /\n\n<!-- probot = (.*) -->/

      let body = issue.body
      let data = {}

      if (!body) body = (await octokit.issues.get(issue)).data.body || ''

      body = body.replace(regex, (_, json) => {
        data = JSON.parse(json)
        return ''
      })

      if (!data[process.env.GITHUB_ACTION]) data[process.env.GITHUB_ACTION] = {}

      if (typeof key === 'object') {
        Object.assign(data[process.env.GITHUB_ACTION], key)
      } else {
        data[process.env.GITHUB_ACTION][key] = value
      }

      body = `${body}\n\n<!-- probot = ${JSON.stringify(data)} -->`

      const { owner, repo, issue_number } = issue
      console.log('attempting to set metadata in the op...', { owner, repo, issue_number })
      return octokit.issues.update({ owner, repo, issue_number, body })

    }
    await metadataset(octokit, context.issue(), reminder)

    await octokit.issues.createComment(context.issue({
      body: `@${context.payload.sender.login} set a reminder for **${moment(reminder.when).format('MMM Do YYYY')}**`
    }))
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

      get = async function (octokit, issue, key) {
        const regex = /\n\n<!-- probot = (.*) -->/

        let body = issue.body

        if (!body) {
          body = (await octokit.issues.get(issue)).data.body || ''
        }

        const match = body.match(regex)

        if (match) {
          const data = JSON.parse(match[1])[process.env.GITHUB_ACTION]
          return key ? data && data[key] : data
        }
      }

      const reminder = await get(octokit, issue);
      console.log("reminder", reminder.toString());

      if (!reminder) {
        // Malformed metadata, not much we can do
        await octokit.issues.removeLabel({
          owner,
          repo,
          'issue_number': issueNumber,
          name: LABEL
        })
        //TODO: Probably could be some sort of try/catch
        await octokit.issues.createComment({
          owner,
          repo,
          'issue_number': issueNumber,
          body: `couldn't parse the reminders metadata. If you think this is in error, open an issue in github.com/probot/reminders`
        })
      } else if (moment(reminder.when) < moment()) {
        console.log('attempting to respond....');
        await octokit.issues.createComment({
          owner,
          repo,
          'issue_number': issueNumber,
          body: `:wave: @${reminder.who}, ${reminder.what}`
        })

        const labels = issue.labels
        const frozenLabel = labels.find(({ name }) => name === LABEL)
        const pos = labels.indexOf(frozenLabel)
        labels.splice(pos, 1)

        //TODO: Should absract all of this into a remove label helper
        await octokit.issues.update({ owner, repo, 'issue_number': issueNumber, labels, state: 'open' })
      }
    }))
  }
}
