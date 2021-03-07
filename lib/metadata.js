module.exports = {
    async set(octokit, issue, key) {

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
  
    },
    async get(octokit, issue, key) {
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
}