File = {
	LUA_PATH = ""
}

function bitAND(a, b)
	local p,c=1,0
	while a>0 and b>0 do
	    local ra,rb=a%2,b%2
	    if ra+rb>1 then c=c+p end
	    a,b,p=(a-ra)/2,(b-rb)/2,p*2
	end
	return c
end

function bytesToInt(b1, b2, b3, b4)
    local n = b1 + b2*256 + b3*65536 + b4*16777216
    n = (n > 2147483647) and (n - 4294967296) or n
    return n
end

function File.setLuaPath(path)
	File.LUA_PATH = path
end

function File.canRead(path)
	local f=io.open(path,"r")
	if f~=nil then
		io.close(f) 
		return true
	else
		return false
	end
end

function File.loadST()
	local stName = Utils.stringsplit(State.m64.m64Name, '.')[1] .. ".st"
	local stPath = State.m64.m64Path .. "\\" .. stName
	if not File.canRead(stPath) then
		stName = Utils.stringsplit(State.m64.m64Name, '.')[1] .. ".savestate"
		stPath = State.m64.m64Path .. "\\" .. stName
		if not File.canRead(stPath) then
			print("Could not load savestate file")
			return false
		end
	end
	savestate.loadfile(stPath)
	print("Savestate loaded: " .. stName)
	return true
end

function File.readFrameCount()
	return bytesToInt(State.m64.rawInput:byte(0x18 + 1, 0x18 + 4))
end

function File.readRerecords()
	return bytesToInt(State.m64.rawInput:byte(0x10 + 1, 0x10 + 4))
end

function File.readFrame(index)
	b1,b2,b3,b4 = State.m64.rawInput:byte(0x400 + index * 4 + 1, 0x400 + index * 4 + 4)
	inputFrame = joypad.get(1)
	inputFrame['A'] = bitAND(b1,0x80) > 0
	inputFrame['B'] = bitAND(b1,0x40) > 0
	inputFrame['Z'] = bitAND(b1,0x20) > 0
	inputFrame['start'] = bitAND(b1,0x10) > 0
	inputFrame['up'] = bitAND(b1,0x08) > 0
	inputFrame['down'] = bitAND(b1,0x04) > 0
	inputFrame['left'] = bitAND(b1,0x02) > 0
	inputFrame['right'] = bitAND(b1,0x01) > 0
	inputFrame['L'] = bitAND(b2,0x20) > 0
	inputFrame['R'] = bitAND(b2,0x10) > 0
	inputFrame['Cup'] = bitAND(b2,0x08) > 0
	inputFrame['Cdown'] = bitAND(b2,0x04) > 0
	inputFrame['Cleft'] = bitAND(b2,0x02) > 0
	inputFrame['Cright'] = bitAND(b2,0x01) > 0
	if (b3 > 127) then
		b3 = b3 - 256
	end
	if (b4 > 127) then
		b4 = b4 - 256
	end
	inputFrame['X'] = b3
	inputFrame['Y'] = b4
	return inputFrame
end

function File.loadM64(path)
	State.m64.m64Path = path:match("(.*[/\\])")
	State.m64.m64Name = string.sub(path, string.len(State.m64.m64Path) + 1)
	file = io.open(path, "rb")
	State.m64.fileSize = file:seek("end")
	file:seek("set", 0)
	State.m64.rawInput = file:read("*all")
	file:close()
	State.m64.frameCount = File.readFrameCount()
	State.m64.rerecords = File.readRerecords()
	
    print("M64 loaded: " ..State.m64.m64Name)
    print("Framecount: " .. State.m64.frameCount)
    print("Rerec count: " .. State.m64.rerecords)
end