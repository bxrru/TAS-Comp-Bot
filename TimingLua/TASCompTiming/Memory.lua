Memory = {
	MEMORY = {
		["action"] = {address = 0x00B3B17C, type = "uint", value = function(v) return Actions.getKey(v) end},
		["action_timer"] = {address = 0x00B3B18A, type = "short", value = function(v) return v end},
		["previous_action"] = {address = 0x00B3B180, type = "uint", value = function(v) return Actions.getKey(v) end},
		["animation"] = {address = 0x00B4BFE0, type = "short", value = function(v) return Animations.getKey(v) end},
		["animation_timer"] = {address = 0x00B4BFE8, type = "short", value = function(v) return v end},
		["transition_state"] = {address = 0x00B3B238, type = "short", value = function(v) return v end},
		["transition_type"] = {address = 0x00B3BAB0, type = "short", value = function(v) return v end},
		["transition_progress"] = {address = 0x00B30EC0, type = "byte", value = function(v) return v end},
		["transition_black_fade"] = {address = 0x00B3B23C, type = "short", value = function(v) return v end},
		["transition_white_fade"] = {address = 0x00B8B8A4, type = "short", value = function(v) return v end},
		["transition_shrinking"] = {address = 0x00B3B254, type = "short", value = function(v) return v end},
		["mario_x"] = {address = 0x00B3B1AC, type = "float", value = function(v) return v end},
		["mario_y"] = {address = 0x00B3B1B0, type = "float", value = function(v) return v end},
		["mario_z"] = {address = 0x00B3B1B4, type = "float", value = function(v) return v end},
		["mario_x_speed"] = {address = 0x00B3B1B8, type = "float", value = function(v) return v end},
		["mario_y_speed"] = {address = 0x00B3B1BC, type = "float", value = function(v) return v end},
		["mario_z_speed"] = {address = 0x00B3B1C0, type = "float", value = function(v) return v end},
		["mario_h_speed"] = {address = 0x00B3B1C4, type = "float", value = function(v) return v end},
		["mario_floor_tri"] = {address = 0x00B3B1D8, type = "uint", value = function(v) return v end},
		["mario_interact_object"] = {address = 0x8033B1E8, type = "uint", value = function(v) return v end}
	}
}

function Memory.read(str)
	if Memory.MEMORY[str].type == "uint" then
		return Memory.MEMORY[str].value(memory.readdword(Memory.MEMORY[str].address))
	elseif Memory.MEMORY[str].type == "int" then
			return Memory.MEMORY[str].value(memory.readdwordsigned(Memory.MEMORY[str].address))
	elseif Memory.MEMORY[str].type == "ushort" then
			return Memory.MEMORY[str].value(memory.readword(Memory.MEMORY[str].address))
	elseif Memory.MEMORY[str].type == "short" then
		return Memory.MEMORY[str].value(memory.readwordsigned(Memory.MEMORY[str].address))
	elseif Memory.MEMORY[str].type == "byte" then
		return Memory.MEMORY[str].value(memory.readbyte(Memory.MEMORY[str].address))
	elseif Memory.MEMORY[str].type == "float" then
		return Memory.MEMORY[str].value(memory.readfloat(Memory.MEMORY[str].address))
	else --TOD0 SIZE 1
		return 0
	end
end
