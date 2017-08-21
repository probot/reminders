const fs = require ('fs');
const expect = require('expect');
const {createRobot} = require('probot');
const plugin = require('..');
const moment = require('moment');
const chrono = require('chrono-node');
const Freeze = require('../lib/freeze.js');
const commentEvent = require('./fixtures/issue_comment.created');

describe('PRobot-Snooze ', () => {
  let robot;
  let github;

  beforeEach(() => {
    robot = createRobot();

    // Load the plugin
    // Mock out the GitHub API
    github = {
      integrations:{
        getInstallations: expect.createSpy()
      },
      paginate: expect.createSpy(),
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
            body:'@probot, we should snooze this for a while, until July 1, 2017 13:30 <!-- {"assignee":"baxterthehacker","unfreezeMoment":"2017-07-01T17:30:00.000Z","message":"Hey, we\'re back awake!"}-->',
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

  it('resolves timezone issues with chrono-node', async () => {
/*  Save this code unless we need to review later

    console.log('current time', new Date());
    console.log('timezon offset', new Date().getTimezoneOffset());
    // PD reads the date as local.
    const parseDate = chrono.parseDate('July 1, 2018 13:30');
    console.log('pd', util.inspect(parseDate, {depth:null}));
    const mom = moment(parseDate);
    // Moment returns the date in local
    console.log('mom', util.inspect(mom, {depth:null}));
    mom.add(new Date().getTimezoneOffset(), 'minutes');
    console.log('mom in UTC', util.inspect(mom, {depth:null}));
    */
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
    commentEvent.payload.comment.body = '@probot, we should snooze this for a while, until July 1, 2017 13:30';
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
      number: 2,
      owner: 'baxterthehacker',
      repo: 'public-repo',
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around 07/01/2017 :clock1: ' +
        '<!-- ' + JSON.stringify({assignee:'baxterthehacker', unfreezeMoment :chrono.parseDate('July 1, 2017 13:30'), message:'Hey, we\'re back awake!'}) + '-->'
    });
  });

  it('posts a snooze comment - with label', async () => {
    commentEvent.payload.comment.body = '@probot, we should snooze this for a while, until July 1, 2017 13:30';
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
      body: 'Sure thing. I\'ll close this issue for a bit. I\'ll ping you around 07/01/2017 :clock1: ' +
        '<!-- ' + JSON.stringify({assignee:'baxterthehacker', unfreezeMoment :chrono.parseDate('July 1, 2017 13:30'), message:'Hey, we\'re back awake!'}) + '-->'
    });
  });

  it('test visitor activation', async () => {
    await robot.receive({
      event: 'schedule',
      payload: {
        action: 'repository',
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

  it('test valid comments', async () => {
    const defaultFreezeDuration = 7;
    const validMessages = [
      {msg:'@probot, snooze this message until 08/01/2018. Then remind me about this test', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(new Date('08/01/2018 12:00'))}},
     {msg:'snooze this issue', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment().add(defaultFreezeDuration, 'days').format()}},
      {msg:'snooze this thread until next Tuesday', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('next Tuesday'))}},
      {msg:'snooze this thread til next Friday', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('next Friday'))}},
      {msg:'snooze this until tomorrow at noon', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('this until tomorrow at noon'))}},
      {msg:'snooze this until tomorrow at 2:00pm', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('tomorrow at 2:00pm'))}},
    /* Various date format parsing */
     {msg:'snooze until 07/11/17 at 12:00am', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('07/11/17 at 12:00am'))}},
      {msg:'snooze until 07/11/17 at 2pm', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('07/11/17 at 2pm'))}},
      {msg:'snooze until 07/11/17 at 2:00pm', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('07/11/17 at 2:00pm'))}},
      {msg:'snooze until 07/11/17 at 2:30pm', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('07/11/17 at 2:30pm'))}},
      {msg:'snooze until 07/11/17 at 14:00', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('07/11/17 at 14:00'))}},
      {msg:'snooze until 07/11/17 at 14:30', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('07/11/17 at 14:30'))}},
      {msg:'snooze until 07/11/17', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('07/11/17'))}},
      {msg:'freeze until 07/11/17 14:00', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('07/11/17 14:00'))}},
    /* Full text */
      {msg:'So i\'m out of office for the next three weeks. I\'m going to snooze this until I get back.', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('next three weeks'))}},
      {msg:'So i\'m out of office for the next three weeks. I\'m going to snooze this until I get back on 07/21/17.', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('next three weeks'))}},
      {msg:'Thanks for looking into this.\n\nSo i\'m out of office for the next three weeks. I\'m going to snooze this until I get back on 07/21/17.', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment(chrono.parseDate('next three weeks'))}}
    ];

    const freeze = new Freeze(github, JSON.parse(fs.readFileSync('./etc/defaults.js', 'utf8')));

    validMessages.forEach(obj => {
      const comment = {
        user: {
          login: 'baxterthehacker'
        },
        body:obj.msg
      };
      expect(freeze.freezable(comment)).toBe(true);
      expect(freeze.propsHelper(comment.user.login, comment.body)).toEqual(obj.props);
    });
  });

  /* With open comment */
  it('test valid comments with responses', async () => {
    const defaultFreezeDuration = 7;

    const msgs =
      [{msg:'snooze until 07/11/17 at 14:00, and remind me to bug Seth again', props:{assignee: 'baxterthehacker', message: 'bug Seth again', unfreezeMoment: moment(chrono.parseDate('07/11/17 at 14:00'))}},
    {msg:'snooze until 07/11/17 at 14:00 to bug Seth', props:{assignee: 'baxterthehacker', message: 'bug Seth', unfreezeMoment: moment(chrono.parseDate('07/11/17 at 14:00'))}},
    {msg:'snooze until 07/11/17 at 14:00, and "bug Seth"', props:{assignee: 'baxterthehacker', message: 'bug Seth', unfreezeMoment: moment(chrono.parseDate('07/11/17 at 14:00'))}},
    {msg:'hey @probot, snooze this issue', props:{assignee: 'baxterthehacker', message: 'Hey, we\'re back awake!', unfreezeMoment: moment().add(defaultFreezeDuration, 'days').format()}}
      ];
    const freeze = new Freeze(github, JSON.parse(fs.readFileSync('./etc/defaults.js', 'utf8')));

    msgs.forEach(obj => {
      const comment = {
        user: {
          login: 'baxterthehacker'
        },
        body:obj.msg
      };
      expect(freeze.freezable(comment)).toBe(true);
      expect(freeze.propsHelper(comment.user.login, comment.body)).toEqual(obj.props);
    });
  });
  it('test invalid comments', async () => {
    const invalidMessages = [
      {msg:'it\'s really cold out tonight, hope you don\'t freeze', props:{}}
    ];
    const freeze = new Freeze(github, {});

    invalidMessages.forEach(obj => {
      const comment = {
        user: {
          login: 'baxterthehacker'
        },
        body:obj.msg
      };
      expect(freeze.freezable(comment)).toBe(false);
    });
  });

  it('these tests are faulty edge cases, and here for reference', async () => {
    /*
    Chrono-node can't handle:
    * til the 25th
    * for a week
    */
    const badChrono = ['snooze this thread until July 25th',
      'snooze this thread a week'];
    expect(badChrono).toExist();
  });
});
