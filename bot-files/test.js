

1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78

process.title = "2botslater";
const Eris = require("eris");
log("Starting...");

var date = new Date(); var timestamp = date.getTime();

var bot = new Eris.CommandClient("lol get your own", {}, {
    description: "the dopest shit you'll ever see in discord",
    owner: "2secslater",
    prefix: "?"
});

bot.on("ready", () => {
    log("Ready!");
});

bot.on("messageCreate", (msg) => {
	
    if(msg.channel.type == 0 && msg.channel.id != 388423855510781955){

		var attachments = "";
		var embeds;

		for (var i = 0; i < msg.attachments.length; i++) {
            attachments = attachments + msg.attachments[i].url + "\n";
        }

        //Console Log
		log("(" + msg.channel.guild.name + ") " + "#" + msg.channel.name + " [" + msg.author.username + "#" + msg.author.discriminator +  "] " + msg.cleanContent + " " + attachments);

		//BFL Log	
		//bot.getChannel("388423855510781955").createMessage("`[" + getDateTime() + "] (" + msg.channel.guild.name + ") #" + msg.channel.name + " [" + msg.author.username + "#" + msg.author.discriminator + "] " + msg.cleanContent.replace(/`/gi, '') + "`\n" + attachments);
    }
});

bot.registerCommandAlias("halp", "help");

var yeetCommand = bot.registerCommand("yeet", (msg) => {
    return "YEET!\nYour message timestamp: " + (msg.timestamp / 1000) + "\nCurrent timestamp: " + (timestamp / 1000);
}, {
    description: "Timestamp",
    fullDescription: "Timestamp",
    usage: "none lol"
});

bot.connect();

function getDateTime() {
    var now     = new Date(); 
    var year    = now.getFullYear();
    var month   = now.getMonth()+1; 
    var day     = now.getDate();
    var hour    = now.getHours();
    var minute  = now.getMinutes();
    var second  = now.getSeconds(); 
    if(month.toString().length == 1) {
        var month = '0'+month;
    }
    if(day.toString().length == 1) {
        var day = '0'+day;
    }   
    if(hour.toString().length == 1) {
        var hour = '0'+hour;
    }
    if(minute.toString().length == 1) {
        var minute = '0'+minute;
    }
    if(second.toString().length == 1) {
        var second = '0'+second;
    }   
    var dateTime = day+'/'+month+'/'+year+' '+hour+':'+minute+':'+second;   
     return dateTime;
     
}

function log(msg) {
	console.log("[" + getDateTime() + "] " + msg);
}

