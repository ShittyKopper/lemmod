# lemmod Moderator Documentation

## Getting Started

Add the bot as a moderator to your community. Within the next 10 minutes the bot
should recognize that and start following your community.

While that's happening, go craft [a configuration](#configuration) telling it
what to do.

When you have done so, send a private message to the bot. The message should be
in this exact format:

````
!community@example.com
```
# your config here
```
````

The first line must be the community identifier **in that exact format**.
The second line must open a code block with ` ``` `, and the last line must close
it, also with ` ``` `.

In between the two triple backtick lines is where you should paste your
configuration.

If successful, the bot will reply to you telling you it has updated your community
successfully, and from that point on, it will use that configuration.

If you want to get the config back at a later date, simply send the community
identifier with no new config (i.e. just the first line). The bot will ship you
the configuration it's using for your community.

Right now, the bot is intentionally slowed down to avoid hammering on instances
too much. If you see un-actioned content, let me know and I might speed it up.
I'm not sure on the exact balance of how fast I can make it go without overloading
instances with useless busywork. See `src/bot.ts` for the exact timings.

## Configuration

Configuration is written in YAML. Here is a simple example to get you started:

```yml
variables:
    community: c/MyReallyCoolCommunity

script:
    - on:
          new: post

          url:
              domain: example.com

      actions:
          delete:
          message: Sorry, but {{community}} does not allow links to {{post.url.domain}}.
```

This is a simple configuration that will remove all new posts containing a link
to example.com, with a private message sent to the creator telling them we don't
do that here.

Here is how it works:

```yml
variables:
    community: c/MyReallyCoolCommunity
```

Variables are simple key:value "shortcuts" intended to cut down on repeated text.
There really isn't anything special here except for the fact that you can't use
the names `post`, `comment`, or `creator` as variable names, as they're reserved.

```yml
script:
    - on:
          new: post
```

The `script:` block is where the actual logic is defined in. If your YAML-fu is
strong, you can notice that there is a `-` before `on:`, implying it's a list.

You can only use one configuration per community, but each can have multiple `on:`
blocks attached to them.

```yaml
url:
    domain: example.com
```

This part will match a URL with that exact domain. You can also use regular
expressions, and variables here via mustache syntax (like `{{ variable }}`)

```yaml
actions:
    delete:
    message: Sorry, but {{community}} does not allow links to {{post.url.domain}}.
```

The `on:` block tells the bot the post to action upon, and the `actions:` block
tells it what to do to the post. In this case, we `delete:` it, and send a
`message:` to the creator, telling them to just calm down.

You can only run an action once, so multiple `message:` blocks or whatever are
not allowed.

## Configuration Reference

Here is the complete configuration reference:

```yaml
# This is a file that attempts to be a resource on EVERYTHING lemmod can do.

script:
    - on:
          new: post

          # Type: text. By default, it'll match things exactly
          title: Will match this exact title

          # Type: text
          body:
              # regex: can be used to match regexes
              regex:
                  match: JS "flavored" regular expression here
                  save_groups: # Named groups only. Allows for usage in actions later on
                      - group

          # Type: boolean. true or false
          nsfw:

          embed:
              # Type: text
              title:

              # Type: text
              description:

          # Type: url
          # You can also use anything supported by the "text" type, like regex,
          # on the complete url.
          url:
              # Type: text. The part after "#", if exists
              hash:

              # Type: text
              domain:

              # Type: text
              path:

              # The part after "?", if exists
              query:

          # Type: user
          creator:
              # Type: boolean
              admin:

              # Type: boolean
              bot:

              # Type: boolean
              local:

              # Type: text
              name:

              # Type: text
              display_name:

      actions:
          # Common to posts & comments

          delete: Delete reason
          ban: Ban reason

          message: This message will be DMd to the creator.
          report: Will be reported with this message.
          reply: This text will be sent as a comment to a post, or as a reply to a comment.

          # Exclusive to posts

          rename: New title
          pin: # Pin has no arguments. Not sure if you can pin non-moderator posts
          lock: # Lock has no arguments

    - on:
          new: comment

          # Type: text
          body:

          # Type: user. See above for details
          creator:

      actions:
          # See above "Common to posts & comments"
          # No actions exclusive to comments so far
```

## Important missing features

-   Tracking edits would be too taxing on both Lemmy and the bot itself, as we'd
    have to re-check every single post all over again. If Lemmy were to make a
    "Sort by edited" feed, that would make that easier to do.

    -   As such, the bot only works on new posts and comments.

-   I couldn't find an easy way to convert between instance IDs and instance domains,
    so can't filter by instance for now. Which is bad because it sounds like it'd
    be really damn useful.
