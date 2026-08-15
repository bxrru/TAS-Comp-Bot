--[[
	This file is an abstraction for recording and playing back ghosts
	Note: this only works on the U ROM
	Authors: Xander, Frame (HUGE shoutouts to Frame for making this possible)
]]

Ghost = {
	-- recording
	initRecording = function() end,
	recordFrame = function() end, -- pass this to emu.atinput
	saveRecording = function(filepath) end,

	-- playing back
	applyGhostHack = function() end, -- pass this to emu.atloadstate
	loadGhost = function(filepath) end, -- returns an ID
	updateGhosts = function() end, -- pass this to emu.atinput

	-- changing settings & stopping playback
	unloadGhost = function(ID) end,
	setTransparency = function(ID, transparent) end,
	setColor = function(ID, RGB) end, -- ID = 0 can be used for Mario's hat
	getColor = function(ID) end,
    getGhostData = function(ID, globaltimer) end, -- return the data on a given frame
    getGhostDataLength = function(ID) end,
	
	-- used for manually syncing playback
	getGlobalTimerOnAnimation = function(ID, animation, animationTimer) end,
    getGlobalTimerOffset = function(ID) end, -- return the gt on the first frame of data
	setGlobalTimerOffset = function(ID, offset) end,

    -- used for programatic creation/manipulation of ghosts
    -- see getCurrentFrame for data format
    createGhost = function(ID) end, -- initializes a ghost with the given ID (deletes any existing data) 
    getCurrentFrame = function() end, -- returns data for the real Mario on the current frame
    setGhostFrame = function(ID, data) end, -- safely update ghost data on frame data.offset (creates one if DNE)

	-- used to automatically sync playback
    -- syncAnimation = nil will sync on the first time the animation changes
    -- i.e. if the first animation change sets Mario's animation to 206,
    --   it will look through all the ghosts for the first instance of animation 206 and
    --   make that ghost frame appear on the current frame (and play normally from there)
	syncAnimation = nil, -- nil will sync on the first time the animation changes
	autoSyncGhosts = function() end -- pass this to emu.atinput
}

local Ghosts = {
    GlobalTimerStart = {},
	Offset = {},
	Transparent = {},
    HatColor = {[0] = {0xFF, 0x00, 0x00}}, -- this is Mario's hat color
    Data = {}
}
local nextGhostID = 1
local recordedFrames = {}
local recordingBaseFrame = nil
local lastGlobalTimer = nil

local defaultGhostColorCounter = 1
local DefaultGhostColors = {
    {255, 0, 0},
    {255, 127, 0},
    {255, 255, 0},
    {0, 255, 0},
    {0, 255, 255},
    {0, 0, 255},
    {255, 255, 255},
    {51, 51, 51}
}

--[[
	Relevant memory addresses
]]

local GLOBAL_TIMER_ADDRESS = 0x8032D5D4
local MARIO_OBJ_ADDRESS = 0x80361158

local OBJ_POSITION_OFFSET = 0x20
local OBJ_ANIMATION_OFFSET = 0x38
local OBJ_ANIMATION_TIMER_OFFSET = 0x40

local OBJ_PITCH_OFFSET = 0x1A
local OBJ_YAW_OFFSET = 0x1C
local OBJ_ROLL_OFFSET = 0x1E

local VANILLA_BANK_04_OFFSET_US = 0x0007EC20
local S_SEGMENT_TABLE_OFFSET_US = 0x8033B400
local COLORED_HATS_CODE_TARGET_ADDR = 0x80408200
local COLORED_HATS_LIGHTS_ADDR = 0x80408300

--[[
	Data Type / File Handling
]]

local function writebytes(address, bytes)
    for i = 1, #bytes, 1 do
        memory.writebyte(address + i - 1, bytes[i])
    end
end

local function writebytes32(f,x)
    local b4=string.char(x%256) x=(x-x%256)/256
    local b3=string.char(x%256) x=(x-x%256)/256
    local b2=string.char(x%256) x=(x-x%256)/256
    local b1=string.char(x%256) x=(x-x%256)/256
    f:write(b4,b3,b2,b1)
end

local function writebytes16(f,x)
    local b2=string.char(x%256) x=(x-x%256)/256
    local b1=string.char(x%256) x=(x-x%256)/256
    f:write(b2,b1)
end

local function read_word(file)
    local data = {string.byte(file:read(1)), string.byte(file:read(1))}
    local n = (data[2] << 0x8) + data[1]
    return n
