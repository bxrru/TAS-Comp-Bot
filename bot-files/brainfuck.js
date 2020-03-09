const MEM_LENGTH = 64
const MEM_SIZE = 256

var info = "Compiles brainfuck code \`+-<>.,[]\` (See https://en.wikipedia.org/wiki/Brainfuck)."
info += "Code that asks for input with \`,\` will take the first character of the next message it receives."
info += `Memory afterwards. Memory length: \`${MEM_LENGTH}\``

var Instructions = []
var Loops = []
var Skip = 0
var pos = 0

var Output = ""
var Cell = 0
var Mem = []

function Init(msg){
  Instructions = msg.split('')
  Loops = []
  Skip = 0
  pos = 0
  Output = ""
  Cell = 0
  Mem = []
  for(var i=0;i<MEM_LENGTH;i++) Mem.push(0)
}

async function Apply_Command(bot, msg, c, silent){
  if (c=='[' && Mem[Cell]!=0) Loops.push(pos)
  if (c=='[' && Mem[Cell]==0) Skip++
  if (c==']' && Mem[Cell]!=0) pos = Loops[Loops.length-1]
  if (c==']' && Mem[Cell]==0 && Skip) Skip--
  if (c==']' && Mem[Cell]==0 && !Skip) Loops.pop()
  if (Skip) return
  if (c=='+') Mem[Cell] = (Mem[Cell]+1) % MEM_SIZE
  if (c=='-') Mem[Cell] = Mem[Cell]==0 ? MEM_SIZE-1 : Mem[Cell]-1
  if (c=='>') Cell = (Cell+1) % MEM_LENGTH
  if (c=='<') Cell = Cell==0 ? MEM_LENGTH-1 : Cell-1
  if (c=='.') Output += String.fromCharCode(Mem[Cell])
  if (c==',') Mem[Cell] = await Input(bot, msg.channel, silent)
}

async function Input(bot, channel, silent){
  let my_msg = {}
  if (silent) {
    my_msg = await channel.getMessages(1)
    my_msg = my_msg[0]
  } else {
    my_msg = await bot.createMessage(channel.id, "Polling for Input:")
  }
  let recent_msg = my_msg
  while (recent_msg.id == my_msg.id){
    let msgs = await channel.getMessages(2)
    recent_msg = msgs[0]
  }
  if (!silent) channel.createMessage(`Input Received: ${recent_msg.content.charCodeAt(0)} (${recent_msg.content.substr(0,1)})`)
  return recent_msg.content.charCodeAt(0)
}

module.exports = {

  run:{
    name: "bf",
    short_descrip: "Compiles brainf* code",
    full_descrip: info,
    hidden: false,
    function: async function(bot, msg, args, debug, silent){
      if (Instructions.length) return // prevents executing input as code (if every message is compiled)
      Init(msg.content)
      while (pos < Instructions.length){
        await Apply_Command(bot, msg, Instructions[pos], silent)
        pos++
      }
      if (debug===undefined) debug = true
      if (debug) Output = `Output: ${Output}\nCell: ${Cell}\nMemory: ${Mem}`
      Instructions = []
      return Output
    }
  }

}
