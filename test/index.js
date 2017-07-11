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
      issues: {
        createComment: expect.createSpy()
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
