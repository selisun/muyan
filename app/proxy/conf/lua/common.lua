-- 公共工具：文件读写、JSON 解析
local cjson = require "cjson.safe"

local _M = {}

function _M.readfile(p)
    local f = io.open(p, "r")
    if not f then return nil end
    local d = f:read("*a")
    f:close()
    return d
end

function _M.writefile(p, d)
    local f = io.open(p, "w")
    if not f then return false end
    f:write(d)
    f:close()
    return true
end

function _M.loadjson(p)
    local d = _M.readfile(p)
    if not d then return nil end
    return cjson.decode(d)
end

-- CSRF 纵深：校验请求 Origin 与 Host 同源。
-- 浏览器跨站请求会带 Origin（同源请求的 Origin 与 Host 一致，跨站则不一致）；
-- 非浏览器客户端（curl 等）不带 Origin，直接放行，避免误伤脚本调用。
function _M.same_origin()
    local origin = ngx.var.http_origin
    if not origin or origin == "" then return true end
    local ohost = origin:match("^%a[%w%.%-]*://([^/]+)")
    if not ohost then return false end
    ohost = ohost:gsub(":%d+$", "")
    local host = (ngx.var.http_host or ""):gsub(":%d+$", "")
    if host == "" then return true end
    return ohost == host
end

return _M
