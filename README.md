# PokéQuizBOT
A discord bot intended to help run daily "Who's That Pokémon?" style quizzes!

To setup the bot, put your token and user id in `STUP-INFO.js`. The GitHub username and password fields are optional - originally, they were needed for the `$restart` command to automatically download the latest files (now that this repository is public you might not need it).

### Quizzes
1. Before starting any quiz you need to set how long it will last with `$SetQuizLength` and which channel to send the messages to with `$SetQuizChannel` (These only need to be done once)

2. To setup the information for a specific quiz you can use `$SetupQuiz`. This is a shortcut for using `$SetQuestionImage`, `$SetPokemon`, `$SetDescription`, and `$SetAnswerImage` in that order. These 4 commands (in any order) will need to be used before a new quiz (assuming you don't want to use the same quiz twice in a row).
   - For the images you can either give it a url or upload an attachment to discord
   - To see what the answer will look like once it's posted use `$PreviewAnswer`. To keep the answer a secret, the bot will DM you this information.

3. To start a quiz, use `$StartQuiz` and it will begin immediately.
   - Alternatively, you can use `$SetQuizTime` and `$StartDailyQuizzes` to set a time that quizzes will automatically start at every day. It will post whatever information it has so it's on you (the quiz host) to update that information before it starts.
	    - If you do this, you can use `$SetSkipDays` to choose days that it will *not* automatically post quizzes on

4. People can then make their guesses with `$Guess`. It is recommended that people to use this command in DMs with the bot.
   - `$prompt` will show the image they're trying to guess the Pokémon for
   - `$TimeRemaining` will show how much time they have left to guess
	    - **Note:** this is definitely not as accurate as it shows. Only trust it give or take a minute.

5. The quiz will end after the time is up, or you can use `$StopQuiz` to end it manually (it will post the answer)
   - To stop daily quizzes use `$StopDailyQuizzes` (as the name might suggest)


One big idea I had for the future: Maybe (eventually) create a database that it can use with images and descriptions from different generations.

Anyways, I have left in a lot of other commands for fun/just because (`$slots` is a personal favourite and always a crowd pleaser). Most things should be properly documented - use `$help <command>` for more information on how to use them. All commands are *not* case sensitive.
