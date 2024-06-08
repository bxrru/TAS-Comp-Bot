local f = io.open(debug.getinfo(1).source:sub(2):match("(.*\\)").."\\maxtimelimit.txt", "r")
local MAX_WAIT_TIME = f:read("*n") or 9000
io.close(f)

print("Max wait time: " .. MAX_WAIT_TIME .. "f")
local timer = 0

function autoexit()
    timer = timer + 1
    if timer == MAX_WAIT_TIME then
        print("max wait time reached")
        local f = io.open("TLE.txt", "w")
        io.close(f)
        os.exit() -- force stop Mupen
    end
end

emu.atinput(autoexit)
