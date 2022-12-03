Conditions = {}
Program = {}

function Program.checkCondition(conditions)
  -- If conditions are in array, check every condition as an OR
  if (#conditions > 0) then
    for i, condition in ipairs(conditions) do
      if Program.checkCondition(condition) then
        return true
      end
    end
    return false
  else
    for k, v in pairs(conditions) do
      value = Memory.read(k)
      if (type(v) == "table") then
        if not Utils.contains(value, v) then
          return false
        end
      elseif value ~= v then return false end
    end
    return true
  end
end

function Program.checkStartCondition()
  return Conditions.startCondition == nil or Conditions.startCondition()
end

function Program.checkEndCondition()
  return Conditions.endCondition == nil or Conditions.endCondition()
end

function Program.checkDQCondition()
	if Time.dq_reason ~= "M64 finished early" then return true end
end

function Program.writeResult(result)
	print(result)
	local file = io.open(File.RESULT_FILE, "w")
	file:write(result)
	file:close()
	os.exit(0)
end

function Program.main()
  if State.currentState == State.SETUP then
    State.init()
    Time.init()
	if emu.samplecount() > 0 then
		State.currentState = State.WAIT_ONCE
	end
  elseif State.currentState == State.WAIT_ONCE then
	State.currentState = State.RUN_M64
	emu.atloadstate(function() 
	  Program.writeResult("DQ: M64 file stopped playing")
	  end)
  elseif State.currentState == State.RUN_M64 then
    if Time.currentState == Time.State.FINISHED then
      State.currentState = State.FINISHED
    end
	print(emu.samplecount() .. "/" .. State.m64.frameCount)
    if emu.samplecount() >= State.m64.frameCount - 1 then
      State.currentState = State.FINISHED
	  Program.writeResult("DQ: M64 file stopped playing")
    end
    if Time.currentState == Time.State.PENDING and Program.checkStartCondition() then
      Time.currentState = Time.State.TIMING
      Time.start = emu.inputcount()
      print("Start timing")
    end
    if Time.currentState == Time.State.TIMING and Program.checkEndCondition() then
      Time.currentState = Time.State.FINISHED
      Time.finish = emu.inputcount()
      print("Finish timing")
	  Program.writeResult("Time: " .. (Time.finish - Time.start))
    end
    if Time.currentState ~= Time.State.FINISHED and Program.checkDQCondition() then
      State.currentState = State.FINISHED
	  Program.writeResult("DQ: " .. Time.dq_reason)
    end
  elseif State.currentState == State.FINISHED then
    currentEntry = {
      filename = State.m64.m64Name,
      rerecords = State.m64.rerecords,
      time = 9999,
      isDQ = true,
      DQreason = Time.dq_reason
    }
    if Time.currentState == Time.State.FINISHED then
      currentEntry.isDQ = false
      currentEntry.time = Time.total()
    end
      State.currentState = State.LUAEND
  end
end
