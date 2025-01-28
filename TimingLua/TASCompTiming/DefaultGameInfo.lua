--Iterates over all loaded objects
--callback is a function that will takes the address of each iterated object as an argument
function iterateObjects(callback)
	--The game stores 16 different lists of loaded objects.
	--Each root node is 0x68 bytes in size
	for i = 0, 15, 1 do 
		local objectList = 0x8033cbe0 + 0x68 * i
	
		local currentObject = memory.readdword(objectList + 0x60) --objectList->next
		if currentObject ~= 0 then --Do nothing if list is unused
			--Iterate until we reach the root node again, since these lists are cyclic
			while currentObject ~= objectList do
				callback(currentObject)
				currentObject = memory.readdword(currentObject + 0x60) --currrentObject->next
			end
		end
	end
end
function action() return Memory.read("action") end
function previous_action() return Memory.read("previous_action") end
function animation() return Memory.read("animation") end
function mario_x() return Memory.read("mario_x") end
function mario_y() return Memory.read("mario_y") end
function mario_z() return Memory.read("mario_z") end
function mario_h_speed() return Memory.read("mario_h_speed") end
function mario_wall_tri() return Memory.read("mario_wall_tri") end
function mario_floor_tri() return Memory.read("mario_floor_tri") end
function mario_interact_object() return Memory.read("mario_interact_object") end
local base_coin_count = Memory.read("mario_coin_count")
local base_red_coin_count = Memory.read("mario_red_coin_count")
local base_life_count = Memory.read("mario_life_count")
function coin_count()
    return math.abs(Memory.read("mario_coin_count") - base_coin_count)
end
function red_coin_count()
    return math.abs(Memory.read("mario_red_coin_count") - base_red_coin_count)
end
-- mario_blue_coin_count
function life_count()
    return math.abs(Memory.read("mario_life_count") - base_life_count)
end

local action_counts = {}
local previous_frame_action = nil
function action_count(action_name, update_previous_action)
    local current_action = action()
    if current_action == action_name and previous_frame_action ~= current_action then
        -- is it necessary to handle it like this?
        if action_counts[action_name] ~= nil then
            action_counts[action_name] = action_counts[action_name] + 1
        else
            action_counts[action_name] = 1
        end
    end
    -- Only update action once each frame (no matter
    -- how many times this function gets called)
    if update_previous_action then
        previous_frame_action = current_action
    end
    if action_counts[action_name] ~= nil then
        return action_counts[action_name]
    else
        return 0
    end
end
-- TODO: account for buffered A starts
local a_press_total = 0
function a_press_count()
    if memory.readbyte(0x00B3AFA2) & 0x80 then
        a_press_total = a_press_total + 1
    end
    return a_press_count
end
function purple_switch_activated()
    iterateObjects(function(obj)
        -- Find the purple switch object by checking for an object with its behavior script address
        if memory.readdword(obj + 0x20C) == Memory.BehaviorScriptAddress["purple_switch"] then
            -- Check for Action == 2 (active)
            if memory.readdword(obj + 0x14C) == 2 then
                purple_switch_active = true
            else
                purple_switch_active = false
            end
        end
        return false
    end)
    return purple_switch_active
end
local broken_yellow_box_count = 0
local broken_wing_box_count = 0
local broken_metal_box_count = 0
local broken_vanish_box_count = 0
local function box_broken_count(counter, subtype)
    -- Check if Mario is interacting with an item box
    if memory.readdword(Memory.read("mario_interact_object") + 0x20C)
       == Memory.BehaviorScriptAddress["item_box"] then
        iterateObjects(function(obj)
            if memory.readdword(obj + 0x20C) == 0x800ED3D0 then
                if memory.readdword(obj + 0x144) == subtype
                   and memory.readdword(obj + 0x14C) == 4 then
                    counter = counter + 1
                end
            end
        end)
    end
    return counter
end
-- Separate because there are multiple subtypes for yellow boxes
function yellow_box_broken_count()
    if memory.readdword(Memory.read("mario_interact_object") + 0x20C)
       == Memory.BehaviorScriptAddress["item_box"] then
        iterateObjects(function(obj)
            if memory.readdword(obj + 0x20C) == 0x800ED3D0 then
                if (memory.readdword(obj + 0x144) == 3 or
                    memory.readdword(obj + 0x144) == 5 or
                    memory.readdword(obj + 0x144) == 6 or
                    memory.readdword(obj + 0x144) == 7 or
                    memory.readdword(obj + 0x144) == 9) and
                    memory.readdword(obj + 0x14C) == 4 then
                        broken_yellow_box_count = broken_yellow_box_count + 1
                end
            end
        end)
    end
    return broken_yellow_box_count
end
function wing_box_broken_count()
    return box_broken_count(broken_wing_box_count, 0)
end
function metal_box_broken_count()
    return box_broken_count(broken_metal_box_count, 1)
end
function vanish_box_broken_count()
    return box_broken_count(broken_vanish_box_count, 2)
end