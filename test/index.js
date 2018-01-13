process.env.TZ = 'UTC'

const expect = require('expect')
const {createRobot} = require('probot')
const plugin = require('..')
const chrono = require('chrono-node')

describe('reminders', () => {
  let robot
  let github
  let commentEvent
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
      integrations: {
        getInstallations: expect.createSpy()
      },
      paginate: expect.createSpy(),
      repos: {
        // Response for getting content from '.github/config.yml'
        getContent: expect.createSpy().andReturn(Promise.resolve({
          data: {content: Buffer.from(`reminders:\n  label: reminder`).toString('base64')}
        }))
      },
      issues: {
        createComment: expect.createSpy(),
        edit: expect.createSpy(),
        get: expect.createSpy().andReturn(Promise.resolve({data: {
          body: 'hello world'
        }})),
        removeLabel: expect.createSpy()
      },
      search: {
        issues: expect.createSpy().andReturn(Promise.resolve({
          data: {items: [issue]}
        })) // Q:'label:' + this.labelName
      }
    }

    // Mock out GitHub client
    robot.auth = () => Promise.resolve(github)

    plugin(robot)

    commentEvent.payload.installation.id = 1
  })

  it('sets a reminder with slash commands', async () => {
    commentEvent.payload.comment.body = 'I am busy now, but will com back to this next quarter\n\n/remind me to check the spinaker on July 1, 2017'

    await robot.receive(commentEvent)

    expect(github.issues.edit).toHaveBeenCalledWith({
      number: 2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      labels: [{
        url: 'https://api.github.com/repos/baxterthehacker/public-repo/labels/bug',
        name: 'bug',
        color: 'fc2929'
      },
        'reminder']
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
      body: '@baxterthehacker set a reminder for **07/01/2017**'
    })
  })

  it('sets a reminder with slash commands', async () => {
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

  it('test visitor activation', async () => {
    await robot.receive(scheduleEvent)

    expect(github.repos.getContent).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      path: '.github/config.yml'
    })
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

  it('works with malformed metadata', async () => {
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
