# OpenClaw View

OpenClaw 的**控制台前端**，可独立构建与部署。通过 WebSocket 连接已运行的 OpenClaw Gateway，提供聊天、通道状态、配置、Cron、Skills、节点等管理界面。

- **仓库**：[Zazak1/openclaw-view](https://github.com/Zazak1/openclaw-view)
- **依赖**：需有一台已运行 [OpenClaw Gateway](https://github.com/openclaw/openclaw) 的机器（或兼容同一 WebSocket 协议的后端），本仓库仅包含前端。

## 快速开始

### 构建

```bash
pnpm install   # 仅安装根脚本依赖（可选）
pnpm build     # 安装 ui 依赖并构建，产物在 dist/control-ui/
```

### 本地开发

```bash
pnpm dev       # 启动 Vite 开发服务器，默认 http://localhost:5173
```

在浏览器打开后，在设置中填写 Gateway 地址（如 `ws://你的Gateway主机:18789`）和 token。

### 部署到 Linux 服务器

1. **构建产物**：在本地或 CI 执行 `pnpm build`，将 `dist/control-ui/` 目录上传到服务器。

2. **用 Nginx 托管静态文件**（示例）：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/openclaw-view;   # 指向 dist/control-ui 的内容
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    # 若前端与 Gateway 同域且需代理 WebSocket，可加：
    # location /ws { proxy_pass http://127.0.0.1:18789; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
}
```

3. **跨域连接 Gateway**：若前端与 Gateway 不同域，在浏览器中打开页面后，在 Control UI 设置里填写 Gateway 的 WebSocket 地址（如 `ws://gateway-host:18789` 或 `wss://gateway-host`），并确保 Gateway 配置了 `gateway.controlUi.allowedOrigins` 包含你的前端来源（如 `https://your-domain.com`）。

4. **认证**：在 Control UI 设置中粘贴 Gateway 的 token（或使用带 `#token=xxx` 的 URL）。Token 可通过在运行 Gateway 的机器上执行 `openclaw config get gateway.auth.token` 获取。

## 目录说明

- `ui/`：Vite + Lit 单页应用源码，构建后输出到 `dist/control-ui/`。
- `src/`：构建时所需的少量类型与工具（来自 OpenClaw 主仓），仅用于编译，不参与运行时后端。

## 协议与上游

控制台协议与能力与 [OpenClaw](https://github.com/openclaw/openclaw) 主项目保持一致。上游文档：[Control UI](https://docs.openclaw.ai/web/control-ui)、[Dashboard](https://docs.openclaw.ai/web/dashboard)。
