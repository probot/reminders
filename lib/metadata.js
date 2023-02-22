module.exports = {
  async set (octokit, issue, key, value) {
    const regex = /\n\n<!-- probot = (.*) -->/

    let body = issue.body
    let data = {}

    if (!body) body = (await octokit.issues.get(issue)).data.body || ''

    body = body.replace(regex, (_, json) => {
      data = JSON.parse(json)
      return ''
    })

    let uniqid
    if (process.env.GITHUB_ACTIONS) {
      uniqid = process.env.GITHUB_ACTION
    } else {
      uniqid = 13055
    }
    data[uniqid] = {}

    if (typeof key === 'object') {
      Object.assign(data[uniqid], key)
    } else {
      data[uniqid][key] = value
    }

    body = `${body}\n\n<!-- probot = ${JSON.stringify(data)} -->`

    /* eslint-disable camelcase */
    const { owner, repo, issue_number } = issue
    console.log('attempting to set metadata in the op...', { owner, repo, issue_number })
    return octokit.issues.update({ owner, repo, issue_number, body })
    /* eslint-enable camelcase */
  },
  async get (octokit, issue, key) {
    var regex = new RegExp('<!-- probot = (.*) -->', 'g')

    let body = issue.body

    if (!body) {
      body = (await octokit.issues.get(issue)).data.body || ''
    }

    regex.lastIndex = 0
    let match = regex.exec(body)

    if (match) {
      let obj = JSON.parse(match[1])
      let data = obj[process.env.GITHUB_ACTION]
      if (!data) {
        // attempt to rescue orphaned data
        for (const [appid] of Object.entries(obj)) {
          data = (obj[appid].hasOwnProperty('class') && obj[appid].class === 'reminders2.0') || (obj[appid].hasOwnProperty('who') && obj[appid].hasOwnProperty('when') && obj[appid].hasOwnProperty('what')) ? obj[appid] : null
        }
      }
      return key ? data && data[key] : data
    } else {
      console.error(`metadata.get error: match failed. issue #${issue.numberTemp}, issue body:---${body}---, match = ${match}`)
    }
  }
}
