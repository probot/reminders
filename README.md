# Probot: Reminders

> a GitHub App built with [Probot](https://github.com/probot/probot) that adds reminders to Issues and Pull Requests.

Use the `/remind` slash command to set a reminder on any comment box on GitHub and you'll get a ping about it again when the reminder is due.

<img width="797" alt="screen shot 2017-09-15 at 6 48 56 pm" src="https://user-images.githubusercontent.com/13410355/30493981-99505cfe-9a46-11e7-8738-3652da872141.png">

## Usage
1. **[Configure the GitHub App](https://github.com/apps/reminders)**
2. Start using the `/reminders` command on the repository.
3. Optionally, add a `.github/config.yml` to customize the app:

```yml
reminders:  
  # Label applied to issues with pending reminders
  label: reminder
```

## Setup

```
# Install dependencies
npm install

# Run the bot
npm start
```

For more information, see the [documentation for probot](https://github.com/probot/probot).
