# lemmod

Moderation bot for Lemmy communities.

## How it works

1. You invite an instance of this bot to one or more communities as a moderator.
2. You use it's DMs as a command like interface to give it scripts to run.
3. It will chug along in the background doing it's thing.

## Scripts

lemmod uses YAML with templating for it's scripts, which exchanges flexibility
with security (i.e. you can safely host a public lemmod without worrying about
getting pwned) and explicitly limited functionality (so mods can't easily
instruct the bot to spam random communities or whatnot)

YAML isn't REALLY the best tool for this job, but it's widely used and is easy
to grasp (hi Nix)

## Setup

### Building

```sh
$ git clone https://github.com/ShittyKopper/lemmod
$ npm install --dev
$ npm run build
```

### Configuration

Rename `.env.template` as `.env` and edit as needed. Alternatively, any other
way of providing environment variables will work.

### Startup

You can run the bot with `npm run start`
