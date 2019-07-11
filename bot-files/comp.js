const users = require("./users.js");
const chat = require("./chatcommands.js");
var allowSubmission = false;
var task = 1;
var submissionMessage = {channel_id:"", message_id:""};
var submissions = {}; // ID: username
var num_submissions = 0;

module.exports = {
	allowSubmission:function(rawrxd){
		allowSubmission = true;
		task = rawrxd;
	},
	getAllowSubmission:function(){
		return allowSubmission;
	},
	getTaskNum:function(){
		return task;
	},
	stopSubmissions:function(){
		allowSubmission = false;
	},
	clearSubmissions:function(){
		// clear google drive files

		// remove submitted roles from everyone

		// clear #current_submissions
	},
	setSubmissionMessage:function(channel_id, message_id){
		submissionMessage.channel_id = channel_id;
		submissionMessage.message_id = message_id;
	},
	addSubmission:function(bot, user_id){
		users.getUser(bot, user_id, (error, user) => {
			bot.getMessage(submissionMessage.channel_id, submissionMessage.message_id).then((msg) => {
				num_submissions++;
				msg.edit(msg.content + "\n"+num_submissions+". "+user.username);
			});
		});
	}
	// TODO: start submission (chat.send(bot, channel, "**__C_S__\n**"))
};
