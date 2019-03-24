var score = [];
var Help = require("./score_help.js");

module.exports = {

  // k=place, n=participants
  // points = 15x^6 + 10x^4 + 5x^2 + 14x + 6
  alg:function(k,n) {
    x = (1 - (k-1)/n);
    points = 15*x*x*x*x*x*x + 10*x*x*x*x + 5*x*x + 14*x + 6;
    return points.toFixed(1);
  },



  isInt:function(x) {
    try {
      int(x);
    } catch(err) {
      return false;
    } finally {
      return true;
    }
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

      // reduces the string from the right until
      // it can make an integer for placement
      place = a[i].trim();

      while (!This.isInt(place)){

        place = place.substr(-1);

        // failsafe incase of extra characters
        // at the start of the string
        if (place.length == 0){
          place = 0;
          break;
        }
      }

      place = int(place);

      points = This.alg(place, participants);

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



  getScore:function(){
    return This.score;
  },



  setScore:function(a){
    This.score = [];
    while (a.length > 0){
      score.push(a.pop());
    }
  },



  // scores = [int(place), "Name", float(points)]
  addScores:function(a, b){

    if (a.length==0){return b;}
    if (b.length==0){return a;}

    var NewScore = [];
    var name = "";
    var points = 0.0;

    for (i=0; i<a.length; i++){

      name = a[i][1];
      points = a[i][2];

      // check if the player appears in both
      for (i=0; i<b.length; i++){

        if (name.toUpperCase() == b[i][1].toUpperCase()){

          points += b.slice(i,1)[2];
          break;
        }
      }

      NewScore.push([0, name, points]);
    }

    // any remaining players only in b
    for (i=0; i<b.length; i++){
      NewScore.push([0, b[i][1], b[i][2]]);
    }

    return NewScore;

  },



  // returns score with proper placement
  sortScore:function(a){

    if (a.length == 0){return [1, "NA", 0.0];}
    if (a.length == 1){return [1, a[0][1], a[0][2]];}

    // sort by descending points
    a = a.sort(function(a,b){b[2] - a[2]});

    a[0][0] = 1;

    for (i=1; i<a.length; i++){

      // same points as previous => same place as previous
      if (a[i][2] == a[i - 1][2]){

        a[i][0] = a[i-1][0];

      } else {

        a[i][0] = i+1;
      }
    }

    return a;

  },



  scoreToMessage:function(a, task){

    var set = ~~((int(task) - 1)/5) + 1; // floor division

    if (a.length == 0){return "No Results";}

    var msg = "**__Set " + set.toString() + " Score ";
    msg += "After Task " + task.toString() + "__\n\n";

    var stopBold = true;
    var place = 0;
    var name = "";
    var points = 0.0;

  for (i=0; i<a.length; i++){

    place = a[i][0];
    name = a[i][1];
    points = a[i][2];

      // bold top 3
      if (place>3 && stopBold){
        msg += "**";
        stopBold = false;
      }

      msg += palce.toString();

      // Checks last character of place => 1st, 2nd, 3rd, 4th...
      switch (place.toString().substr(place.length - 1)) {
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

      msg += ". " + name + ": " + points.toString() + "\n";

    }

    if (stopBold){
      msg += "**";
    }

    return msg;

  },



  updateScore:function(resultsMessage){

    msg = ""
    try {
      var pastScore = This.getScore();
  		var results = This.resultsToScore(resultsMessage.split("\n").splice(0,2));
  		var newScore = This.addScores(pastScore, results);
  		newScore = This.sortScore(newScore);
  		This.setScore(newScore);
      var task = resultsMessage.split("\n")[0].split(" ")[1]; // "Task # Results"
  		msg = This.scoreToMessage(newScore, task);

    } catch(err) {
      msg = "Could not process results";

    } finally {
      return msg;
    }

  },

  processRequest:function(user, action, args){

    var msg = "";

    switch (action) {
      case "PRINT":
        var task = int(args.shift());
        var set = ~~((int(task) - 1)/5) + 1;
        if (args.length > 0){
          set = int(args.shift());
        }

        break;

      case "SET":
        break;

      case "CLEAR":
        break;

      case "CHANGENAME":
        break;

      case "CHANGEPOINTS":
        break;

      case "COMBINE":
        break;

      case "ADD":
        break;

      case "REMOVE":
        break;

      case "CALCULATE":
        break;

      default:
        msg = "Failed request, action: ``"+action+"`` not recognized. Action must be ";
        ["PRINT","SET","CLEAR","CHANGENAME","CHANGEPOINTS","COMBINE","ADD","REMOVE","CALCULATE"].forEach(function(a){
          msg += "``"+a+"``, ";
        });
        break;

    }

    return msg;

  }



};
