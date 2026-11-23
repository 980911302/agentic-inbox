// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * MCP 服务端实现（无状态 Streamable HTTP）
 *
 * 认证方式：标准 HTTP Header `Authorization: Bearer <API_KEY>`
 * 权限隔离：每个 API Key 严格绑定所属账户的唯一邮箱（1:1），
 * 所有 MCP 工具均在闭包中锁死 mailboxId，杜绝跨邮箱越权访问。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import {
	FOLDER_TOOL_DESCRIPTION,
	Folders,
	MOVE_FOLDER_TOOL_DESCRIPTION,
} from "../../shared/folders";
import { ensureMailboxProvisioned, getAuthStub } from "../auth";
import {
	toolDeleteEmail,
	toolDraftEmail,
	toolDraftReply,
	toolGetEmail,
	toolGetMailboxInfo,
	toolGetThread,
	toolListEmails,
	toolMarkEmailRead,
	toolMoveEmail,
	toolSearchEmails,
	toolSendEmail,
	toolSendReply,
	toolUpdateDraft,
} from "../lib/tools";
import type { Env } from "../types";

const MCP_CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Expose-Headers": "mcp-session-id",
};

/** 包装正常返回结果为 MCP 文本内容 */
function mcpText(result: unknown) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(result, null, 2) },
		],
	};
}

/** 根据返回值中是否含 error 字段自动设置 isError */
function mcpResult(result: Record<string, unknown>) {
	if ("error" in result) {
		return {
			content: [
				{ type: "text" as const, text: JSON.stringify(result, null, 2) },
			],
			isError: true as const,
		};
	}
	return mcpText(result);
}

/** 创建严格绑定至单个邮箱的 McpServer 实例 */
export function createEmailMcpServer(env: Env, mailboxId: string): McpServer {
	const server = new McpServer({
		name: "agentic-inbox",
		version: "2.0.0",
	});

	// ── get_mailbox_info ───────────────────────────────────────────
	server.tool(
		"get_mailbox_info",
		"Get the bound mailbox email address, display name, and folder list with unread counts.",
		{},
		async () => {
			const result = await toolGetMailboxInfo(env, mailboxId);
			return mcpText(result);
		},
	);

	// ── list_emails ────────────────────────────────────────────────
	server.tool(
		"list_emails",
		"List emails in a folder of the current mailbox. Returns metadata (id, subject, sender, recipient, date, read/starred status, thread_id).",
		{
			folder: z
				.string()
				.default(Folders.INBOX)
				.describe(FOLDER_TOOL_DESCRIPTION),
			limit: z
				.number()
				.default(20)
				.describe("Maximum number of emails to return"),
			page: z.number().default(1).describe("Page number for pagination"),
		},
		async ({ folder, limit, page }) => {
			const result = await toolListEmails(env, mailboxId, {
				folder,
				limit,
				page,
			});
			return mcpText(result);
		},
	);

	// ── get_email ──────────────────────────────────────────────────
	server.tool(
		"get_email",
		"Get a single email with its full body content and attachments.",
		{
			emailId: z.string().describe("The email ID to retrieve"),
		},
		async ({ emailId }) => {
			const result = await toolGetEmail(env, mailboxId, emailId);
			return mcpResult(result as Record<string, unknown>);
		},
	);

	// ── get_thread ─────────────────────────────────────────────────
	server.tool(
		"get_thread",
		"Get all emails in a conversation thread sorted chronologically.",
		{
			threadId: z
				.string()
				.describe("The thread_id to retrieve all messages for"),
		},
		async ({ threadId }) => {
			const result = await toolGetThread(env, mailboxId, threadId);
			return mcpText(result);
		},
	);

	// ── search_emails ──────────────────────────────────────────────
	server.tool(
		"search_emails",
		"Search for emails in the current mailbox matching a query across subject and body.",
		{
			query: z.string().describe("Search query to match against subject and body"),
			folder: z
				.string()
				.optional()
				.describe("Optional folder to restrict search to"),
		},
		async ({ query, folder }) => {
			const result = await toolSearchEmails(env, mailboxId, { query, folder });
			return mcpText(result);
		},
	);

	// ── draft_reply ────────────────────────────────────────────────
	server.tool(
		"draft_reply",
		"Draft a reply to an email and save it to the Drafts folder without sending.",
		{
			originalEmailId: z.string().describe("The ID of the email being replied to"),
			to: z.string().email().describe("Recipient email address"),
			subject: z.string().describe("Subject line (usually 'Re: ...')"),
			bodyHtml: z.string().describe("The HTML body of the reply"),
		},
		async ({ originalEmailId, to, subject, bodyHtml }) => {
			const result = await toolDraftReply(env, mailboxId, {
				originalEmailId,
				to,
				subject,
				body: bodyHtml,
				isPlainText: false,
			});
			return mcpResult(result);
		},
	);

	// ── create_draft ───────────────────────────────────────────────
	server.tool(
		"create_draft",
		"Create a new draft email in the Drafts folder.",
		{
			to: z
				.string()
				.optional()
				.describe("Recipient email address (optional for early drafts)"),
			subject: z.string().describe("Subject line"),
			bodyHtml: z.string().describe("The HTML body of the draft"),
			in_reply_to: z
				.string()
				.optional()
				.describe("The ID of the email this draft is replying to (optional)"),
			thread_id: z
				.string()
				.optional()
				.describe("Thread ID to attach this draft to (optional)"),
		},
		async ({ to, subject, bodyHtml, in_reply_to, thread_id }) => {
			const result = await toolDraftEmail(env, mailboxId, {
				to: to || "",
				subject,
				body: bodyHtml,
				isPlainText: false,
				in_reply_to,
				thread_id,
			});
			if ("error" in result) {
				return mcpResult(result);
			}
			return mcpText({
				status: "draft_created",
				draftId: result.draftId,
				threadId: result.threadId,
				message: "草稿已保存到草稿箱。",
			});
		},
	);

	// ── update_draft ───────────────────────────────────────────────
	server.tool(
		"update_draft",
		"Update an existing draft email's content.",
		{
			draftId: z.string().describe("The ID of the draft to update"),
			to: z.string().optional().describe("Updated recipient email address"),
			subject: z.string().optional().describe("Updated subject line"),
			bodyHtml: z.string().optional().describe("Updated HTML body"),
		},
		async ({ draftId, to, subject, bodyHtml }) => {
			const result = await toolUpdateDraft(env, mailboxId, {
				draftId,
				to,
				subject,
				bodyHtml,
			});
			return mcpResult(result);
		},
	);

	// ── delete_email ───────────────────────────────────────────────
	server.tool(
		"delete_email",
		"Permanently delete an email by ID from the current mailbox.",
		{
			emailId: z.string().describe("The email ID to delete"),
		},
		async ({ emailId }) => {
			const result = await toolDeleteEmail(env, mailboxId, emailId);
			return mcpResult(result);
		},
	);

	// ── send_reply ─────────────────────────────────────────────────
	server.tool(
		"send_reply",
		"Send a reply to an existing email from the current mailbox.",
		{
			originalEmailId: z.string().describe("The ID of the email being replied to"),
			to: z.string().email().describe("Recipient email address"),
			subject: z.string().describe("Subject line"),
			bodyHtml: z.string().describe("The HTML body of the reply"),
		},
		async ({ originalEmailId, to, subject, bodyHtml }) => {
			const result = await toolSendReply(env, mailboxId, {
				originalEmailId,
				to,
				subject,
				bodyHtml,
			});
			return mcpResult(result);
		},
	);

	// ── send_email ─────────────────────────────────────────────────
	server.tool(
		"send_email",
		"Send a new email from the current mailbox.",
		{
			to: z.string().email().describe("Recipient email address"),
			subject: z.string().describe("Subject line"),
			bodyHtml: z.string().describe("The HTML body of the email"),
		},
		async ({ to, subject, bodyHtml }) => {
			const result = await toolSendEmail(env, mailboxId, {
				to,
				subject,
				bodyHtml,
			});
			return mcpResult(result);
		},
	);

	// ── mark_email_read ────────────────────────────────────────────
	server.tool(
		"mark_email_read",
		"Mark an email as read or unread.",
		{
			emailId: z.string().describe("The email ID"),
			read: z.boolean().describe("true to mark as read, false for unread"),
		},
		async ({ emailId, read }) => {
			const result = await toolMarkEmailRead(env, mailboxId, emailId, read);
			return mcpText(result);
		},
	);

	// ── move_email ─────────────────────────────────────────────────
	server.tool(
		"move_email",
		"Move an email to a different folder (inbox, sent, draft, archive, trash).",
		{
			emailId: z.string().describe("The email ID"),
			folderId: z.string().describe(MOVE_FOLDER_TOOL_DESCRIPTION),
		},
		async ({ emailId, folderId }) => {
			const result = await toolMoveEmail(env, mailboxId, emailId, folderId);
			return mcpResult(result);
		},
	);

	return server;
}

