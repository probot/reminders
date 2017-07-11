const expect = require('expect');
const {createRobot} = require('probot');
const plugin = require('..');
const event = require('./fixtures/issues.opened');

describe('snooze', () => {
  let robot;
  let github;

  beforeEach(() => {
    robot = createRobot();

    // Load the plugin
    plugin(robot);

    // Mock out the GitHub API
    github = {     
      repos: {
        // Response for getting content from '.github/ISSUE_REPLY_TEMPLATE.md'
        getContent: expect.createSpy().andReturn(Promise.resolve({
          data: {
            content: Buffer.from(`Hello World!`).toString('base64')
          }
        }))
      },
      issues: {
        getComments: null, // githubHelper.commentUrlToIssueRequest(issue.comments_url)
        createComment: expect.createSpy(),
        getLabel: null, //  name: freeze.labelName
        createLabel: expect.createSpy() //name: freeze.config.labelName,          color: freeze.config.labelColor
      },
      search: {
        issues: null // q:'label:' + this.labelName
      }
    };        
        
    // Mock out GitHub client
    robot.auth = () => Promise.resolve(github);
  });

  it('posts a comment', async () => {
    await robot.receive(event);

    expect(github.issues.createComment).toHaveBeenCalledWith({
      owner: 'robotland',
      repo: 'test',
      number: 97,
      body: 'Testing out the testing framework.'
    });
  });
});