end

local function read_little_endian_int(file)
    local bytes = file:read(4)
    local data = {}
    for b in bytes:gmatch('.') do data[#data + 1] = string.byte(b) end
    return (data[4] << 0x18) + (data[3] << 0x10) + (data[2] << 0x08) + (data[1] << 0x00)
end

-- https://en.wikipedia.org/wiki/Single-precision_floating-point_format
local function read_float(file)
    local n = read_little_endian_int(file)
    local sign = (n & 0x80000000 > 0) and -1 or 1
    local exponent = ((n & 0x7F800000) >> 23) - 127
    local significand = 1.0
    local pow2 = 1.0
    local mask = 1 << 23
    for i = 1, 23 do
        pow2 = pow2 / 2
        mask = mask >> 1
        b = (n & mask) >> (23 - i)
        significand = significand + b * pow2
    end
    return sign * significand * 2^exponent
end

--[[
	Recording a ghost
	Original Author: Frame
]]

function Ghost.initRecording()
	recordedFrames = {}
	recordingBaseFrame = nil
	lastGlobalTimer = nil
end

function Ghost.recordFrame()
	local marioObjRef = memory.readdword(MARIO_OBJ_ADDRESS)
	local _globalTimer = memory.readdword(GLOBAL_TIMER_ADDRESS)
	if recordingBaseFrame == nil then
		recordingBaseFrame = _globalTimer
	end
	if lastGlobalTimer == nil or lastGlobalTimer < _globalTimer then
		lastGlobalTimer = _globalTimer
		table.insert(recordedFrames,
		{
			globalTimer = _globalTimer,
			
			pitch = memory.readword(marioObjRef + OBJ_PITCH_OFFSET),
			yaw = memory.readword(marioObjRef + OBJ_YAW_OFFSET),
			roll = memory.readword(marioObjRef + OBJ_ROLL_OFFSET),
			
			positionX = memory.readdword(marioObjRef + OBJ_POSITION_OFFSET),
			positionY = memory.readdword(marioObjRef + OBJ_POSITION_OFFSET + 4),
			positionZ = memory.readdword(marioObjRef + OBJ_POSITION_OFFSET + 8),
			
			animationIndex = memory.readword(marioObjRef + OBJ_ANIMATION_OFFSET),
			animationTimer = memory.readword(marioObjRef + OBJ_ANIMATION_TIMER_OFFSET) - 1
		})
	end
end

function Ghost.saveRecording(filepath)
	if recordingBaseFrame == nil then
		return
	end
	local file = io.open(filepath, "wb")
	writebytes32(file, recordingBaseFrame)
	writebytes32(file, #recordedFrames)
	for key, value in pairs(recordedFrames) do
		writebytes32(file, (value.globalTimer - recordingBaseFrame));
		writebytes32(file, value.positionX);
		writebytes32(file, value.positionY);
		writebytes32(file, value.positionZ);
		writebytes16(file, value.animationIndex);
		writebytes16(file, value.animationTimer);
		writebytes32(file, value.pitch);
		writebytes32(file, value.yaw);
		writebytes32(file, value.roll);
	end
	file:close()
end

--[[
	Coloured hats
	Source: https://github.com/FramePerfection/STROOP/blob/Development/STROOP/Tabs/GhostTab/ColoredHats.cs
]] 

table.includes = function(t, x)
    for k,v in pairs(t) do
        if x == v then
            return true
        end
    end
    return false
end

local function EnableColoredHats()
    local originalDisplayListPointers = {
        0x40119A0,
        0x4011A90,
        0x4011B80,
        0x4012030,
    }
    local vanillaOffset = VANILLA_BANK_04_OFFSET_US
    local bank0x04Size = 0x100000 - vanillaOffset --Rough estimate, relevant references should be in this range
    local segmentTableOffset = S_SEGMENT_TABLE_OFFSET_US
    local bank0x04Location = memory.readdword(segmentTableOffset + 0x10) -- GetInt32
    local bank0x04Offset = bank0x04Location - vanillaOffset

    for addr = bank0x04Location, bank0x04Location + bank0x04Size, 4 do
        if (memory.readdword(addr) & 0xFFFF0000) == 0x001B0000 then -- GetInt32
            local foundPointer = memory.readdword(addr + 0x14) -- GetUInt32
            if table.includes(originalDisplayListPointers, foundPointer) then
                memory.writedword(addr + 0x14, COLORED_HATS_CODE_TARGET_ADDR)
                memory.writeword(addr, 0x12A)
            end
        end
    end

    local findOutWhatToCallThis = 0x90580
    local jumpOutOfHeadAddr = (findOutWhatToCallThis + bank0x04Offset) + 0x8
    writebytes(jumpOutOfHeadAddr, {0xB8, 0, 0, 0, 0, 0, 0, 0})
    local offsetA = 0xf470c - bank0x04Location

    -- Disable low poly Mario by finding the LOD threshold values and replacing them with the maximum distance (0x7fff) as appropriate
    for addr = bank0x04Location, bank0x04Location + bank0x04Size, 4 do
        local value = memory.readdword(addr) -- GetUInt32
        if value == 0x02580640 then
            memory.writedword(addr, 0x02587fff)
        elseif value == 0x06407fff then
            memory.writedword(addr, 0x7fff7fff)
        end
    end
end

local max = math.max
local min = math.min
local function clamp(x)
    return max(0, min(255, x))
end

local function ColorToLights(RGB)
    local R1 = clamp(RGB[1])
    local G1 = clamp(RGB[2])
    local B1 = clamp(RGB[3])
    local R2 = clamp(RGB[1] // 2)
    local G2 = clamp(RGB[2] // 2)
    local B2 = clamp(RGB[3] // 2)
    return {
          R2,   G2,   B2, 0x00,   R2,   G2,   B2, 0x00,
          R1,   G1,   B1, 0x00,   R1,   G1,   B1, 0x00,
        0x28, 0x28, 0x28, 0x00, 0x00, 0x00, 0x00, 0x00,
    }
end

-- ghostIndex is the order of the ghost in RAM
local function WriteGhostColorToStream(ID, ghostIndex)
    local color = {204, 204, 204}
    if Ghosts.HatColor[ID] then
        color = Ghosts.HatColor[ID]
    end
    local lights = ColorToLights(color)
    writebytes(COLORED_HATS_LIGHTS_ADDR + ghostIndex * 0x20, lights)
end

local function SetColorForNewGhost(ID)
	if Ghosts.HatColor[ID] == nil then
    	Ghosts.HatColor[ID] = DefaultGhostColors[defaultGhostColorCounter + 1]
    	defaultGhostColorCounter = (defaultGhostColorCounter + 1) % #DefaultGhostColors
	end
end

--[[
	Ghost data handling
    Note: all data is in little-endian
    Example Data:
        header (gt,frames 4-byte unsigned integers): [4F 21 00 00] [C1 01 00 00]
    Frame 0:
        offset (4-byte unsigned integer): [00 00 00 00]
        position (x,y,z all 4-byte floats): [00 00 00 00] [00 D8 8B 45] [00 00 00 00]
        animationIndex (2-byte signed integer): [CD 00]
        animationFrame (2-byte signed integer): [3D 00]
        angle (pitch,yaw,roll all 4-byte unsigned integers): [00 00 00 00] [A3 80 00 00] [00 00 00 00]
    ...
]]

local function read_ghost_frame(file)
    return {
        offset = read_little_endian_int(file),
        position = {
            x = read_float(file),
            y = read_float(file),
            z = read_float(file)
        },
        animationIndex = read_word(file),
        animationFrame = read_word(file),
        pitch = read_little_endian_int(file),
        yaw = read_little_endian_int(file),
        roll = read_little_endian_int(file)
    }
end

function Ghost.loadGhost(filepath)
    local ghostfile = io.open(filepath, "rb")
	if ghostfile == nil then
        print("Failed to load ghost '" .. filepath .. "'")
		return nil
	end
    local ID = nextGhostID
	nextGhostID = nextGhostID + 1
    Ghosts.GlobalTimerStart[ID] = read_little_endian_int(ghostfile)
    SetColorForNewGhost(ID)
    local num_frames = read_little_endian_int(ghostfile)
    Ghosts.Data[ID] = {}
    for i = 1, num_frames do
        Ghosts.Data[ID][i] = read_ghost_frame(ghostfile)
    end
	Ghosts.Transparent[ID] = 1
	Ghosts.Offset[ID] = 0
    print("Loaded ghost '" .. filepath .. "'")
	return ID
end

function Ghost.unloadGhost(ID)
	Ghosts.GlobalTimerStart[ID] = nil
	Ghosts.Offset[ID] = nil
	Ghosts.Transparent[ID] = nil
	Ghosts.HatColor[ID] = nil
	Ghosts.Data[ID] = nil
end

--[[
	RAM Hacking
]]

-- Details: https://github.com/FramePerfection/STROOP/tree/Development/HackSources/Ghosts
local HACKS = { -- US ROM only
    [0x80408000] = {
        0x27, 0xBD, 0xFF, 0xC0, 0x3C, 0x08, 0x80, 0x36, 0x8D, 0x08, 0x11, 0x58, 0x10, 0x08, 0x00,
        0x6B, 0xAF, 0xBF, 0x00, 0x34, 0xAF, 0xB4, 0x00, 0x30, 0xAF, 0xB3, 0x00, 0x2C, 0xAF, 0xB2,
        0x00, 0x28, 0xAF, 0xB1, 0x00, 0x24, 0xAF, 0xB0, 0x00, 0x20, 0x00, 0x08, 0xA0, 0x25, 0x86,
        0x88, 0x00, 0x02, 0x31, 0x09, 0x00, 0x40, 0x15, 0x20, 0x00, 0x06, 0x35, 0x09, 0x00, 0x40,
        0xA6, 0x89, 0x00, 0x02, 0x10, 0x00, 0x00, 0x58, 0x3C, 0x11, 0x80, 0x40, 0x10, 0x00, 0x00,
        0x53, 0x36, 0x31, 0x7F, 0xF8, 0x3C, 0x13, 0x80, 0x50, 0x3C, 0x18, 0x80, 0x37, 0x34, 0x01,
        0x00, 0xBD, 0xA7, 0x01, 0x05, 0xA8, 0x37, 0x01, 0x05, 0xB8, 0xAF, 0x01, 0x05, 0x98, 0x3C,
        0x01, 0x80, 0x06, 0x24, 0x21, 0x40, 0x40, 0xAF, 0x01, 0x05, 0xB8, 0x00, 0x00, 0x80, 0x25,
        0x3C, 0x01, 0x80, 0x40, 0x34, 0x31, 0x7F, 0xF8, 0x80, 0x21, 0x7F, 0xFF, 0x10, 0x01, 0x00,
        0x44, 0x00, 0x00, 0x00, 0x00, 0x8E, 0x28, 0x00, 0x00, 0x15, 0x00, 0x00, 0x0E, 0x00, 0x00,
        0x20, 0x25, 0x26, 0x25, 0xFF, 0x9C, 0x8E, 0x86, 0x00, 0x14, 0x3C, 0x07, 0x80, 0x38, 0x34,
        0xE1, 0x5F, 0xDC, 0xAF, 0xA1, 0x00, 0x10, 0x34, 0xE1, 0x5F, 0xE4, 0xAF, 0xA1, 0x00, 0x14,
        0x0C, 0x0D, 0xEE, 0x78, 0x34, 0xE7, 0x5F, 0xD0, 0xAE, 0x22, 0x00, 0x00, 0x8E, 0x84, 0x00,
        0x0C, 0x0C, 0x0D, 0xF0, 0x11, 0x00, 0x40, 0x28, 0x25, 0x8E, 0x32, 0x00, 0x00, 0x82, 0x89,
        0x00, 0x18, 0xA2, 0x49, 0x00, 0x18, 0x8E, 0x89, 0x00, 0x38, 0xAE, 0x49, 0x00, 0x38, 0x3C,
        0x01, 0x80, 0x33, 0x8C, 0x28, 0xD5, 0xD4, 0x31, 0x08, 0x00, 0x7F, 0x00, 0x08, 0x41, 0x40,
        0x00, 0x10, 0x4B, 0x00, 0x01, 0x09, 0x40, 0x21, 0x3C, 0x01, 0x80, 0x41, 0x01, 0x01, 0x40,
        0x21, 0x25, 0x08, 0x9B, 0x00, 0x8D, 0x09, 0x00, 0x00, 0xAE, 0x49, 0x00, 0x20, 0x8D, 0x09,
        0x00, 0x04, 0xAE, 0x49, 0x00, 0x24, 0x8D, 0x09, 0x00, 0x08, 0xAE, 0x49, 0x00, 0x28, 0x8D,
        0x09, 0x00, 0x10, 0xA6, 0x49, 0x00, 0x1A, 0x8D, 0x09, 0x00, 0x14, 0xA6, 0x49, 0x00, 0x1C,
        0x8D, 0x09, 0x00, 0x18, 0xA6, 0x49, 0x00, 0x1E, 0x3C, 0x18, 0x80, 0x37, 0xAF, 0x12, 0x05,
        0x80, 0xAF, 0x13, 0x05, 0xC0, 0x85, 0x09, 0x00, 0x1C, 0xA7, 0xA9, 0x00, 0x38, 0x37, 0x04,
        0x04, 0xF8, 0xA6, 0x40, 0x00, 0x38, 0xAF, 0x00, 0x05, 0xBC, 0x0C, 0x09, 0x42, 0x6E, 0x8D,
        0x05, 0x00, 0x0C, 0x87, 0xA9, 0x00, 0x38, 0xA6, 0x49, 0x00, 0x40, 0x26, 0x73, 0x40, 0x00,
        0x26, 0x31, 0xFF, 0x98, 0x26, 0x10, 0x00, 0x01, 0x3C, 0x01, 0x80, 0x40, 0x80, 0x21, 0x7F,
        0xFF, 0x02, 0x01, 0x40, 0x2B, 0x15, 0x00, 0xFF, 0xC3, 0xA2, 0x50, 0x00, 0x60, 0x8E, 0x32,
        0x00, 0x00, 0x12, 0x40, 0x00, 0x06, 0x00, 0x12, 0x20, 0x25, 0x0C, 0x0D, 0xF0, 0x2F, 0xAE,
        0x20, 0x00, 0x00, 0x8E, 0x24, 0x00, 0x00, 0x14, 0x80, 0xFF, 0xFC, 0x26, 0x31, 0xFF, 0x98,
        0x8F, 0xBF, 0x00, 0x34, 0x8F, 0xB4, 0x00, 0x30, 0x8F, 0xB3, 0x00, 0x2C, 0x8F, 0xB2, 0x00,
        0x28, 0x8F, 0xB1, 0x00, 0x24, 0x8F, 0xB0, 0x00, 0x20, 0x03, 0xE0, 0x00, 0x08, 0x27, 0xBD,
        0x00, 0x40
    },
    [0x80277988] = {
        0x3C, 0x09, 0x80, 0x34, 0x25, 0x2A, 0xB1, 0x70, 0x3C, 0x19, 0x80, 0x33, 0x8F, 0x39, 0xDF,
        0x00, 0x3C, 0x01, 0x80, 0x36, 0x8C, 0x21, 0x11, 0x58, 0x17, 0x21, 0x00, 0x57, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    },
    [0x802770A4] = {
        0x27, 0xBD, 0xFF, 0xD0, 0xAF, 0xBF, 0x00, 0x14, 0x24, 0x01, 0x00, 0x01, 0x14, 0x81, 0x00,
        0x23, 0x00, 0x00, 0x10, 0x25, 0x00, 0xA0, 0x20, 0x25, 0x3C, 0x08, 0x80, 0x34, 0x25, 0x08,
        0xB3, 0xB0, 0x8C, 0xB8, 0x00, 0x18, 0x00, 0x18, 0xC8, 0x80, 0x03, 0x38, 0xC8, 0x21, 0x00,
        0x19, 0xC8, 0xC0, 0x03, 0x28, 0x48, 0x21, 0x3C, 0x08, 0x80, 0x33, 0x8D, 0x08, 0xDF, 0x00,
        0x3C, 0x01, 0x80, 0x36, 0x8C, 0x21, 0x11, 0x58, 0x15, 0x01, 0x00, 0x08, 0x3C, 0x18, 0x80,
        0x40, 0x85, 0x2C, 0x00, 0x08, 0x31, 0x8D, 0x01, 0x00, 0x11, 0xA0, 0x00, 0x02, 0x34, 0x05,
        0x00, 0xFF, 0x31, 0x85, 0x00, 0xFF, 0x10, 0x00, 0x00, 0x0C, 0x00, 0x00, 0x00, 0x00, 0x81,
        0x18, 0x00, 0x61, 0x13, 0x00, 0x00, 0x09, 0x34, 0x05, 0x00, 0xFF, 0x34, 0x05, 0x00, 0x7F,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x09,
        0xDB, 0xE4, 0x00, 0x00, 0x00, 0x00, 0x8F, 0xBF, 0x00, 0x14, 0x27, 0xBD, 0x00, 0x30, 0x03,
        0xE0, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00
    },
    [0x802776D8] = {
        0x27, 0xBD, 0xFF, 0xF8, 0x3C, 0x19, 0x80, 0x34, 0x27, 0x39, 0xB3, 0xB0, 0x3C, 0x08, 0x80,
        0x33, 0x8D, 0x08, 0xDF, 0x00, 0x81, 0x0A, 0x00, 0x61, 0x11, 0x40, 0x00, 0x10, 0x83, 0x09,
        0x00, 0x08, 0xA4, 0xA9, 0x00, 0x1E, 0x3C, 0x01, 0x80, 0x36, 0x8C, 0x21, 0x11, 0x58, 0x11,
        0x01, 0x00, 0x0B, 0x00, 0x00, 0x00, 0x00, 0xA4, 0xAA, 0x00, 0x1E, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x10, 0x25, 0x03, 0xE0, 0x00, 0x08, 0x27, 0xBD, 0x00, 0x08
    },
    [0x8027B188] = {0x0C, 0x10, 0x20, 0x00}, -- Hooks the ghost update function into area_update_objects
    [0x8027719C] = {0x34, 0x0C, 0x00, 0x01}, -- disables low resolution Mario entirely
    -- gfx_generate_colored_hats:
    [0x80408200] = {
        0x27, 0xBD, 0xFF, 0xC0, 0xAF, 0xBF, 0x00, 0x14, 0x3C, 0x09, 0x04, 0x01, 0x35, 0x28, 0x19,
        0xA0, 0x3C, 0x01, 0x80, 0x36, 0x8C, 0x21, 0x11, 0x58, 0x3C, 0x18, 0x80, 0x33, 0x8F, 0x18,
        0xDF, 0x00, 0x13, 0x01, 0x00, 0x02, 0x00, 0x00, 0x50, 0x25, 0x83, 0x0A, 0x00, 0x60, 0x35,
        0x29, 0x19, 0x78, 0xAF, 0xA8, 0x00, 0x18, 0xAF, 0xA9, 0x00, 0x1C, 0xAF, 0xAA, 0x00, 0x20,
        0x24, 0x01, 0x00, 0x01, 0x14, 0x24, 0x00, 0x1B, 0x34, 0x04, 0x00, 0x38, 0x0C, 0x09, 0xE3,
        0xCB, 0x00, 0x00, 0x00, 0x00, 0x3C, 0x0C, 0x06, 0x00, 0xAC, 0x4C, 0x00, 0x10, 0x8F, 0xA1,
        0x00, 0x18, 0xAC, 0x41, 0x00, 0x14, 0x3C, 0x01, 0x03, 0x88, 0x34, 0x21, 0x00, 0x10, 0xAC,
        0x41, 0x00, 0x18, 0xAC, 0x41, 0x00, 0x00, 0x3C, 0x08, 0x80, 0x40, 0x35, 0x08, 0x83, 0x00,
        0x8F, 0xA9, 0x00, 0x20, 0x00, 0x09, 0x49, 0x40, 0x01, 0x28, 0x50, 0x21, 0xAC, 0x4A, 0x00,
        0x1C, 0xAC, 0x4A, 0x00, 0x04, 0x3C, 0x01, 0x03, 0x86, 0x34, 0x21, 0x00, 0x10, 0xAC, 0x41,
        0x00, 0x20, 0xAC, 0x41, 0x00, 0x08, 0x25, 0x4B, 0x00, 0x08, 0xAC, 0x4B, 0x00, 0x24, 0xAC,
        0x4B, 0x00, 0x0C, 0xAC, 0x4C, 0x00, 0x28, 0x8F, 0xA8, 0x00, 0x1C, 0xAC, 0x48, 0x00, 0x2C,
        0x3C, 0x01, 0xB8, 0x00, 0xAC, 0x41, 0x00, 0x30, 0x8F, 0xBF, 0x00, 0x14, 0x03, 0xE0, 0x00,
        0x08, 0x27, 0xBD, 0x00, 0x40
    }
}

local function write_ghost_frame(offset, ghost, ghostidx)
    if ghost == nil then return end
    local addr = 0x80409B00
    ghostidx = ghostidx - 1
    memory.writefloat(addr + ghostidx * 0x1000 + offset * 0x20 + 0x00, ghost.position.x)
    memory.writefloat(addr + ghostidx * 0x1000 + offset * 0x20 + 0x04, ghost.position.y)
    memory.writefloat(addr + ghostidx * 0x1000 + offset * 0x20 + 0x08, ghost.position.z)
    memory.writeword(addr + ghostidx * 0x1000 + offset * 0x20 + 0x0E, ghost.animationIndex)
    memory.writedword(addr + ghostidx * 0x1000 + offset * 0x20 + 0x10, ghost.pitch)
    memory.writedword(addr + ghostidx * 0x1000 + offset * 0x20 + 0x14, ghost.yaw)
    memory.writedword(addr + ghostidx * 0x1000 + offset * 0x20 + 0x18, ghost.roll)
    memory.writeword(addr + ghostidx * 0x1000 + offset * 0x20 + 0x1C, ghost.animationFrame)
end

local function last_valid_ghost_frame(ghostdata, index)
    if index <= 0 then
        if ghostdata[0] ~= nil then
            return ghostdata[0]
        end
        return ghostdata[1]
    elseif 0 < index and index < #ghostdata then
        return ghostdata[index]
    end
    return ghostdata[#ghostdata]
end

function Ghost.updateGhosts()
    WriteGhostColorToStream(0, 0) -- write Mario's hat colour
    local globalTimer = memory.readdword(0x00B2D5D4) -- U address
	local n = 0
	for ID, _ in pairs(Ghosts.Data) do
        if #Ghosts.Data[ID] > 0 then
            n = n + 1
            for tm = 0, 0x7F do
                local offset = (tm + globalTimer) & 0x7F
                local i = globalTimer + tm - Ghosts.GlobalTimerStart[ID] - Ghosts.Offset[ID] + 1
                write_ghost_frame(offset, last_valid_ghost_frame(Ghosts.Data[ID], i+1), n)
            end
            WriteGhostColorToStream(ID, n)
            local ptr = memory.readdword(0x80407ff8 - 0x68 * (n-1)) + 0x61
            memory.writebyte(ptr, (Ghosts.Transparent[ID] == 1) and 1 or 0)
        end
	end
    memory.writebyte(0x80407FFF, n) -- number of ghosts to load
end

function Ghost.applyGhostHack()
    for addr,hck in pairs(HACKS) do
        writebytes(addr, hck)
    end

    -- clear some memory to prevent nonsensical data causing a game crash on the first ghost loop iteration
    memory.writedword(0x80407FFC, 0)
    for i = 0, 0x70 - 1, 4 do
        memory.writedword(0x80407F90 + i, 0)
    end

    EnableColoredHats()

    print("Ghost hack enabled")
end

function Ghost.setColor(ID, RGB)
    if RGB == nil then
        return
    end
	if RGB.r ~= nil then
		Ghosts.HatColor[ID] = {
			clamp(RGB.r), clamp(RGB.g), clamp(RGB.b)
		}
	elseif RGB.R ~= nil then
		Ghosts.HatColor[ID] = {
			clamp(RGB.R), clamp(RGB.G), clamp(RGB.B)
		}
	else
		Ghosts.HatColor[ID] = {
			clamp(RGB[1]), clamp(RGB[2]), clamp(RGB[3])
		}
	end
end

function Ghost.getColor(ID)
    return Ghosts.HatColor[ID]
end

function Ghost.getGhostData(ID, globaltimer)
    local i = globaltimer - Ghosts.GlobalTimerStart[ID] - Ghosts.Offset[ID] + 1
    return last_valid_ghost_frame(Ghosts.Data[ID], i+1)
end

function Ghost.getGhostDataLength(ID)
    return #Ghosts.Data[ID]
end

function Ghost.setTransparency(ID, transparent)
    print("Set transparency "..ID.." to "..(transparent and 1 or 0))
	if transparent then
		Ghosts.Transparent[ID] = 1
	else
		Ghosts.Transparent[ID] = 0
	end
end

function Ghost.getGlobalTimerOnAnimation(ID, animation, animationTimer)
	if Ghosts.Data[ID] == nil then
		return nil
	end
	for i = 1, #Ghosts.Data[ID] do
		if Ghosts.Data[ID][i].animationIndex == animation and (
			animationTimer == nil or Ghosts.Data[ID][i].animationFrame == animationTimer) then
			return Ghosts.GlobalTimerStart[ID] + i - 1
		end
	end
	return nil
end

function Ghost.setGlobalTimerOffset(ID, offset)
	Ghosts.Offset[ID] = offset
end

function Ghost.getGlobalTimerOffset(ID)
    return Ghosts.GlobalTimerStart[ID] - Ghosts.Offset[ID]
end

--[[
    create and manipulate ghost data without files
]]

-- create a ghost, you must provide at one frame of initial data
function Ghost.createGhost(ID)
    if Ghosts.GlobalTimerStart[ID] ~= nil then
        Ghost.unloadGhost(ID)
    end
    Ghosts.GlobalTimerStart[ID] = 0
    SetColorForNewGhost(ID)
    Ghosts.Data[ID] = {}
	Ghosts.Transparent[ID] = 1
	Ghosts.Offset[ID] = 0
end

-- return data for the current frame
function Ghost.getCurrentFrame()
	local marioObjRef = memory.readdword(MARIO_OBJ_ADDRESS)
    return {
        offset = memory.readdword(GLOBAL_TIMER_ADDRESS),
        position = {
            x = memory.readfloat(marioObjRef + OBJ_POSITION_OFFSET),
            y = memory.readfloat(marioObjRef + OBJ_POSITION_OFFSET + 4),
            z = memory.readfloat(marioObjRef + OBJ_POSITION_OFFSET + 8)
        },
        animationIndex = memory.readword(marioObjRef + OBJ_ANIMATION_OFFSET),
        animationFrame = memory.readword(marioObjRef + OBJ_ANIMATION_TIMER_OFFSET) - 1,
        pitch = memory.readword(marioObjRef + OBJ_PITCH_OFFSET),
        yaw = memory.readword(marioObjRef + OBJ_YAW_OFFSET),
        roll = memory.readword(marioObjRef + OBJ_ROLL_OFFSET)
    }
end

function Ghost.setGhostFrame(ID, data)
    if Ghosts.Data[ID] == nil then
        -- ghost does not exist, create it
        Ghost.createGhost(ID)
    end
    if #Ghosts.Data[ID] == 0 then
        -- first frame of data
        Ghosts.GlobalTimerStart[ID] = data.offset
        table.insert(Ghosts.Data[ID],  data)
        return
    end
    local i = data.offset - Ghosts.GlobalTimerStart[ID]
    if i < 0 then
        -- new earliest frame received, shift + fill gaps in the data
        Ghosts.GlobalTimerStart[ID] = data.offset
        for j = i, 0 do
            table.insert(Ghosts.Data[ID], 1, data)
        end
    elseif i >= #Ghosts.Data[ID] then
        -- new latest frame, fill any gaps in the data
        for j = #Ghosts.Data[ID] + 1, i do
            Ghosts.Data[ID][j] = Ghosts.Data[ID][j - 1]
        end
        Ghosts.Data[ID][i] = data
    else
        -- simply overwrite existing data 
        if i == 0 then
            i = 1
        end
        Ghosts.Data[ID][i] = data
    end
end

--[[
	track the animation changing (for syncing playback)
]]

local firstAnimation = nil
local ghostsSynchronized = false
local attemptedAnimSync = {}

emu.atloadstate(function()
	ghostsSynchronized = false
	local marioObjRef = memory.readdword(MARIO_OBJ_ADDRESS)
	firstAnimation = memory.readword(marioObjRef + OBJ_ANIMATION_OFFSET)
end)

function Ghost.autoSyncGhosts()
    if ghostsSynchronized then
		return
	end

	local marioObjRef = memory.readdword(MARIO_OBJ_ADDRESS)
	local animation = memory.readword(marioObjRef + OBJ_ANIMATION_OFFSET)
    if attemptedAnimSync[animation] then
        return -- don't needlessly recheck this animation
    end

	if ((Ghost.syncAnimation and animation == Ghost.syncAnimation) or
        (Ghost.syncAnimation == nil and animation ~= firstAnimation)) then

		local globalTimer = memory.readdword(GLOBAL_TIMER_ADDRESS)
		ghostsSynchronized = true

		for ID, _ in pairs(Ghosts.Data) do
			local f = Ghost.getGlobalTimerOnAnimation(ID, animation, 0)
            if f == nil then
                print(string.format("Could not find animation %d in Ghost #%d", animation, ID))
                attemptedAnimSync[animation] = true
                ghostsSynchronized = false
                break
            else
			    print(string.format(
                    "Syncing Ghost #%d to animation %d: gt %d -> %d (+%d)",
                    ID, animation, f, globalTimer, globalTimer - f + 1
                ))
			    Ghost.setGlobalTimerOffset(ID, globalTimer - f + 1)
            end
		end
	end
end

return Ghost