/**
 * 处理 /mcp 请求：校验标准 Authorization: Bearer <API_KEY> 后执行无状态 MCP 协议处理
 */
export async function handleMcpRequest(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	// 处理 CORS 预检请求
	if (request.method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: {
				...MCP_CORS_HEADERS,
				"Access-Control-Max-Age": "86400",
			},
		});
	}

	// 解析标准 Bearer Token
	const authHeader = request.headers.get("Authorization") || "";
	const match = authHeader.match(/^Bearer\s+(.+)$/i);
	const rawKey = match?.[1]?.trim();

	if (!rawKey) {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32001,
					message:
						"Unauthorized: Missing Authorization Bearer API key header.",
				},
				id: null,
			}),
			{
				status: 401,
				headers: {
					"Content-Type": "application/json",
					"WWW-Authenticate": 'Bearer realm="agentic-inbox"',
					...MCP_CORS_HEADERS,
				},
			},
		);
	}

	const authStub = getAuthStub(env);
	const keyAuth = await authStub.verifyApiKey(rawKey);
	if (!keyAuth) {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32001,
					message: "Unauthorized: Invalid or revoked API key.",
				},
				id: null,
			}),
			{
				status: 401,
				headers: {
					"Content-Type": "application/json",
					"WWW-Authenticate":
						'Bearer realm="agentic-inbox", error="invalid_token"',
					...MCP_CORS_HEADERS,
				},
			},
		);
	}

	// 确保该账户对应的邮箱存储已就绪
	await ensureMailboxProvisioned(env, keyAuth.email, keyAuth.displayName);

	// 兼容尾部斜杠 /mcp/，归一化为 /mcp 以匹配 createMcpHandler 路由校验
	const reqUrl = new URL(request.url);
	const normalizedRequest =
		reqUrl.pathname === "/mcp/"
			? new Request(
					new URL(`/mcp${reqUrl.search}`, reqUrl.origin).toString(),
					request,
				)
			: request;

	// 每次请求构造绑定到当前账户唯一邮箱的 McpServer，彻底杜绝跨账户状态污染
	const server = createEmailMcpServer(env, keyAuth.email);
	const handler = createMcpHandler(server, {
		route: "/mcp",
		corsOptions: {
			origin: "*",
			headers:
				"Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version",
			methods: "GET, POST, DELETE, OPTIONS",
			exposeHeaders: "mcp-session-id",
		},
	});

	return handler(normalizedRequest, env, ctx);
}
