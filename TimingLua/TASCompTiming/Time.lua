Time = {
	currentState = 0,
	start = 0,
	finish = 0,
	dq_reason = "",
	total = function()
		return math.floor((Time.finish - Time.start) * 10 / 3 + 0.5) / 100
	end,
	State = {
		PENDING = 0,
		TIMING = 1,
		FINISHED = 2
	}
}

function Time.init()
	Time.currentState = 0
	Time.start = 0
	Time.finish = 0
	Time.dq_reason = "M64 finished early"
end
