<div align="center">
  <h1>Agentic Inbox · 智能体邮箱</h1>
  <p><em>基于 Cloudflare Workers 的多用户自托管邮箱与 MCP 服务（1 账户 = 1 邮箱，独立密钥严格隔离）</em></p>
</div>

Agentic Inbox 运行在你的 Cloudflare 账号上，通过 Cloudflare Email Routing 接收邮件、Cloudflare Email Service 发送邮件，使用 SQLite Durable Objects 存储邮件与账户数据，使用 R2 存储附件，并为每个账户提供独立的标准 MCP（Model Context Protocol）密钥接入能力。

## 核心特性

- **1 账户 = 1 邮箱严格隔离**：取消全局 Cloudflare Access 共享权限，改用标准邮箱 + 密码登录，每个用户只能访问与操作自己的专属邮箱。
- **管理员控制台（`admin@<主域名>`）**：
  - 首次访问 `/setup` 设置管理员密码（也支持通过环境变量 `ADMIN_PASSWORD` 自动初始化）；
  - 登录时支持直接输入 `admin` 或完整邮箱 `admin@zll300.com`；
  - 内置**开放自助注册**开关（默认关闭，防止滥用），支持手动创建/禁用/删除账户、重置密码，并可一键接管旧版部署遗留的历史邮箱。
- **多密钥标准 MCP 服务（`/mcp`）**：
  - 每个账户可在设置中创建多个独立的 MCP 密钥（支持备注、展示最后使用时间、随时单独吊销）；
  - 采用标准 HTTP Header `Authorization: Bearer <API_KEY>` 鉴权，每个密钥严格锁定在所属账户的唯一邮箱，无跨邮箱越权风险；
  - 已彻底移除内置 Workers AI 模型与内置聊天 Agent，零 AI 推理费用，专注为外部 AI Agent（Claude Code、Cursor、自研 Agent 等）提供干净可靠的邮件 MCP 工具。
- **全中文界面**：收发信、会话聚合、搜索、文件夹管理、草稿、附件预览、设置与管理后台全面中文化。

## 技术栈

- **前端**：React 19、React Router v7、Tailwind CSS v4、Zustand、TanStack Query、TipTap、@cloudflare/kumo
- **后端**：Hono、Cloudflare Workers、Durable Objects（`MailboxDO` + `AuthDO`，SQLite + Drizzle ORM）、R2、Email Routing / Email Service
- **MCP 协议**：`agents/mcp` 无状态 Streamable HTTP（`@modelcontextprotocol/sdk`）

## 本地开发

```bash
npm install
npm run dev
```

## 部署与升级说明

```bash
npm run deploy
```

> **从旧版（带 Cloudflare Access 与 EmailAgent）升级时的注意事项**：
> 1. `wrangler.jsonc` 中已配置 `v4` Durable Objects 迁移，会自动新增 `AuthDO` 并安全移除旧版的 `EmailAgent` 和 `EmailMCP`，**完整保留 `MailboxDO` 中的历史邮件**。
> 2. 请前往 Cloudflare Dashboard → Worker → **Settings > Domains & Routes**，**关闭此前开启的 Cloudflare Access**（否则外部 MCP 客户端请求 `/mcp` 和正常登录会被 CF Access 拦截）。
> 3. 部署完成后首次访问站点，按提示为 `admin@zll300.com` 设置登录密码；若旧版已有其他邮箱数据，管理员登录后可在「管理员控制台」一键为历史邮箱设置密码并启用。

## MCP 客户端接入示例

在邮箱的 **MCP 密钥与设置** 中生成密钥后，在支持 Streamable HTTP 的 MCP 客户端中配置：

```json
{
  "mcpServers": {
    "agentic-inbox": {
      "type": "http",
      "url": "https://<你的域名>/mcp",
      "headers": {
        "Authorization": "Bearer agx_你的密钥"
      }
    }
  }
}
```

## 开源协议

Apache 2.0 — 详见 [LICENSE](LICENSE)。
