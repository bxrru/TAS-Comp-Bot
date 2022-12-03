local f = io.open(debug.getinfo(1).source:sub(2):match("(.*\\)").."\\maxtimelimit.txt", "r")
local MAX_WAIT_TIME = f:read("*n")
io.close(f)
local timer = 0
local last_frame = -1

function autoexit()
    if emu.samplecount() ~= last_frame then
        timer = timer + 1
    end
    last_frame = emu.samplecount()
    if timer == MAX_WAIT_TIME then
        local f = io.open("TLE.txt", "w")
        io.close(f)
        --os.exit() -- force stop Mupen
    end
end

emu.atinput(autoexit)
