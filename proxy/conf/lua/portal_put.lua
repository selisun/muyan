-- 门户上传接口：PUT body 直接覆盖背景图（替代原 WebDAV dav_methods 方案）
-- 管理员校验：统一网关注入 X-Trim-Isadmin 头（官方文档：字符串 "true"/"false"，严格比较）
-- 上传校验：限制 body 大小（防占满 var 目录）、校验 Origin 同源（CSRF 纵深）
-- 不做魔数校验：前端 canvas 已强制重编码为 WebP，真机实测魔数校验会误伤正常上传（HTTP 415）
local c = require "common"
ngx.header["Content-Type"] = "application/json"
if ngx.var.http_x_trim_isadmin ~= "true" then
    ngx.status = 403
    ngx.say('{"ok":false,"msg":"仅管理员可操作"}')
    return ngx.exit(403)
end
if ngx.req.get_method() ~= "PUT" then
    ngx.status = 405
    ngx.say('{"ok":false}')
    return ngx.exit(405)
end
if not c.same_origin() then
    ngx.status = 403
    ngx.say('{"ok":false,"msg":"跨站请求已拦截"}')
    return ngx.exit(403)
end
ngx.req.read_body()

-- 大小上限：nginx 侧 client_max_body_size=30m 已是第一道闸，这里按 bytes 做二次校验
local MAX_BODY = 30 * 1024 * 1024
local content_length = ngx.var.content_length
if content_length and tonumber(content_length) and tonumber(content_length) > MAX_BODY then
    ngx.status = 413
    ngx.say('{"ok":false,"msg":"文件过大（上限 30MB）"}')
    return ngx.exit(413)
end
local dst = "/usr/share/nginx/html/bg/custom_bg.webp"
local ok = false
local d = nil
local tmp = ngx.req.get_body_file() -- 大于 client_body_buffer_size 时落临时盘
if tmp then
    local fi = io.open(tmp, "rb")
    if fi then
        d = fi:read("*a")
        fi:close()
    end
else
    d = ngx.req.get_body_data()
end

if d then
    ok = c.writefile(dst, d)
end
if ok then
    ngx.say('{"ok":true}')
else
    ngx.status = 500
    ngx.say('{"ok":false,"msg":"写入失败"}')
end
