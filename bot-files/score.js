var score = [];
var setLength = 5;
var scoreMsg;

module.exports = {

  // k=place, n=participants
  // points = 15x^6 + 10x^4 + 5x^2 + 14x + 6
  alg:function(k,n) {
    x = (1 - (k-1)/n);
    points = 15*x*x*x*x*x*x + 10*x*x*x*x + 5*x*x + 14*x + 6;
    return parseFloat(points.toFixed(1));
  },



  // a = ["1. Name time miscinfo"]
  // return = [int(place), "Name", float(points)]
  resultsToScore:function(a) {

    var score = [];
    var participants = a.length;
    var name, place, points, coop;

    for (i = 0; i < participants; i++){

      if (a[i].length == 0 || a[i].toUpperCase().substr(2) == "DQ" || a[i].toUpperCase().substr(4) == "HTTP"){
        break;
      }

      // assumes there is a space between place and name
      name = a[i].split(" ")[1];

      place = parseInt(a[i]);

      points = this.alg(place, participants);

      score.push([place, name, points]);

      // co-op results
      coop = a[i].indexOf("&");

      if (coop != -1){

        name = a[i].substring(coop+1, a[i].length).trim();
        name = name.split(" ")[0];
        score.push([place, name, points]);
      }
    }

    return score;
  },



  // the score stored as an array
  getScore:function(){
    return this.score;
  },

  setScore:function(a){
    this.score = [];
    while (a.length > 0){
      this.score.push(a.shift());
    }
  },



  // Number of tasks in each set
  getSetLength:function(){
    return this.setLength;
  },

  setSetLength:function(x){
    this.setLength = x;
  },



  // The bot's stored score message
  getScoreMsg:function(){
    return this.scoreMsg;
  },

  setScoreMsg:function(msg){
    this.scoreMsg = msg;
  },



  // scores = [int(place), "Name", float(points)]
  addScores:function(a, b){

    if (a === undefined || a.length == 0){return b;}
    if (b === undefined || b.length == 0){return a;}

    var NewScore = [];
    var name = "";
    var points = 0.0;

    for (var i=0; i<a.length; i++){

      name = a[i][1];
      points = a[i][2];

      // check if the player appears in both
      for (var j=0; j<b.length; j++){

        if (name.toUpperCase() == b[j][1].toUpperCase()){
          // remove the duplicate from b as to not check them again
          points += b.splice(j,1)[0][2];
          break;
        }
      }

      NewScore.push([0, name, points]);
    }

    // any remaining players only in b
    for (var i=0; i<b.length; i++){
      NewScore.push([0, b[i][1], b[i][2]]);
    }

    return NewScore;

  },



  // returns score with proper placement
  sortScore:function(a){

    if (a === undefined || a.length == 0){return [];}
    if (a.length == 1){return [1, a[0][1], a[0][2]];}

    // sort by descending points
    a = a.sort(function(a,b){b[2] - a[2]});

    a[0][0] = 1;

    for (var i=1; i<a.length; i++){

      // same points as previous => same place as previous
      if (a[i][2] == a[i-1][2]){

        a[i][0] = a[i-1][0];

      } else {

        a[i][0] = i+1;
      }
    }

    return a;

  },



  scoreToMessage:function(a, task, set, useHeader){

    if (a === undefined || a.length == 0){return "No Results";}

    var msg = "**";

    if (useHeader === undefined){useHeader = true;}

    if (useHeader){

      if (set === undefined){
        set = ~~((parseInt(task) - 1)/5) + 1; // floor division
      }

      msg += "__Set " + set.toString() + " Score ";
      msg += "After Task " + task.toString() + "__\n\n";
    }

    var stopBold = true;
    var place = 0;
    var name = "";
    var points = 0.0;

    for (var i=0; i<a.length; i++){

      place = a[i][0];
      name = a[i][1];
      points = a[i][2];

      // bold top 3
      if (place>3 && stopBold){
        msg += "**";
        stopBold = false;
      }

      msg += place.toString();

      // Checks last character of place => 1st, 2nd, 3rd, 4th...
      switch (place.toString().substr(place.length - 1, 1)) {
        case "1":
          msg += "st";
          break;

        case "2":
          msg += "nd";
          break;

        case "3":
          msg += "rd";
          break;

        default:
          msg += "th"
          break;
      }

      msg += ". " + name + ": " + points.toString();

      if (points.toString().substr(-2,1) != "."){msg += ".0";}

      msg += "\n";

    }

    if (stopBold){
      msg += "**";
    }

    return msg;

  },



  updateScore:function(resultsMessage){

    var msg = "";
    try {

      // "Task # Results"
      var task = resultsMessage.split("\n")[0].split(" ")[1];

      // reset scores at the start of a new set
      if ((task-1) % this.getSetLength == 0){this.setScore([]);}

      var pastScore = this.getScore();

      var results_s = resultsMessage.split("\n")
      results_s.splice(0,2);

    	var results = this.resultsToScore(results_s);

    	var newScore = this.addScores(pastScore, results);

    	newScore = this.sortScore(newScore);

    	this.setScore(newScore);

    	msg = this.scoreToMessage(this.getScore(), task);

    } catch (e) {

      msg = "Could not process results";

    } finally {

      return msg;
    }
  },



  processRequest:function(user, action, args){

    var msg = "";

    switch (action) {
      case "PRINT":

        // optional task
        var task = 0;
        if (args.length > 0){parseInt(args.shift());}

        // optional set
        var set = ~~((parseInt(task) - 1)/5) + 1;
        if (args.length > 0){set = parseInt(args.shift());}

        msg = this.scoreToMessage(this.getScore(), task, set, false);

        break;

      case "SET":

        break;

      case "CLEAR":
        this.setScore([]);
        msg = "Score cleared";
        break;

      case "CHANGENAME":
        break;

      case "CHANGEPOINTS":
        break;

      case "COMBINE":
        break;

      case "ADD":
        var newScore = this.addScores([0, args[0], parseFloat(args[1])], this.getScore());
        newScore = this.sortScore(newScore);
        this.setScore(newScore);
        msg = "Added ``"+args[0]+": "+args[1]+"``";
        break;

      case "REMOVE":
        break;

      case "CHANGESETLENGTH":
        this.setSetLength(parseInt(args[0]));
        msg = "Score will reset every " + parseInt(args[0]).toString() + " tasks";
        break;

      case "CALCULATE":
        break;

      default:
        msg = "Failed request, action: ``"+action+"`` not recognized. Action must be ";
        ["PRINT","SET","CLEAR","CHANGENAME","CHANGEPOINTS","COMBINE","ADD","REMOVE"].forEach(function(a){
          msg += "``"+a+"``, ";
        });
        msg+="``CALCULATE``";
        break;

    }

    return msg;

  }



};
