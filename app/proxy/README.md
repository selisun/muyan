# muyan · fnOS 登录页美化

用 Docker OpenResty 反代 fnOS 登录页，**零侵入**替换登录背景图、登录框布局、左侧一言——不改任何 fnOS 文件，天然绕开系统防篡改还原。

容器名 **muyan**，由 fnOS 应用中心安装。容器由 fnOS **docker-project** 托管启停（`config/resource` 声明，编排文件在包内 `app/docker/docker-compose.yaml`），运行数据部署于 `/var/apps/muyan/var/proxy/`。

## 访问入口（两种）

| 入口 | 地址 | 说明 |
|---|---|---|
| fnOS 登录页（美化反代） | `https://<NAS_IP>:11766/` | 用户日常登录入口，端口固定为 manifest.service_port（11766） |
| 合并窗口页（上传+模板设置） | 飞牛桌面图标 → `/app/muyan/` | 走 fnOS **统一网关**（unix socket），窗口嵌在飞牛门户内打开 |

- **窗口页不再占用独立端口**：桌面图标配置为 `type: iframe`，统一网关把 `/app/muyan/*` 转发到 `/var/apps/muyan/target/app.sock`（容器内 `/app/target/app.sock`），窗口在飞牛门户内同源打开，无自签证书提示
- **需 fnOS 1.1.3100+**（统一网关最低版本，见 manifest `os_min_version`）
- 窗口页**免登录**——统一网关已校验 fnOS 登录态；上传/保存模板在 Lua 层校验 `X-Trim-Isadmin` 管理员头

## 美化模板（3 种）

| 模板 | 效果 |
|---|---|
| **经典** | 背景图 + 左侧一言（72px 黑体加粗+链接） + 登录框靠右（右缘 140px） |
| **聚焦** | 背景图 + 登录框居中，无一言 |
| **极简** | 纯色 `#004040` 深青背景 + 登录框居中，无一言 |

在窗口页底部选择模板，保存后刷新登录页生效。

## 目录结构

```
/var/apps/muyan/
├── target/                # 应用安装目录（模板 + 编排 + cmd）
│   ├── app/docker/docker-compose.yaml   # docker-project 托管编排（11766:443 + Socket 挂载）
│   ├── cmd/               # install_callback / upgrade_callback / main
│   └── proxy/             # 模板（conf / bg），install_callback 同步到 var/proxy
├── target/app.sock        # 统一网关 Socket（容器 nginx 监听于挂载目录）
└── var/proxy/             # 运行时数据
    ├── conf/
    │   ├── default.conf          # http 层 + 80→443 + 443 fnOS 反代（sub_filter 注入）
    │   ├── portal-ports.conf     # 合并窗口 unix socket server（前缀剥离 rewrite）
    │   ├── portal-common.conf    # 合并窗口路由（/、/api/settings、/custom_bg.webp）
    │   └── lua/                  # 上传/设置/模板下发
    ├── certs/                    # 应用自签证书（CN=muyan，install_callback 用 openssl 生成）
    ├── config/                   # portal.json（模板配置）
    └── bg/
        ├── custom_bg.webp        # ← 当前登录背景图
        ├── solid_bg.webp         # ← 极简模板用纯色图
        ├── quote.txt             # ← 一言语录，每行 "句子|作者"
        └── index.html            # 合并窗口单页
```

## 使用（通过飞牛桌面图标）

1. 飞牛桌面点击 **牧颜** 图标 → 在飞牛门户内打开窗口页（统一网关同源，无证书提示）
2. 选择/拖入图片（自动转 1920×1080 WebP）→「上传并应用」
3. 打开登录页 `https://<NAS_IP>:11766/` Ctrl+F5 强刷看新背景

## 换语录 / 微调美化

- 语录：改 `/var/apps/muyan/var/proxy/bg/quote.txt`，每行 `句子|作者`，刷新随机一条
- 登录框位置/一言字号/链接：改 `conf/default.conf` 注入 JS（右缘 `right:'140px'`、一言 72px 黑体加粗、逗号换行、官网/论坛链接卡片）
- 改完在应用中心**重启牧颜**（nginx 启动时重读配置），浏览器 Ctrl+F5

## 原理（关键约束）

- 背景是字面量 URL `/static/bg/wallpaper-1.webp`，反代精确拦截 alias 到 `bg/custom_bg.webp`（minimal 模板改发 `solid_bg.webp`），无需改 fnOS 文件
- 反代必须转发 WebSocket 升级头，否则登录页卡"加载中"
- 必须 `proxy_set_header Accept-Encoding "";`，否则 gzip 压缩导致 `sub_filter` 注入失效
- 统一网关转发到 Socket 时保留完整前缀 URI，`portal-ports.conf` 用 rewrite 剥离 `/app/muyan` 前缀后复用无前缀的 portal-common 路由
- 上传 PUT 由 Lua 直接写文件；设置/模板存于 `config/portal.json`（仅存模板名，无敏感数据）
