const {EventEmitter} = require('events');
const expect = require('expect');
const commands = require('../lib/commands');

describe('commands', () => {
  let callback;
  let robot;

  function payload(text) {
    return {payload: {comment: {body: text}}};
  }

  beforeEach(() => {
    callback = expect.createSpy();
    robot = new EventEmitter();
    commands(robot, 'foo', callback);
  });

  it('invokes callback and passes command logic', () => {
    robot.emit('issue_comment.created', payload('hello world\n\n/foo bar'));

    expect(callback).toHaveBeenCalled();
    expect(callback.calls[0].arguments[1]).toEqual({name: 'foo', arguments: 'bar'});
  });

  it('invokes the command without arguments', () => {
    robot.emit('issue_comment.created', payload('hello world\n\n/foo'));

    expect(callback).toHaveBeenCalled();
    expect(callback.calls[0].arguments[1]).toEqual({name: 'foo', arguments: undefined});
  });

  it('does not call callback for other commands', () => {
    robot.emit('issue_comment.created', payload('hello world\n\n/nope nothing to see'));
    expect(callback).toNotHaveBeenCalled();
  });

  it('invokes command on issue edit', () => {
    const event = payload('hello world\n\n/foo bar');
    robot.emit('issue_comment', event);
    robot.emit('issue_comment.updated', event);
    robot.emit('issue_comment.deleted', event);

    expect(callback).toNotHaveBeenCalled();
  });
});
