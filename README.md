# TAS-Comp-Bot
This is a discord bot meant to help automate SM64 TAS Competitions by handling submissions, scores, and much much more!

Join the SM64 TASing server to keep up to date on the latest competitions: https://discord.gg/ECskvyF


### Running the Bot
Assuming you have a [bot application](https://discord.com/developers/applications) and [Node.js](https://nodejs.org/en/download/), download the files for this repository, then install the dependencies by opening a command prompt in the folder containing this readme and running `npm i`. If you have build errors try downloading the [Visual Studio Community 2017](https://visualstudio.microsoft.com/vs/older-downloads/) Node.js build tools and running `npm i --msvs_version=2017`.

Next, put your token in `bot.js` and run `node .\start.js .\bot.js` to start the bot! Any user ids in the list of "Owner_IDs" will be able to use all of the commands, so make sure to add yours.

It's possible to run multiple bots from the same code by creating a new file with the same format as bot.js but with a different token. To keep their saves separate make sure to change the saves path.

For voice support you need [ffmpeg](https://ffmpeg.org/download.html) on your PATH environment variable.

To enable updates: install [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git). Additionally, for Windows Users: change "/" to "\\" on line 20 & 35 in `start.js`. This is because filepaths are hardcoded for linux.



### Features
All of the available functions are documented within the bot. Run it and type `$help` for more info. Here is an overview of some key functionality:

When a competition is running, the bot will collect and store information on the submissions from the competitors. This makes it easy to get all of the files at once and to see how many people have entered. You can set up a list of "hosts" who will receive competition updates such as when someone new enters, when files are updated, or if someone's run has been timed. All of these notifications can be toggled for the individual hosts (IE someone can choose to see new submissions but not when any files are updated).

It can automatically create the properly formatted results which, when posted, can be automatically converted into a running score during the competition. When people manually make the results there are often slight errors in spelling which can mess up the score. This is typically avoided when the bot generates the results itself, but in the event that something in the score is incorrect, there are many functions to help remedy that.

Announcements! The bot can schedule announcements in a specific channel with a specific message. These can also be repeated on a given interval (daily, weekly, etc.). It can even be used to DM you a reminder for something.

It's possible to remotely restart the bot, and have it download the latest files from this repository. This is useful if you're not in a position to ssh into a host server.

There is also a permissions system to give people access to all the bot commands. You can either add individual people or allow all the commands within a set of specified channels.

All data (such as submitted files, scheduled announcements, etc.) is saved locally in json files so if it ever cashes, no data will be lost.

`$slots` is the #1 most used command by far. Try it. You will become addicted.



### Future Development
This project is always evolving and there are always new feature requests, but here is a current list of things I plan to implement:
- test interface
- silent bans
- voice queue
- global handle for messages over 2000 characters
- choose which files to update on restart

Low priority:
- generalize prefix
- refactor score for consistent formatting
- fix brainfuck compiler TLE
