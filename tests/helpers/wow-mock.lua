-- Mock WoW minimal pour les tests de livraison BOT-WOW (Lua 5.1).
--
-- OBJET : charger une TOC et ses fichiers Lua hors jeu, dans l'ordre declare,
-- pour verrer le CONTRAT d'installation : chargement sans erreur, evenements,
-- commandes slash, variables sauvegardees, capture d'erreurs.
--
-- CE MOCK N'EST PAS le client. Il n'invente aucun resultat : il reproduit les
-- API utilisees par les fichiers livres (creation de frames, enregistrement
-- d'evenements, gestionnaire d'erreurs, SlashCmdList) et laisse le code livre
-- decider de ce qu'il fait. Les fichiers charges dans les tests sont des
-- FIXTURES ORIGINALES qui reproduisent les contrats observés dans le runtime
-- source ; les fixtures ne sont pas une copie du runtime (aucun droit de
-- redistribution n'est documents pour ce dernier).
--
-- API fournies :
--   UIParent, CreateFrame, DEFAULT_CHAT_FRAME, SlashCmdList, GetAddOnMetadata,
--   GetTime, time, date, wipe, geterrorhandler, seterrorhandler,
--   __FireWoWEvent(event, ...), __WoWMock (etat interne lisible par les tests).

UIParent = { __isUIParent = true }

-- Objet « permissif » : toute methode inconnue est un no-op qui renvoie nil.
-- C'est le comportement souhaite : le code livre teste l'existence d'une API
-- avant de l'utiliser, et une API absente du mock ne doit PAS faire echouer
-- le chargement.
local function permissive(name)
  local obj = {}
  obj.__name = name
  obj.__methods = {}
  local mt = {}
  mt.__index = function(t, k)
    if k == '__name' then return rawget(t, '__name') end
    return function(...) return nil end
  end
  mt.__newindex = function(t, k, v) rawset(t, k, v) end
  return setmetatable(obj, mt)
end

__WoWMock = {
  frames = {},        -- frames creees, par nom
  events = {},        -- evenements enregistres : { frame =, event = }
  addons = {},        -- metadata lues par TOC, par nom d addon
  errorHandler = nil, -- gestionnaire d'erreurs courant (chaine)
}

function CreateFrame(frameType, name, parent, template)
  local f = permissive(name or '<anonymous>')
  f.__type = frameType
  f.__scripts = {}
  f.SetScript = function(self, script, handler)
    f.__scripts[script] = handler
    return nil
  end
  f.GetScript = function(self, script) return f.__scripts[script] end
  f.RegisterEvent = function(self, event)
    table.insert(__WoWMock.events, { frame = f, event = event })
  end
  f.UnregisterEvent = function(self, event)
    for i = #__WoWMock.events, 1, -1 do
      local e = __WoWMock.events[i]
      if e.frame == f and e.event == event then table.remove(__WoWMock.events, i) end
    end
  end
  f.UnregisterAllEvents = function(self)
    for i = #__WoWMock.events, 1, -1 do
      if __WoWMock.events[i].frame == f then table.remove(__WoWMock.events, i) end
    end
  end
  -- Contrats WoW : les frames créent des SOUS-OBJETS réels (FontString,
  -- Texture, AnimationGroup) — jamais nil. Sans eux, le code livré qui indexe
  -- le résultat (ex : CasinobabeFishing.lua:1180, title:SetPoint) échoue au
  -- chargement alors que le client le charge.
  f.CreateFontString = function(self, fname, layer, inheritsFrom)
    local fs = permissive(fname or '<fontstring>')
    fs.__type = 'FontString'
    return fs
  end
  f.CreateTexture = function(self, tname, layer, ...)
    local t = permissive(tname or '<texture>')
    t.__type = 'Texture'
    return t
  end
  f.CreateAnimationGroup = function(self, gname)
    local g = permissive(gname or '<animationgroup>')
    g.__type = 'AnimationGroup'
    return g
  end
  if name then __WoWMock.frames[name] = f end
  return f
end

DEFAULT_CHAT_FRAME = permissive('DEFAULT_CHAT_FRAME')
ChatFrame1 = DEFAULT_CHAT_FRAME
-- Canal AddMessage RÉEL : le code livré journalise via Log() ->
-- DEFAULT_CHAT_FRAME:AddMessage. Le test lit __WoWMock.chatLog pour
-- diagnostiquer (ex : message d'erreur d'init de CasinobabeFishing.lua).
__WoWMock.chatLog = {}
DEFAULT_CHAT_FRAME.AddMessage = function(self, msg)
  table.insert(__WoWMock.chatLog, tostring(msg))
  return nil
end

-- WoW fournit ces tables ; sans elles, indexer `nil` fait echouer le chargement.
SlashCmdList = {}

-- METADONNEES : le client lit les lignes `## Cle: valeur` de la TOC qu'il a
-- chargee. `__WoWMockLoadAddOn` reproduit cette lecture (appelee par les tests
-- avec le texte REEL de la TOC produite par le builder), pour qu'un fichier
-- Lua qui se cale sur la version declaree soit exerce contre la vraie valeur.
function __WoWMockLoadAddOn(name, toc)
  local meta = {}
  for line in tostring(toc or ''):gmatch('[^\r\n]+') do
    local k, v = line:match('^%s*##%s*([%w_]+)%s*:%s*(.-)%s*$')
    if k then meta[k:lower()] = v end
  end
  __WoWMock.addons[name] = meta
  return meta
end

function GetAddOnMetadata(name, key)
  local meta = __WoWMock.addons[name]
  if not meta or key == nil then return nil end
  return meta[key:lower()]
end
function GetTime() return time() end
function IsAddOnLoaded() return true end
function wipe(t) for k in pairs(t) do t[k] = nil end return t end

-- WoW expose time()/date() en global ; en Lua 5.1 standard elles vivent dans
-- os.* : on les publie comme le client. Le code livre les appelle sans garde
-- (LiveErrorCapture.lua : tostring(time()) dans Capture).
time = os and os.time or function() return 0 end
date = os and os.date or function() return '' end

-- Chaine de gestionnaires d'erreurs, comme le client.
function geterrorhandler()
  return __WoWMock.errorHandler
end

function seterrorhandler(handler)
  local previous = __WoWMock.errorHandler
  __WoWMock.errorHandler = handler
  return previous
end

-- Declenche un evenement sur toutes les frames qui l'ont enregistre.
function __FireWoWEvent(event, ...)
  local fired = 0
  for _, e in ipairs(__WoWMock.events) do
    if e.event == event then
      local handler = e.frame.GetScript and e.frame.GetScript(e.frame, 'OnEvent')
      if type(handler) == 'function' then
        local ok, err = pcall(handler, e.frame, event, ...)
        if not ok then
          -- Comme le client : une erreur dans un gestionnaire d'evenement passe
          -- par le gestionnaire d'erreurs courant.
          local global = geterrorhandler()
          if global then pcall(global, err) end
        end
        fired = fired + 1
      end
    end
  end
  return fired
end
