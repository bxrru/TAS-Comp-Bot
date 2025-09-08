# TAS-Comp-Bot

This is a discord bot meant to help automate SM64 TAS Competitions by handling submissions, scores, and much much more!

Join the SM64 TASing server to keep up to date on the latest competitions: https://discord.gg/ECskvyF

# Quickstart

## Setting up

1. Rename `/bot.js.template` to `/bot.js` and fill in your bot token

2. Rename `/saves_template` to `/saves`

3. Add your own Discord user ID to the admin list in `/saves/admin.json`

4. Change the bot's target channels in `/saves/channels.json` to ones it has access to

5. Change the paths in `/saves/m64.json` to match your filesystem structure

    Note that the ROM filenames associated with CRCs will have their spaces replaced with underscores when utilized by the bot (e.g. `Super Mario 64 (USA).z64` -> `Super_Mario_64_(USA).z64`)

6. (optional) For voice support, you need [ffmpeg](https://ffmpeg.org/download.html) on your PATH environment variable.

7. (optional) Enable update support by installing [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).

    Additionally, for Windows Users: change "/" to "\\" on line 20 & 35 in `start.js`. This is because filepaths are hardcoded for linux.

8. (optional) For encoding support, set up Mupen64.

    a. Enable "Silent Mode" in the Mupen settings (prevents popup windows from preventing the emulator from closing).

    b. Enable "Keep Working Directory" in the Mupen settings (allows running locally-stored TAS files with relative directories).

    c. Set "Core Type" to "Pure Interpreter"

    d. Open a game and start a video capture using "Utilities > Video Capture > Start Capture...", and set the codec to [x264vfw](https://sourceforge.net/projects/x264vfw/). Make sure to copy the generated `avi.cfg` to the bot project root.

## Starting the Bot

1. Install [Deno](https://deno.com/)

2. Install the packages using `deno i`

3. Run the bot using `deno --allow-all ./bot-files/main.js ./bot.js`

> [!NOTE]
> It's possible to run multiple bots from the same code by creating a new file with the same format as `bot.js` but with a different token.
>
> Additionally, you should keep their saves separate by changing the saves path.

# Features

All of the available functions are documented within the bot. Run it and type `$help` for more info.

Here is an overview of some key functionality:

When a competition is running, the bot will collect and store information on the submissions from the competitors. This makes it easy to get all of the files at once and to see how many people have entered. You can set up a list of "hosts" who will receive competition updates such as when someone new enters, when files are updated, or if someone's run has been timed. All of these notifications can be toggled for the individual hosts (IE someone can choose to see new submissions but not when any files are updated).

It can automatically create the properly formatted results which, when posted, can be automatically converted into a running score during the competition. When people manually make the results there are often slight errors in spelling which can mess up the score. This is typically avoided when the bot generates the results itself, but in the event that something in the score is incorrect, there are many functions to help remedy that.

Announcements! The bot can schedule announcements in a specific channel with a specific message. These can also be repeated on a given interval (daily, weekly, etc.). It can even be used to DM you a reminder for something.

It's possible to remotely restart the bot, and have it download the latest files from this repository. This is useful if you're not in a position to ssh into a host server.

There is also a permissions system to give people access to all the bot commands. You can either add individual people or allow all the commands within a set of specified channels.

All data (such as submitted files, scheduled announcements, etc.) is saved locally in json files so if it ever cashes, no data will be lost.

`$slots` is the #1 most used command by far. Try it. You will become addicted.

### Future Development

This project is always evolving and there are always new feature requests, but here is a current list of things I plan to implement:

- include all mupen settings that are required
- test interface
- silent bans
- voice queue
- global handle for messages over 2000 characters
- choose which files to update on restart
- automatically load all files in bot-files directory

Low priority:

- generalize prefix
- refactor score for consistent formatting
- fix brainfuck compiler TLE
