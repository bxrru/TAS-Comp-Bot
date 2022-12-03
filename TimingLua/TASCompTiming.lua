-- SM64 Timing Script v1.0
-- Author: MKDasher

function RunScript()
	PATH = debug.getinfo(1).source:sub(2):match("(.*\\)") .. "\\TASCompTiming\\"
	dofile (PATH .. "Program.lua")
	dofile (PATH .. "Utils.lua")
	dofile (PATH .. "Actions.lua")
	dofile (PATH .. "Animations.lua")
	dofile (PATH .. "File.lua")
	dofile (PATH .. "Memory.lua")
	dofile (PATH .. "State.lua")
	dofile (PATH .. "Time.lua")
	
	File.setLuaPath(debug.getinfo(1).source:sub(2):match("(.*\\)")) --Lua modules will use File.LUA_PATH instead of this function.-
	File.RESULT_FILE = File.LUA_PATH .. "result.txt"
	
	CONDITION_FUNCS, err = loadfile(debug.getinfo(1).source:sub(2):match("(.*\\)") .. "\\Conditions.lua")
	if err then
		print(err)
	end
	if CONDITION_FUNCS == nil then 
		print("No task conditions defined.")
		Error(err)
	else
		CONDITION_FUNCS()
	end

	function main()
		Program.main()
	end

	if CONDITION_FUNCS  ~= nil then
		os.remove(File.RESULT_FILE)
		File.loadM64(File.LUA_PATH .. "submission.m64")
		emu.atinput(function() xpcall(main, Error) end)
	end
end

function Error(x)
	print("Error: " .. x)
	local file = io.open(File.RESULT_FILE, "w")
	if file ~= nil then
		file:write("Error: ".. x)
		file:close()
	end
	os.exit(0)
	return "Error"
end

xpcall(RunScript, Error)