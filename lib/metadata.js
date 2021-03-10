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
    const regex = /\n\n<!-- probot = (.*) -->/

    let body = issue.body

    if (!body) {
      body = (await octokit.issues.get(issue)).data.body || ''
    }

    const match = body.match(regex)

    if (match) {
      const data = JSON.parse(match[1])[process.env.GITHUB_ACTION]
      if(!data){
        let obj = JSON.parse(match[1]);
        console.log('json-parse', obj);
        for (const [appid, value] of Object.entries(obj)) {
          console.log(`${appid}: ${value}`);
          console.log(obj[appid].who)
          console.log(obj[appid].what)
          console.log(obj[appid].when)
          console.log(obj[appid].hasOwnProperty('who') && obj[appid].hasOwnProperty('when') && obj[appid].hasOwnProperty('what'))
          data = (obj[appid].hasOwnProperty('who') && obj[appid].hasOwnProperty('when') && obj[appid].hasOwnProperty('what')) ? obj[appid] : null;
        }

      }
      return key ? data && data[key] : data
    }
  }
}
