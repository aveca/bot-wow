-- BOT-WOW Notes
-- Official API only: C_Map position of the player, saved locally.
-- Does not cast spells, click, move the character, or capture the screen.
-- If the client rejects the Interface line in the .toc, change that number
-- to the one your client prints. Do not add automation to make it load.

local ADDON = "BotWowNotes"
BotWowNotesDB = BotWowNotesDB or { spots = {} }

local function point()
  if not C_Map or not C_Map.GetBestMapForUnit or not C_Map.GetPlayerMapPosition then
    return nil
  end
  local map = C_Map.GetBestMapForUnit("player")
  if not map then return nil end
  local pos = C_Map.GetPlayerMapPosition(map, "player")
  if not pos or not pos.GetXY then return nil end
  local x, y = pos:GetXY()
  if not x or not y then return nil end
  return map, x, y
end

local function printMsg(text)
  print("|cff46e6ffBOT-WOW|r " .. text)
end

SLASH_BOTWOWNOTE1 = "/bwnote"
SlashCmdList["BOTWOWNOTE"] = function(msg)
  local action, rest = msg:match("^(%S*)%s*(.*)$")
  action = (action or ""):lower()
  if action == "add" and rest ~= "" then
    local map, x, y = point()
    if not map then
      printMsg("No player position from C_Map. Nothing was saved.")
      return
    end
    table.insert(BotWowNotesDB.spots, { name = rest, map = map, x = x, y = y })
    printMsg("Saved " .. rest .. " (" .. string.format("%.3f, %.3f", x, y) .. ").")
  elseif action == "list" then
    if #BotWowNotesDB.spots == 0 then
      printMsg("No spots yet.")
      return
    end
    for i, spot in ipairs(BotWowNotesDB.spots) do
      printMsg(i .. ". " .. spot.name .. " map " .. tostring(spot.map) .. " " .. string.format("%.3f, %.3f", spot.x or 0, spot.y or 0))
    end
  elseif action == "clear" then
    BotWowNotesDB.spots = {}
    printMsg("Cleared.")
  else
    printMsg("/bwnote add Name | /bwnote list | /bwnote clear")
  end
end
