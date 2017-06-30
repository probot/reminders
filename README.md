# Probot: (Issue and Pull Request) Snooze

> a GitHub Integration built with [probot](https://github.com/probot/probot) that that temporarily closes Issues and Pull Requests on demand. It will reopen them in the future on the specified date, and provide an (optional) message at that time.

## Usage
1. **[Configure the GitHub Integration](https://github.com/integration/probot-freeze)**
2. Create `.github/probot-snooze.yml`

Configuration in `.github/probot-snooze.yml` can override these defaults:

```yml
# Default length (in days) to snooze an item if no date is specified
defaultSnoozeDuration: 7,

#label applied to frozen issues. This is what the bot uses for its source of truth
labelName : 'probot:snooze',

# label color
labelColor : 'gray'
```
## Setup

```
# Install dependencies
npm install

# Run the bot
npm start
```

For more information, see the [documentation for probot](https://github.com/probot/probot).

## Deploying to Heroku

0. [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy) - Click this button and pick an **App Name** that Heroku is happy with. Before you can complete this, you'll need config variables from the next step.

0. In another tab, [create an integration](https://github.com/settings/integrations/new) on GitHub, using `https://[yourappname].herokuapp.com/` (replacing `[yourappname]` with the name from step 1) as the **Homepage URL**, **Callback URL**, and **Webhook URL**. The permissions and events that your bot needs access to will depend on what you use it for. Read more about [creating an integration](https://developer.github.com/early-access/integrations/creating-an-integration/).

0. After creating your Github integrations, make sure that you click the green install button on the top left of the integration page.
This gives you an option of installing the integration on all or a subset of your repositories.

0. Go back to the Heroku tab and fill in the configuration variables with the values for the GitHub Integration. You will need to fill in these values as heroku config vars: **INTEGRATION_ID** (found on your integration page) , **PRIVATE_KEY** (copy paste the the downloaded `private-key.pem`, when you created a key for your integration), **WEBHOOK_SECRET** (as set on the integration page).
