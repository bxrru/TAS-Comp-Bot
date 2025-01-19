local full_fadeout_delay = 19
local warp_active = 0
function full_black_fadeout()
    warp_active = Memory.read("transition_type")
    if warp_active ~= 0 then
        if full_fadeout_delay == 0 then
            -- Reset delay
            full_fadeout_delay = 19
            return true
        end
        if memory.readbyte(Memory.MEMORY["transition_type"].address + 1) == 0xB then
            full_fadeout_delay = full_fadeout_delay - 1
        end
    end
    return false
end
function first_visible_frame()
    if Memory.read("action") == "stop teleporting" then return true end
    return false
end