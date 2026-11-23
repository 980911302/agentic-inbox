// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { app as apiApp, receiveEmail } from "./index";
import { handleMcpRequest } from "./mcp";
import type { Env } from "./types";

// 导出当前仍在使用的 Durable Object 类（已移除 EmailAgent 与 EmailMCP）
export { MailboxDO } from "./durableObject";
export { AuthDO } from "./auth";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

// 主入口应用：挂载 MCP（Bearer Token 鉴权）、REST API（Cookie 会话鉴权）与前端 SPA
const app = new Hono<{ Bindings: Env }>();

// 标准 MCP 服务端点：采用 Authorization: Bearer <API_KEY> 鉴权并严格隔离至单个邮箱（兼容带尾部斜杠的 /mcp/）
app.all("/mcp", async (c) => {
	return handleMcpRequest(
		c.req.raw,
		c.env,
		c.executionCtx as ExecutionContext,
	);
});
app.all("/mcp/", async (c) => {
	return handleMcpRequest(
		c.req.raw,
		c.env,
		c.executionCtx as ExecutionContext,
	);
});

// 挂载 REST API 路由
app.route("/", apiApp);

// React Router 兜底：为所有非 API / MCP 路径提供前端页面
app.all("*", (c) => {
	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx as ExecutionContext },
	});
});

// 导出 Worker fetch 与入站 email 处理器
export default {
	fetch: app.fetch,
	async email(
		event: { raw: ReadableStream; rawSize: number },
		env: Env,
		ctx: ExecutionContext,
	) {
		try {
			await receiveEmail(event, env, ctx);
		} catch (e) {
			console.error(
				"Failed to process incoming email:",
				(e as Error).message,
				(e as Error).stack,
			);
			// 重新抛出错误以便 Cloudflare Email Routing 执行重试或退信
			throw e;
		}
	},
};
