function DQ(reason)
    Time.dq_reason = reason
end
function DQonExitCourse()
	local totalObjectCount = 0	
	iterateObjects(function(obj)
		totalObjectCount = totalObjectCount + 1
	end)
	
	if totalObjectCount == 0 or memory.readword(0x8032DDF8) ~= COURSE_NUMBER then
		DQ("Mario left the course")
		return true
	end
	return false
end
function DQonBLJ()
    local action = Memory.read("action")
    local hspd = Memory.read("mario_h_speed")
    if hspd < -16.00 and (action == "long jump landing (1/2)"
       or action == "long jump landing (2/2)" or action == "long jump") then
        DQ("Mario BLJ'd")
        return true
    end
    return false
end
function checkCupFloor()
    -- Surface type is a short stored at offset 0x0 from a triangle's address
    local current_floor_type = memory.readword(Memory.read("mario_floor_tri") + 0x0)
    -- are there more relevant c-up-able surface types?
    if current_floor_type == 0x13 then
        return true
    end
    return false
end
function DQonCUpSlide()
    local cupEnabled = memory.readbyte(0x80332609) & 0x10
    local action = Memory.read("action")
    if action == "skidding" and checkCupFloor() and cupEnabled then
        DQ("Mario C-Up slid")
        return true
    end
    return false
end
function DQonGotoPU()
    if Memory.read("mario_x") > 32768
       or Memory.read("mario_x") < -32768
       or Memory.read("mario_z") > 32768
       or Memory.read("mario_z") < -32768
       or Memory.read("mario_y") > 32768
       or Memory.read("mario_y") < -32768 then
        DQ("Mario went to a PU")
        return true
    end
    return false
end
function DQonAction(action, custom_message)
    if Memory.read("action") == action then
        if custom_message then
            DQ(custom_message)
        else
            DQ("Mario performed banned action \"" .. action .. "\"")
        end
        return true
    end
    return false
end
function DQonUseWarp()
    return DQonAction("start teleporting", "Mario used a warp")
end
function DQonUseShell()
    return DQonAction("shell riding on ground", "Mario rode a shell")
           or DQonAction("shell riding jump", "Mario rode a shell")
           or DQonAction("shell riding freefall", "Mario rode a shell")
           or DQonAction("water shell swimming", "Mario rode a shell")
end
function DQonUseCannon()
    return DQonAction("cannon shot", "Mario used a cannon")
end
local last_y_position = -99999
function DQonDownwarp()
    local current_y_position = Memory.read("mario_y")
    local result = false
    -- TODO: figure out a much less vibes-based test for this
    if last_y_position - current_y_position > 500 then
        result = true
        DQ("Mario downwarped")
    end
    last_y_position = current_y_position
    return result
end