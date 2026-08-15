PATH = debug.getinfo(1).source:sub(2):match("(.*\\)")
dofile(PATH .. "Ghost.lua")
local targetFileName = PATH .. "tmp.ghost"
local errorFileName = PATH .. "error.txt"

function Error(x)
	print("Error: " .. x)
	local file = io.open(errorFileName, "w")
	if file ~= nil then
		file:write("Error: ".. x)
		file:close()
	end
	os.exit(0)
	return "Error"
end

Ghost.initRecording()

emu.set_ff(true)

emu.atinput(function() xpcall(Ghost.recordFrame, Error) end)

emu.atstopmovie(function()
	Ghost.saveRecording(targetFileName)
	os.exit()
end)
