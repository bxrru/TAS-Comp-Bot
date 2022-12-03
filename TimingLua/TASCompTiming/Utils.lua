Utils = {

}

function Utils.contains(val, tab)
    for index, value in ipairs(tab) do
        if value == val then
            return true
        end
    end
    return false
end

function Utils.stringsplit(str, sep)
  local t = {}
  for s in string.gmatch(str, "([^"..sep.."]+)") do
    table.insert(t, s)
  end
  return t
end
