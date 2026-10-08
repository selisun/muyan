-- 登录页模板下发（公开，无需会话）：只输出模板名一个单词，不含任何敏感信息
--   GET /static/lhg-template.txt -> "classic" | "focus" | "minimal" | "cow"
local c = require "common"
local cfg = c.loadjson("/config/portal.json") or {}
local tpl = cfg.template
if tpl ~= "classic" and tpl ~= "focus" and tpl ~= "minimal" and tpl ~= "cow" then
    tpl = "classic"
end
ngx.header["Content-Type"] = "text/plain"
ngx.header["Cache-Control"] = "no-cache"
ngx.say(tpl)
