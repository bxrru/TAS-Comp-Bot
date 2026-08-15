--[[
    This script looks for "./ghostlist.txt" which is formatted as follows:
    line 1: "1" or "true" will set all the ghosts as transparent
    line 2: "#" or '' or "nosync" to determine what anim to sync the ghosts
    line 3: r g b r g b ... list of numbers
      this is for the colours of the ghosts. It can be an empty list
      if less than 3 numbers are provided, it will be ignored
    lines 4+: file/path/to/tas.ghost
]]

PATH = debug.getinfo(1).source:sub(2):match("(.*\\)")
dofile(PATH .. "Ghost.lua")
TRANSPARENT = nil
GHOSTCOLORS = nil
SYNCANIMATION = nil

local function clamp(x)
    return math.max(0, math.min(255, x))
end

local function checkNoSync(option)
    return (
        option == "NOSYNC" or option == "nosync" or
        option == "NONE" or option == "none"
    )
end

for line in io.lines(PATH.."ghostlist.txt") do
    print(line)
    if TRANSPARENT == nil then
        TRANSPARENT = (line == "1" or line == "true")
    elseif SYNCANIMATION == nil then
        if not checkNoSync(line) then
            if line ~= '' then
                Ghost.syncAnimation = tonumber(line)
            end
            emu.atinput(Ghost.autoSyncGhosts)
        end
        SYNCANIMATION = true
    elseif GHOSTCOLORS == nil then
        GHOSTCOLORS = {}
        local color = {}
        for n in line:gmatch("([^ ]+)") do -- space separated numbers
            color[#color + 1] = tonumber(n) or 0 -- default to 0
            if #color == 3 then
                GHOSTCOLORS[#GHOSTCOLORS + 1] = {
                    clamp(color[1]), clamp(color[2]), clamp(color[3])
                }
                color = {}
            end
        end
    else
        local ID = Ghost.loadGhost(line)
        Ghost.setTransparency(ID, TRANSPARENT)
        if GHOSTCOLORS[ID] ~= nil then
            Ghost.setColor(ID, GHOSTCOLORS[ID])
        end
    end
end

emu.atloadstate(Ghost.applyGhostHack)
emu.atinput(Ghost.updateGhosts)
