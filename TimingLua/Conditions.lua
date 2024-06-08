function NewStats()
	return {
		--Stats that need to be tracked to validate a run, such as coin counts, performed actions etc.
	}
end

function ResetStats()
	Stats = NewStats()
end

Stats = NewStats()

--"Stage Index" in STROOP's in "Misc" tab 
COURSE_NUMBER = 4 --Big Boos Haunt

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

function CountRedCoins()
	local coins = 0
	iterateObjects(function(obj)
		local behavior = memory.readdword(obj + 0x20C)
		if behavior == 0x800EF02C then -- red coin
			coins = coins + 1
		end
	end)
	return coins
end

function Conditions.startCondition()
	local action = Memory.read("action")
	if action ~= "sleeping" and action ~= "waking up" then
		return true
	else
		if memory.readword(0x8038EEE0) ~= 26770 then
			DQ("RNG value was hacked.")
			return false;
		end
		if memory.readword(0x8033B218) ~= 50 then
			DQ("Coin count was hacked.")
			return false;
		end
	end
	
	if DQOnExitCourse() then
		return false
	end
	
	return false
end

function Conditions.endCondition()
	if DQOnExitCourse() then return false end
	
	local action = Memory.read("action")
	if action == "star dance ground (doesn't exit)" and memory.readbyte(0x80332609) & 0x04 ~= 0 then	--X-Cam displayed
		if memory.readbyte(0x8033161C) & 0x02 == 0 then --Not actually fixed cam
			ResetStats()
			return true
		end
	end	
	return false
end