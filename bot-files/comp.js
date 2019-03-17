// variables for bot mode
var allowSubmission = false;
var task = 1;

module.exports = {
	allowSubmission:function(task){
		allowSubmission = true;
		task = task;
	},
	stopSubmissions:function(){
		allowSubmission = false;
	},
	clearSubmissions:function(){
		// clear google drive files
		
		// remove submitted roles from everyone
		
		// clear #current_submissions
	}
};
