State = {
		currentState = 0,
		m64 = {
			m64Path = "",
			m64Name = "",
			fileSize = 0,
			rawInput = nil,
			frameCount = 0,
			rerecords = 0
		},

		fileCounter = 0,

		SETUP = 0,
		RUN_M64 = 1,
		FINISHED = 2,
		LUAEND = 3,
		WAIT_ONCE = 4
}

function State.init()
		State.currentState = 0
		State.counter = 0
		print(State.m64.m64Name)
		State.m64.stName = Utils.stringsplit(State.m64.m64Name, "%.")[1] .. ".st"
end
