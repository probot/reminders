process.env.IGNORED_ACCOUNTS = ["jest"]
process.env.TZ = 'UTC'

const { Application } = require('probot')
const plugin = require('..')
const chrono = require('chrono-node')
describe('reminders', () => {
  let robot
  let github
  let commentEvent
  let issuesEvent
  let issue

  const scheduleEvent = {
    name: 'schedule',
    payload: {
      action: 'repository',
      repository: {
        owner: { login: 'baxterthehacker' },
        name: 'public-repo'
      },
      installation: { id: 1 }
    }
  }

  beforeEach(() => {
    // FYI, I had to generate a specific PCKS#1 RSA Private Key to make this work. This one is 4096, not sure if that matters.
    // See note here: https://docs.github.com/en/free-pro-team@latest/developers/apps/authenticating-with-github-apps#generating-a-private-key
    let fakepem = `-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----`;
    robot = new Application({ 'secret': 'foo', 'privateKey': fakepem })

    // Deep clone so later modifications don't mutate this.
    commentEvent = JSON.parse(JSON.stringify(require('./fixtures/issue_comment.created')))
    issuesEvent = JSON.parse(JSON.stringify(require('./fixtures/issues.opened')))
    issue = {
      body: 'hello world\n\n<!-- probot = {"1":{"who":"baxterthehacker","when":"2017-07-01T17:30:00.000Z","what":"Hey, we\'re back awake!"}} -->',
      number: 2,
      labels: [{
        url: 'https://api.github.com/repos/baxterthehacker/public-repo/labels/reminder',
        name: 'reminder',
        color: 'fc2929'
      }]
    }

    // Load the plugin
    // Mock out the GitHub API
    github = {
      apps: {
        getInstallations: jest.fn(),
        listInstallations: {
          endpoint: {
            merge: jest.fn(() => [{
              "id": 55,
              "desc": "installation from listinstallsendpoing",
              "account": {
                "login": "jest"
              }
            }])
          }
        }
      },
      paginate: jest.fn((x) => x),
      issues: {
        createComment: jest.fn(),
        update: jest.fn(),
        get: jest.fn().mockImplementation(() => Promise.resolve({
          data: {
            body: 'hello world'
          }
        })),
        removeLabel: jest.fn()
      },
      search: {
        issuesAndPullRequests: jest.fn().mockImplementation(() => Promise.resolve({
          data: { items: [issue] }
        })) // Q:'label:' + this.labelName
      }
    }

    // Mock out GitHub client
    robot.auth = () => Promise.resolve(github)

    plugin(robot)

    commentEvent.payload.installation.id = 1
  })

  test('sets a reminder with slash commands', async () => {
    commentEvent.payload.comment.body = 'I am busy now, but will com back to this next quarter\n\n/remind me to check the spinaker on July 1, 2017'

    await robot.receive(commentEvent)

    expect(github.issues.update).toHaveBeenCalledWith({
      number: 2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      labels: [
        {
          url: 'https://api.github.com/repos/baxterthehacker/public-repo/labels/bug',
          name: 'bug',
          color: 'fc2929'
        },
        'reminder'
      ]
    })

    const params = {
      who: 'baxterthehacker',
      what: 'check the spinaker',
      when: chrono.parseDate('July 1, 2017 9:00am')
    }

    expect(github.issues.update).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      number: 2,
      body: `hello world\n\n<!-- probot = {"1":${JSON.stringify(params)}} -->`
    })

    expect(github.issues.createComment).toHaveBeenCalledWith({
      number: 2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      body: '@baxterthehacker set a reminder for **Jul 1st 2017**'
    })
  })

  test('sets a reminder when issue is opened', async () => {
    issuesEvent.payload.issue.body = '/remind me to check the spinaker on July 1, 2017'

    await robot.receive(issuesEvent)

    expect(github.issues.createComment).toHaveBeenCalledWith({
      number: 97,
      owner: 'robotland',
      repo: 'test',
      body: '@jbjonesjr set a reminder for **Jul 1st 2017**'
    })
  })

  test('shows an error when reminder parsing fails', async () => {
    commentEvent.payload.comment.body = '/remind nope'

    try {
      await robot.receive(commentEvent)
      throw new Error('Expected error but none was raised')
    } catch (err) {
      expect(err.message).toEqual('Unable to parse reminder: remind nope')
    }

    expect(github.issues.createComment).toHaveBeenCalledWith({
      number: 2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      body: '@baxterthehacker we had trouble parsing your reminder. Try:\n\n`/remind me [what] [when]`'
    })
  })

  test('test visitor activation', async () => {
    await robot.receive(scheduleEvent)

    expect(github.issues.update).toHaveBeenCalledWith({
      labels: [],
      owner: 'baxterthehacker',
      repo: 'public-repo',
      number: 2,
      state: 'open'
    })
    expect(github.issues.createComment).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      number: 2,
      body: ':wave: @baxterthehacker, Hey, we\'re back awake!'
    })
  })

  test('works with malformed metadata', async () => {
    issue.body = 'hello world'

    await robot.receive(scheduleEvent)

    expect(github.issues.removeLabel).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      number: 2,
      name: 'reminder'
    })
  })
})
