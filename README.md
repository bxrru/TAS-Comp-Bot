# TAS-Comp-Bot
I will eventually get around to writing a proper readme dont worry. For now, all you need to do is put your token in bot.js and run:

node .\start.js .\bot.js

Filepaths are hardcoded for linux. To enable updates on windows: on line 19 & 34 in start.js use "\\" instead of "/".
Im not sure how this was originally setup which is why the node files are included. To run multiple bots simply create a new file with the same format as bot.js but with a different token, bot-files path, and saves path, then run the same command as above replacing .\bot.js appropriately



Active development of the upcoming bot for the TAS Competition server. (Server ID: 397082495423741953)

TODO:
make bot lol

	bot needs to give people @submitted
		use prefix $, likely command $clear for clearing current_submissions?
		needs to be able to grab timestamp from message
		needs to be able to upload every files to Google Drive, likely to **REDACTED** in a shared folder?
		must be able to only upload latest file, or put files that aren't recent in other folder
		needs to be able to DM:
			(TAS Competition 2019#3160) <@397096658476728331>

		The roles for this bot are:

			Server:
		[TAS Competition 2019] <397082495423741953>
			Role:
		(@Submit To Me) <@&397101287872921600

			Server:
		[SM64 TASing and ABC] <267091686423789568>
			Role:
		(@SUBMIT HERE) <@&407725901577584640>

			Channels of note:
		#current_submissions <#397096356985962508>
		#bot <#554820730043367445>
--

	Intended drive folder structure:
			(root) -> Task Number -> Folder containing .m64 and .st files
		OR
			(root) -> Task Number -> Username -> Folder containing .m64 and .st files

--
Competition Information For Admins

	This message covers the main functions that you will need to use. For a full list of competition commands use `$comp` and for help about how to use any command use `$help command_name`.

	To start the competition, you first need to use `$startsubmissions`. To confirm that it is accepting submissions use `$compinfo` and it should say `"Accepting submissions"`. Otherwise it will not save any files that are sent to it.

	To end the competition, use `$stopsubmissions` and it will no longer update any files.

	To see someone's files, use `$get <submission_number>`. To get the <submission_number> refer to the number beside the corresponding name on the 'current_submissions' list. You can find a link to the current_submissions message by using `$compinfo` or you can directly show the list using `$listsubmissions`. As a warning this will post the links to the files in whatever channel you call the command so dont use this in a public channel.

	To download all of the files at once use `$get all`. This will send a batch file which you can run by simply opening the file. It will sort the files nicely into folder. You will likely be warned multiple times that it is a virus and if you dont trust me you can use `$get` and download each submission individually. Batch scripts will only work natively on Windows computers.

	If someone sends you the files and you want to try adding it to the bot's database you can do that by going `$addsubmission <user_id>` then `$submitfile <submission_number> <url>`. To get the <user_id> you will need to have developer mode enabled (discord settings > appearance) then right click on the user and copy id. To get the <url> copy the url from the file they send you.

	If you have DQd someone and want to remove them from #current_submissions, use `$deletesubmission <submission_number>`. This will also delete their files.

	If someone is abusing `$setname` to put profanities in #current_submissions or the like, you can use `$lockname <submission_number> <new name>`. The new name can contain spaces (Ex `$lockname 1 ERGC | Xander`). To give them the permissions back use `$unlockname <submission_number>`

	At the end of the competition when you want to save a fresh set a files use `$clearsubmissions`. This will delete files, remove the submitted role from everyone who has submitted, and delete the #current_submissions message

Q: What kind of updates will the bot send the admins?

	A: A message will be sent out to the list of "hosts" notifying them of a couple of things including:
		- When a new submission is added (and by who)
		- When a new file is uploaded (by who, with links to the file)
		- When files are deleted (with links to the files)
		- When the bot starts/stops accepting submissions
		- When the @Submitted role could not be assigned (likely due to the person not being in the server)
		- When they are added/removed from the list of "hosts"/people who receive the updates
