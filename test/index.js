const expect = require('expect');
const {createRobot} = require('probot');
const plugin = require('..');
const commentEvent = require('./fixtures/issue_comment.created');

describe('PRobot-Snooze ', () => {
  let robot;
  let github;

  beforeEach(() => {
    robot = createRobot();

    // Load the plugin
    // Mock out the GitHub API
    github = {
      repos: {
        // Response for getting content from '.github/probot-freeze.yml'
        getContent: expect.createSpy().andReturn(Promise.resolve({
          data:{content: Buffer.from(`# Default length (in days) to freeze an item if no date is specified
defaultFreezeDuration: 7
#label applied to frozen issues. This is what the bot uses for its source of truth
labelName: 'probot:freeze'
# label color
labelColor: 'gray'
perform: true
`).toString('base64')
          }}))
      },
      issues: {
        getComments: expect.createSpy().andReturn(Promise.resolve(
          {data: [{
            body:'comment 1',
            user: {
              login:'baxterthehacker'
            },
            name:'public-repo'
          }, {
            body:'@probot, we should snooze this for a while, until July 1, 2018 13:30 <!-- {"assignee":"baxterthehacker","unfreezeMoment":"2016-06-01T17:30:00.000Z","message":"Hey, we\'re back awake!"}-->',
            user: {
              login:'probot-snooze[bot]'
            },
            name:'public-repo'}]
          }
        )), // GithubHelper.commentUrlToIssueRequest(issue.comments_url)
        createComment: expect.createSpy(),
        getLabel: null, //  Name: freeze.labelName
        createLabel: expect.createSpy(), // Name: freeze.config.labelName,          color: freeze.config.labelColor
        edit: expect.createSpy()
      },
      search: {
        issues: expect.createSpy().andReturn(Promise.resolve({
          data:{items: [{comments_url:'https://api.github.com/repos/baxterthehacker/public-repo/issues/2/comments',
            labels:[{
              url: 'https://api.github.com/repos/baxterthehacker/public-repo/labels/probot:freeze',
              name: 'probot:freeze',
              color: 'fc2929'
            }]}]
          }})) // Q:'label:' + this.labelName
      }
    };

    // Mock out GitHub client
    robot.auth = () => Promise.resolve(github);

    plugin(robot);
  });

  it('posts a generic comment', async () => {
    commentEvent.payload.comment.body = 'no action needed';
    await robot.receive(commentEvent);
    expect(github.repos.getContent).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      path: '.github/probot-snooze.yml'
    });
    expect(github.issues.createComment).toNotHaveBeenCalled();
  });

  it('posts a snooze comment - no label', async () => {
    commentEvent.payload.comment.body = '@probot, we should snooze this for a while, until July 1, 2018 13:30';
    await robot.receive(commentEvent);
    expect(github.repos.getContent).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      path: '.github/probot-snooze.yml'
    });
    expect(github.issues.edit({
      number:2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      state: 'closed',
      labels:[{
        url: 'https://api.github.com/repos/baxterthehacker/public-repo/labels/bug',
        name: 'bug',
        color: 'fc2929'
      },
        'probot:freeze']
    }));
    expect(github.issues.createComment).toHaveBeenCalledWith({
      number:2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around 07/01/2018 :clock1: ' +
        '<!-- {"assignee":"baxterthehacker","unfreezeMoment":"2018-07-01T17:30:00.000Z","message":"Hey, we\'re back awake!"}-->'
    });
  });

  it('posts a snooze comment - with label', async () => {
    commentEvent.payload.comment.body = '@probot, we should snooze this for a while, until July 1, 2018 13:30';
    commentEvent.payload.issue.labels.push({
      url: 'https://api.github.com/repos/baxterthehacker/public-repo/labels/probot:freeze',
      name: 'probot:freeze',
      color: 'cccccc'
    });
    await robot.receive(commentEvent);
    expect(github.repos.getContent).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      path: '.github/probot-snooze.yml'
    });
    expect(github.issues.edit({
      number:2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      state: 'closed',
      labels:[{
        url: 'https://api.github.com/repos/baxterthehacker/public-repo/labels/bug',
        name: 'bug',
        color: 'fc2929'
      },
        'probot:freeze']
    }));
    expect(github.issues.createComment).toHaveBeenCalledWith({
      number:2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around 07/01/2018 :clock1: ' +
        '<!-- {"assignee":"baxterthehacker","unfreezeMoment":"2018-07-01T17:30:00.000Z","message":"Hey, we\'re back awake!"}-->'
    });
  });

  it('test visitor activation', async () => {
    await robot.receive({
      event: 'test',
      payload: {
        action: 'visit',
        repository: {
          owner: {
            login:'baxterthehacker'
          },
          name:'public-repo'
        },
        installation: {
          id: 13055
        }}});
    expect(github.repos.getContent).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      path: '.github/probot-snooze.yml'
    });

    expect(github.issues.edit).toHaveBeenCalledWith({
      labels: [],
      owner: 'baxterthehacker',
      repo: 'public-repo',
      number: '2',
      state: 'open'
    });
    expect(github.issues.createComment).toHaveBeenCalledWith({
      owner: 'baxterthehacker',
      repo: 'public-repo',
      number: '2',
      body: ':wave: @baxterthehacker, Hey, we\'re back awake!'
    });
  });
});
