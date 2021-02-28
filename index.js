const { run } = require('@probot/adapter-github-actions')
const actionApp = require('./app-action')
const probotApp = require('./app')

if (provess.env.GITHUB_ACTIONS) {
    run(actionApp).catch((error) => {
        console.error(error);
        process.exit(1);
    });
} else {
    run(probotApp).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
