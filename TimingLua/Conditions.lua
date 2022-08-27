function NewStats()
	return {
		startYellowCoins = 0
		--Stats that need to be tracked to validate a run, such as coin counts, performed actions etc.
	}
end

function ResetStats()
	Stats = NewStats()
end

Stats = NewStats()

--"Stage Index" in STROOP's in "Misc" tab 
COURSE_NUMBER = 6

ACT_PULLING_DOOR = 0x00001320
ACT_PUSHING_DOOR = 0x00001321

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

function DQ(reason)
	Time.dq_reason = reason
	ResetStats()
end

function DQOnExitCourse()
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

function CountYellowCoins()
	local coins = 0
	iterateObjects(function(obj)
		local behavior = memory.readdword(obj + 0x20C)
		if behavior == 0x800EBA9C then coins = coins + 1 end
	end)
	return coins
end

function Conditions.startCondition()
	local action = Memory.read("action")
	print(action)
	if action ~= "sleeping" and action ~= "waking up" then
		Stats.startYellowCoins = CountYellowCoins()
		return true
	end
	
	if DQOnExitCourse() then
		return false
	end
	
	return false
end

function Conditions.endCondition()
	if DQOnExitCourse() then return false end
	
	local action = memory.readdword(0x8033B17C)
	
	print(string.format("%x", action))
	if (action == ACT_PULLING_DOOR or action == ACT_PUSHING_DOOR) then
		local numCoinsCollected = Stats.startYellowCoins - CountYellowCoins()
		if numCoinsCollected < 6 then
			DQ("Collected only " .. numCoinsCollected .. " coins.")
			return false
		end
		ResetStats()
		return true
	end
	
	return false
end