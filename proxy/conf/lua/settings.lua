-- 设置 API（统一网关已校验 fnOS 登录态）：
--   GET  /api/settings  返回 {template}（只读，无需管理员）
--   POST /api/settings  修改美化模板 template=classic|focus|minimal|cow（需管理员：X-Trim-Isadmin 头为字符串 "true"）
local c = require "common"
local cjson = require "cjson.safe"
ngx.header["Content-Type"] = "application/json"
local method = ngx.req.get_method()

local TEMPLATES = { classic = true, focus = true, minimal = true, cow = true }

if method == "GET" then
    local cfg = c.loadjson("/config/portal.json") or {}
    local tpl = cfg.template
    if not TEMPLATES[tpl] then tpl = "classic" end
    ngx.say(cjson.encode({ ok = true, template = tpl }))
    return
end

if method == "POST" then
    -- 管理员校验：业务鉴权由应用负责（官方文档：网关只校验登录态）
    if ngx.var.http_x_trim_isadmin ~= "true" then
        ngx.status = 403
        ngx.say(cjson.encode({ ok = false, msg = "仅管理员可操作" }))
        return ngx.exit(403)
    end
    -- CSRF 纵深：跨站请求（Origin 与 Host 不同源）拒绝
    if not c.same_origin() then
        ngx.status = 403
        ngx.say(cjson.encode({ ok = false, msg = "跨站请求已拦截" }))
        return ngx.exit(403)
    end
    ngx.req.read_body()
    local args = ngx.req.get_post_args() or {}
    local tpl = args.template
    if not tpl or not TEMPLATES[tpl] then
        ngx.status = 400
        ngx.say(cjson.encode({ ok = false, msg = "无效模板（可选 classic/focus/minimal/cow）" }))
        return ngx.exit(400)
    end
    local cfg = c.loadjson("/config/portal.json") or {}
    cfg.template = tpl
    if c.writefile("/config/portal.json", cjson.encode(cfg)) then
        ngx.say(cjson.encode({ ok = true, template = tpl }))
    else
        ngx.status = 500
        ngx.say('{"ok":false,"msg":"配置写入失败"}')
    end
    return
end

ngx.status = 405
ngx.say('{"ok":false}')
