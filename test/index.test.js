process.env.IGNORED_ACCOUNTS = ['jest']
process.env.TZ = 'UTC'
process.env.GITHUB_ACTION = 13055
process.env.APP_ID = 13055


const { Application, ProbotOctokit } = require('probot')

const plugin = require('../app')
const chrono = require('chrono-node')
const nock = require('nock')

nock.disableNetConnect()

// TODO: Dispatch event
// TODO: Actions testing
describe('reminders', () => {
  let robot
  let commentEvent
  let issuesEvent
  let scheduleEvent
  let issue
  let mock

  beforeEach(() => {
    // Deep clone so later modifications don't mutate this.
    commentEvent = JSON.parse(JSON.stringify(require('./fixtures/issue_comment.created')))
    issuesEvent = JSON.parse(JSON.stringify(require('./fixtures/issues.opened')))
    issue = {
      body: 'hello world\n\n<!-- probot = {"13055":{"who":"baxterthehacker","when":"2017-07-01T17:30:00.000Z","what":"Hey, we\'re back awake!"}} -->',
      number: 2,
      labels: [{
        url: 'https://api.github.com/repos/baxterthehacker/public-repo/labels/reminder',
        name: 'reminder',
        color: 'fc2929'
      }]
    }
    scheduleEvent = {
      name: 'schedule',
      payload: {
        action: 'repository',
        repository: {
          owner: { login: 'baxterthehacker' },
          name: 'public-repo'
        },
        installation: { id: 13055 }
      }
    }

    robot = new Application({
      'secret': 'foo',
      githubToken: 'test',
      // Disable throttling & retrying requests for easier testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false }
      }),
      installation: { id: 13055 }
    })

    /* scheduleContext = new Context(
      scheduleEvent,
      new ProbotOctokit({
        throttle: { enabled: false },
        retry: { enabled: false }
      })
    ) */

    // This mock is required because the scheduler plugin uses this method
    mock = nock('https://api.github.com')
      .get('/app/installations?per_page=100')
      .reply(200, [])

    plugin(robot)

    //   commentEvent.payload.installation.id = 1
  })

  describe('setting a reminder', () => {
    test('with slash commands', async () => {
      commentEvent.payload.comment.body = 'I am busy now, but will com back to this next quarter\n\n/remind me to check the spinaker on July 1, 2017'
      mock.patch('/repos/baxterthehacker/public-repo/issues/97', (requestBody) => {
        expect(requestBody.labels).toEqual(
          [
            {
              url: 'https://api.github.com/repos/baxterthehacker/public-repo/labels/bug',
              name: 'bug',
              color: 'fc2929'
            },
            'reminder'
          ])
        return true
      })
        .reply(200)
        .get('/repos/baxterthehacker/public-repo/issues/97')
        .reply(200, {
          body: "It looks like you accidently spelled 'commit' with two 't's."
        })
        .patch('/repos/baxterthehacker/public-repo/issues/97', (requestBody) => {
          const params = {
            who: '@baxterthehacker',
            what: 'check the spinaker',
            when_raw:"July 1, 2017",
            when: chrono.parseDate('July 1, 2017 9:00am')
          }
          expect(requestBody.body).toEqual(`It looks like you accidently spelled 'commit' with two 't's.\n\n<!-- probot = {"13055":${JSON.stringify(params)}} -->`)
          return true
        })
        .reply(204)
        .post('/repos/baxterthehacker/public-repo/issues/97/comments', (requestBody) => {
          expect(requestBody.body).toEqual(`@baxterthehacker set a reminder for **Jul 1st 2017**`)
          return true
        })
        .reply(200)

      await robot.receive(commentEvent)

      expect(mock.activeMocks()).toStrictEqual([])
    })
    test('when issue is opened', async () => {
      issuesEvent.payload.issue.body = '/remind me to check the spinaker on July 1, 2017'

      mock.patch('/repos/baxterthehacker/public-repo/issues/97', (requestBody) => {
        expect(requestBody.labels).toEqual(
          [
            'reminder'
          ])
        return true
      })
        .reply(200)
        .get('/repos/baxterthehacker/public-repo/issues/97')
        .reply(200, {
          body: '/remind me to check the spinaker on July 1, 2017'
        })
        .patch('/repos/baxterthehacker/public-repo/issues/97', (requestBody) => {
          const params = {
            who: '@jbjonesjr',
            what: 'check the spinaker',
            when_raw:"July 1, 2017",
            when: chrono.parseDate('July 1, 2017 9:00am')
          }
          expect(requestBody.body).toEqual(`/remind me to check the spinaker on July 1, 2017\n\n<!-- probot = {"13055":${JSON.stringify(params)}} -->`)
          return true
        })
        .reply(204)
        .post('/repos/baxterthehacker/public-repo/issues/97/comments', (requestBody) => {
          expect(requestBody.body).toEqual('@jbjonesjr set a reminder for **Jul 1st 2017**')
          return true
        })
        .reply(200)

      await robot.receive(issuesEvent)
      expect(mock.activeMocks()).toStrictEqual([])
    })
  })

  describe('dealing with bad data', () => {
    test('shows an error when reminder parsing fails', async () => {
      commentEvent.payload.comment.body = '/remind nope'

      mock.patch('/repos/baxterthehacker/public-repo/issues/97', (requestBody) => {
        expect(requestBody.labels).toEqual(
          [
            'reminder'
          ])
        return true
      })
        .reply(200)
        .get('/repos/baxterthehacker/public-repo/issues/97')
        .reply(200, {
          body: '/remind me to check the spinaker on July 1, 2017'
        })
        .patch('/repos/baxterthehacker/public-repo/issues/97', (requestBody) => {
          const params = {
            who: 'jbjonesjr',
            what: 'check the spinaker',
            when: chrono.parseDate('July 1, 2017 9:00am')
          }
          expect(requestBody.body).toEqual(`/remind me to check the spinaker on July 1, 2017\n\n<!-- probot = {"13055":${JSON.stringify(params)}} -->`)
          return true
        })
        .reply(204)
        .post('/repos/baxterthehacker/public-repo/issues/97/comments', (requestBody) => {
          expect(requestBody.body).toEqual('@baxterthehacker we had trouble parsing your reminder. Try:\n\n`/remind me [what] [when]`')
          return true
        })
        .reply(200)

      try {
        await robot.receive(commentEvent)
      } catch (err) {
        expect(err.message.trim()).toContain('Error: Unable to parse reminder: remind nope')
      }
    })
  })
  describe('mocking scheduler trigger', () => {
    test('malformed metadata', async () => {
      issue.body = 'hello world'

      mock.get('/search/issues?q=label%3A%22reminder%22%20repo%3Abaxterthehacker%2Fpublic-repo')
        .reply(200, { items: [issue] })
        .delete('/repos/baxterthehacker/public-repo/issues/2/labels/reminder')
        .reply(200)
        .post('/repos/baxterthehacker/public-repo/issues/2/comments', (requestBody) => {
          expect(requestBody.body).toEqual("couldn't parse the reminders metadata. If you think this is in error, open an issue in github.com/probot/reminders")
          return true
        })
        .reply(200)

      await robot.receive(scheduleEvent)
      expect(mock.activeMocks()).toStrictEqual([])
    })

    test('test visitor activation', async () => {
      issue.body = 'hello world\n\n<!-- probot = {"13055":{"who":"@baxterthehacker","when":"2017-07-01T17:30:00.000Z","what":"Hey, we\'re back awake!"}} -->'

      mock.get('/search/issues?q=label%3A%22reminder%22%20repo%3Abaxterthehacker%2Fpublic-repo')
        .reply(200, { items: [issue] })
        .patch('/repos/baxterthehacker/public-repo/issues/2', (requestBody) => {
          expect(requestBody.labels).toEqual(
            [])
          return true
        })
        .reply(200)
        .post('/repos/baxterthehacker/public-repo/issues/2/comments', (requestBody) => {
          expect(requestBody.body).toEqual(':wave: @baxterthehacker, Hey, we\'re back awake!')
          return true
        })
        .reply(200)

      await robot.receive(scheduleEvent)
      expect(mock.activeMocks()).toStrictEqual([])
    })
  })
})
