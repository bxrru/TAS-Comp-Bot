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
local prev_interact_obj = 0x00000000
local box_broken_counts = {
    wing   = 0,
    metal  = 0,
    vanish = 0,
    yellow = 0,
}
local function subtype_to_name(subtype)
    if subtype == 0 then
        return "wing"
    elseif subtype == 1 then
        return "metal"
    elseif subtype == 2 then
        return "vanish"
    else
        return "yellow"
    end
end
function wing_box_broken_count()
    return box_broken_counts["wing"]
end
function metal_box_broken_count()
    return box_broken_counts["metal"]
end
function vanish_box_broken_count()
    return box_broken_counts["vanish"]
end
function yellow_box_broken_count()
    return box_broken_counts["yellow"]
end
function update_box_broken_counts()
    local obj = Memory.read("mario_interact_object")
    if obj == prev_interact_obj then
        return
    end
    -- Check if Mario is interacting with an item box
    if memory.readdword(obj + 0x20C) == Memory.BehaviorScriptAddress["item_box"] then
        -- Update the wing, metal, and vanish cap box broken counts
        for i = 0, 2 do
            if memory.readdword(obj + 0x144) == i then
                box_broken_counts[subtype_to_name(i)]
                    = box_broken_counts[subtype_to_name(i)] + 1
                print(subtype_to_name(i).." broken: "..box_broken_counts[subtype_to_name(i)])
            end
        end
        -- Update the yellow box broken count (separate because there are multiple subtypes for yellow boxes)
        if (memory.readdword(obj + 0x144) == 3 or
            memory.readdword(obj + 0x144) == 5 or
            memory.readdword(obj + 0x144) == 6 or
            memory.readdword(obj + 0x144) == 7 or
            memory.readdword(obj + 0x144) == 9) and
            memory.readdword(obj + 0x14C) == 4 then
                box_broken_counts["yellow"] = box_broken_counts["yellow"] + 1
        end
    end
    prev_interact_obj = obj
end