process.env.TZ = 'UTC'

const {createRobot} = require('probot')
const plugin = require('..')
const chrono = require('chrono-node')

describe('reminders', () => {
  let robot
  let github
  let commentEvent
  let issuesEvent
  let issue

  const scheduleEvent = {
    event: 'schedule',
    payload: {
      action: 'repository',
      repository: {
        owner: {login: 'baxterthehacker'},
        name: 'public-repo'
      },
      installation: {id: 1}
    }
  }

  beforeEach(() => {
    robot = createRobot()

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
        getInstallations: jest.fn()
      },
      paginate: jest.fn(),
      issues: {
        createComment: jest.fn(),
        edit: jest.fn(),
        get: jest.fn().mockImplementation(() => Promise.resolve({data: {
          body: 'hello world'
        }})),
        removeLabel: jest.fn()
      },
      search: {
        issues: jest.fn().mockImplementation(() => Promise.resolve({
          data: {items: [issue]}
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

    expect(github.issues.edit).toHaveBeenCalledWith({
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

    expect(github.issues.edit).toHaveBeenCalledWith({
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

    expect(github.issues.edit).toHaveBeenCalledWith({
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
