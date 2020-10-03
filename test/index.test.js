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
      installation: { /*id: 1*/ }
    }
  }

  beforeEach(() => {

    // Deep clone so later modifications don't mutate this.
    commentEvent = JSON.parse(JSON.stringify(require('./fixtures/issue_comment.created')))
    issuesEvent = JSON.parse(JSON.stringify(require('./fixtures/issues.opened')))
    issue = {
      body: 'hello world\n\n<!-- probot = {"undefined":{"who":"baxterthehacker","when":"2017-07-01T17:30:00.000Z","what":"Hey, we\'re back awake!"}} -->',
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
            body: 'I am busy now, but will com back to this next quarter\n\n/remind me to check the spinaker on July 1, 2017'
          }
        })),
        removeLabel: jest.fn()
      },
      search: {
        issuesAndPullRequests: jest.fn().mockImplementation(() => Promise.resolve({
          data: { items: [issue] }
        })) // Q:'label:' + this.labelName
      },
      defaults: jest.fn(),
      Octokit: jest.fn()
    }

    robot = new Application({ 'secret': 'foo', 'Octokit':github, 'octokit':github })
    // Mock out GitHub client
    robot.auth = (() => Promise.resolve(github))

    plugin(robot)

 //   commentEvent.payload.installation.id = 1
  })

  test('sets a reminder with slash commands', async () => {
    commentEvent.payload.comment.body = 'I am busy now, but will com back to this next quarter\n\n/remind me to check the spinaker on July 1, 2017'

    await robot.receive(commentEvent)

    expect(github.issues.update).toHaveBeenCalledWith({
      issue_number: 2,
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

    //TODO: This uses a local hacked version of probot-metadata
    expect(github.issues.update).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      issue_number: 2,
      body: `I am busy now, but will com back to this next quarter\n\n/remind me to check the spinaker on July 1, 2017\n\n<!-- probot = {"undefined":${JSON.stringify(params)}} -->`
    })

    expect(github.issues.createComment).toHaveBeenCalledWith({
      issue_number: 2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      body: '@baxterthehacker set a reminder for **Jul 1st 2017**'
    })
  })

  test('sets a reminder when issue is opened', async () => {
    issuesEvent.payload.issue.body = '/remind me to check the spinaker on July 1, 2017'

    await robot.receive(issuesEvent)

    expect(github.issues.createComment).toHaveBeenCalledWith({
      issue_number: 97,
      owner: 'robotland',
      repo: 'test',
      body: '@jbjonesjr set a reminder for **Jul 1st 2017**'
    })
  })

  test('shows an error when reminder parsing fails', async () => {
    commentEvent.payload.comment.body = '/remind nope'

    try {
      await robot.receive(commentEvent)
    } catch (err) {
      expect(err.message.trim()).toContain('Error: Unable to parse reminder: remind nope')
    }

    expect(github.issues.createComment).toHaveBeenCalledWith({
      issue_number: 2,
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
