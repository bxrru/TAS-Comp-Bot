// variables for bot mode
var allowSubmission = false;
var task = 1;

module.exports = {
	allowSubmission:function(rawrxd){
		allowSubmission = true;
		task = rawrxd;
	},
	getAllowSubmission:function(){
		return allowSubmission;
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
