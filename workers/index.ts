// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import PostalMime from "postal-mime";
import { z } from "zod";
import { Folders } from "../shared/folders";
import {
	ensureAdminSeeded,
	ensureMailboxProvisioned,
	getAdminEmail,
	getAuthStub,
	getConfiguredDomains,
	normalizeLoginIdentifier,
} from "./auth";
import { sendEmail } from "./email-sender";
import { storeAttachments, type StoredAttachment } from "./lib/attachments";
import {
	clearSessionCookie,
	getSessionToken,
	requireAdmin,
	requireAuth,
	setSessionCookie,
} from "./lib/auth-middleware";
import { hashPassword, verifyPassword } from "./lib/crypto";
import {
	buildThreadingHeaders,
	generateMessageId,
	getMailboxStub,
	listMailboxes,
	SenderValidationError,
	validateSender,
} from "./lib/email-helpers";
import { type MailboxContext, requireMailbox } from "./lib/mailbox";
import { SendEmailRequestSchema } from "./lib/schemas";
import { handleForwardEmail, handleReplyEmail } from "./routes/reply-forward";
import type { Env } from "./types";

type AppContext = Context<MailboxContext>;

// ── 请求体校验 Schema ──────────────────────────────────────────────

const SetupBody = z.object({
	password: z.string().min(6, "密码至少需要 6 位"),
	displayName: z.string().trim().max(60, "显示名称不能超过 60 字").optional(),
});

const LoginBody = z.object({
	email: z.string().trim().min(1, "请输入邮箱地址"),
	password: z.string().min(1, "请输入密码"),
});

const RegisterBody = z.object({
	prefix: z
		.string()
		.trim()
		.min(1, "请输入邮箱前缀")
		.max(64, "邮箱前缀过长")
		.regex(/^[a-zA-Z0-9._-]+$/, "邮箱前缀仅支持字母、数字、点、下划线和短横线"),
	domain: z.string().trim().min(1, "请选择域名"),
	displayName: z.string().trim().max(60, "显示名称不能超过 60 字").optional(),
	password: z.string().min(6, "密码至少需要 6 位"),
});

const ChangePasswordBody = z.object({
	currentPassword: z.string().min(1, "请输入当前密码"),
	newPassword: z.string().min(6, "新密码至少需要 6 位"),
});

const CreateApiKeyBody = z.object({
	name: z.string().trim().min(1, "请输入密钥名称").max(60, "密钥名称不能超过 60 字"),
});

const AdminSettingsBody = z.object({
	allowRegistration: z.boolean(),
});

const AdminCreateUserBody = z.object({
	prefix: z
		.string()
		.trim()
		.min(1, "请输入邮箱前缀")
		.max(64, "邮箱前缀过长")
		.regex(/^[a-zA-Z0-9._-]+$/, "邮箱前缀仅支持字母、数字、点、下划线和短横线")
		.optional(),
	domain: z.string().trim().optional(),
	email: z.string().email("邮箱格式不正确").optional(),
	displayName: z.string().trim().max(60, "显示名称不能超过 60 字").optional(),
	password: z.string().min(6, "密码至少需要 6 位"),
});

const AdminUpdateUserBody = z.object({
	displayName: z.string().trim().max(60, "显示名称不能超过 60 字").optional(),
	disabled: z.boolean().optional(),
	password: z.string().min(6, "密码至少需要 6 位").optional(),
});

const DraftBody = z.object({
	to: z.string().optional(),
	cc: z.string().optional(),
	bcc: z.string().optional(),
	subject: z.string().optional(),
	body: z.string(),
	in_reply_to: z.string().optional(),
	thread_id: z.string().optional(),
	draft_id: z.string().optional(),
});

// ── 工具函数 ───────────────────────────────────────────────────────

function slugify(text: string) {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^\w-]+/g, "")
		.replace(/--+/g, "-")
		.replace(/^-+/, "")
		.replace(/-+$/, "");
}

function intQuery(c: AppContext, key: string): number | undefined {
	const v = c.req.query(key);
	if (!v) return undefined;
	const n = Number(v);
	return Number.isNaN(n) ? undefined : n;
}

function boolQuery(c: AppContext, key: string): boolean | undefined {
	const v = c.req.query(key);
	if (v === undefined || v === "") return undefined;
	return v === "true" || v === "1";
}

function formatZodError(err: unknown): string {
	if (err instanceof z.ZodError) {
		return err.issues[0]?.message || "请求参数校验失败";
	}
	return (err as Error)?.message || "请求处理失败";
}

// ── Hono 应用与全局中间件 ──────────────────────────────────────────

const app = new Hono<MailboxContext>();

app.use(
	"/api/*",
	cors({
		origin: (origin) => {
			if (!origin) return origin;
			try {
				const url = new URL(origin);
				if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
					return origin;
				}
			} catch {
				// 忽略非法 origin
			}
			return undefined;
		},
		credentials: true,
	}),
);

// 统一捕获 Zod 校验错误，返回可读的中文提示
app.onError((err, c) => {
	if (err instanceof z.ZodError) {
		return c.json({ error: formatZodError(err) }, 400);
	}
	console.error("API error:", err);
	return c.json({ error: err.message || "服务器内部错误" }, 500);
});

// ── 公开接口：配置与认证 ───────────────────────────────────────────

app.get("/api/v1/config", (c) => {
	const domains = getConfiguredDomains(c.env);
	const emailAddresses = c.env.EMAIL_ADDRESSES ?? [];
	return c.json({ domains, emailAddresses });
});

app.get("/api/v1/auth/status", async (c) => {
	const initialized = await ensureAdminSeeded(c.env);
	const authStub = getAuthStub(c.env);
	const settings = await authStub.getSystemSettings();
	const domains = getConfiguredDomains(c.env);
	const adminEmail = getAdminEmail(c.env);

	return c.json({
		initialized,
		adminEmail,
		allowRegistration: settings.allowRegistration,
		domains,
	});
});

app.post("/api/v1/auth/setup", async (c) => {
	const alreadyInitialized = await ensureAdminSeeded(c.env);
	if (alreadyInitialized) {
		return c.json({ error: "管理员账户已初始化，请直接登录" }, 409);
	}

	const { password, displayName } = SetupBody.parse(await c.req.json());
	const adminEmail = getAdminEmail(c.env);
	const finalName = displayName?.trim() || "管理员";
	const passwordHash = await hashPassword(password);

	const authStub = getAuthStub(c.env);
	const result = await authStub.createUser({
		email: adminEmail,
		displayName: finalName,
		passwordHash,
		role: "admin",
	});
	if (result.error || !result.user) {
		return c.json({ error: result.error || "初始化管理员失败" }, 409);
	}

	await ensureMailboxProvisioned(c.env, adminEmail, finalName);

	const session = await authStub.createSession(adminEmail);
	setSessionCookie(c, session.token);

	return c.json({ user: result.user }, 201);
});

app.post("/api/v1/auth/login", async (c) => {
	const initialized = await ensureAdminSeeded(c.env);
	if (!initialized) {
		return c.json({ error: "系统尚未初始化管理员账户，请先完成初始化" }, 400);
	}

	const { email: rawIdentifier, password } = LoginBody.parse(await c.req.json());
	const email = normalizeLoginIdentifier(rawIdentifier, c.env);

	const authStub = getAuthStub(c.env);
	const userRecord = await authStub.getUserForAuth(email);
	if (!userRecord) {
		return c.json({ error: "邮箱或密码错误" }, 401);
	}
	if (userRecord.disabled) {
		return c.json({ error: "该账户已被管理员禁用" }, 403);
	}

	const valid = await verifyPassword(password, userRecord.passwordHash);
	if (!valid) {
		return c.json({ error: "邮箱或密码错误" }, 401);
	}

	await ensureMailboxProvisioned(c.env, userRecord.email, userRecord.displayName);

	const session = await authStub.createSession(userRecord.email);
	setSessionCookie(c, session.token);

	return c.json({
		user: {
			email: userRecord.email,
			displayName: userRecord.displayName,
			role: userRecord.role,
			disabled: false,
		},
	});
});

app.post("/api/v1/auth/register", async (c) => {
	const initialized = await ensureAdminSeeded(c.env);
	if (!initialized) {
		return c.json({ error: "系统尚未初始化，请联系管理员" }, 403);
	}

	const authStub = getAuthStub(c.env);
	const settings = await authStub.getSystemSettings();
	if (!settings.allowRegistration) {
		return c.json({ error: "当前未开放公开注册，请联系管理员开通账号" }, 403);
	}

	const { prefix, domain, displayName, password } = RegisterBody.parse(
		await c.req.json(),
	);
	const normalizedPrefix = prefix.toLowerCase();
	const normalizedDomain = domain.toLowerCase();
	const domains = getConfiguredDomains(c.env);

	if (domains.length > 0 && !domains.includes(normalizedDomain)) {
		return c.json({ error: "不支持使用该域名注册" }, 400);
	}
	if (normalizedPrefix === "admin") {
		return c.json({ error: "admin 为系统保留前缀，不能自助注册" }, 400);
	}

	const email = `${normalizedPrefix}@${normalizedDomain}`;
	const allowedAddresses = ((c.env.EMAIL_ADDRESSES ?? []) as string[]).map((a) =>
		a.toLowerCase(),
	);
	if (allowedAddresses.length > 0 && !allowedAddresses.includes(email)) {
		return c.json({ error: "当前系统仅允许注册指定邮箱地址" }, 403);
	}

	// 防止路人通过公开注册直接认领线上历史遗留邮箱
	if (await c.env.BUCKET.head(`mailboxes/${email}.json`)) {
		return c.json({ error: "该邮箱地址已被占用，如需认领请联系管理员" }, 409);
	}

	const finalName = displayName?.trim() || normalizedPrefix;
	const passwordHash = await hashPassword(password);
	const created = await authStub.createUser({
		email,
		displayName: finalName,
		passwordHash,
		role: "user",
	});
	if (created.error || !created.user) {
		return c.json({ error: created.error || "注册失败" }, 409);
	}

	await ensureMailboxProvisioned(c.env, email, finalName);

	const session = await authStub.createSession(email);
	setSessionCookie(c, session.token);

	return c.json({ user: created.user }, 201);
});

app.post("/api/v1/auth/logout", async (c) => {
	const token = getSessionToken(c);
	if (token) {
		const authStub = getAuthStub(c.env);
		await authStub.deleteSession(token);
	}
	clearSessionCookie(c);
	return c.json({ ok: true });
});

// ── 需登录接口：当前用户与密码修改 ────────────────────────────────

app.get("/api/v1/auth/me", requireAuth, (c) => {
	return c.json({ user: c.var.user });
});

app.put("/api/v1/auth/password", requireAuth, async (c) => {
	const { currentPassword, newPassword } = ChangePasswordBody.parse(
		await c.req.json(),
	);
	const authStub = getAuthStub(c.env);
	const userRecord = await authStub.getUserForAuth(c.var.user.email);
	if (!userRecord) {
		return c.json({ error: "账户不存在" }, 404);
	}

	const valid = await verifyPassword(currentPassword, userRecord.passwordHash);
	if (!valid) {
		return c.json({ error: "当前密码不正确" }, 400);
	}

	const newHash = await hashPassword(newPassword);
	await authStub.updateUser(c.var.user.email, { passwordHash: newHash });

	// 修改密码后重新签发当前会话，旧设备自动下线
	const session = await authStub.createSession(c.var.user.email);
	setSessionCookie(c, session.token);

	return c.json({ ok: true });
});

// ── 需登录接口：MCP API 密钥管理（多密钥，绑定当前账户） ───────────

app.get("/api/v1/keys", requireAuth, async (c) => {
	const authStub = getAuthStub(c.env);
	const keys = await authStub.listApiKeys(c.var.user.email);
	return c.json({ keys });
});

app.post("/api/v1/keys", requireAuth, async (c) => {
	const { name } = CreateApiKeyBody.parse(await c.req.json());
	const authStub = getAuthStub(c.env);
	const created = await authStub.createApiKey(c.var.user.email, name);
	return c.json(created, 201);
});

app.delete("/api/v1/keys/:id", requireAuth, async (c) => {
	const keyId = c.req.param("id");
	const authStub = getAuthStub(c.env);
	const deleted = await authStub.deleteApiKey(c.var.user.email, keyId);
	if (!deleted) {
		return c.json({ error: "密钥不存在" }, 404);
	}
	return c.body(null, 204);
});

// ── 管理员接口：开放注册开关 & 账户管理 ───────────────────────────

app.use("/api/v1/admin/*", requireAuth, requireAdmin);

app.get("/api/v1/admin/settings", async (c) => {
	const authStub = getAuthStub(c.env);
	const settings = await authStub.getSystemSettings();
	return c.json(settings);
});

app.put("/api/v1/admin/settings", async (c) => {
	const body = AdminSettingsBody.parse(await c.req.json());
	const authStub = getAuthStub(c.env);
	const updated = await authStub.updateSystemSettings(body);
	return c.json(updated);
});

app.get("/api/v1/admin/users", async (c) => {
	const authStub = getAuthStub(c.env);
	const users = await authStub.listUsers();
	const userSet = new Set(users.map((u) => u.email.toLowerCase()));

	// 兼容旧版线上部署：扫描 R2 中尚未绑定账户的历史邮箱
	const r2Mailboxes = await listMailboxes(c.env.BUCKET);
	const orphanMailboxes = r2Mailboxes
		.map((m) => m.email.toLowerCase())
		.filter((email) => !userSet.has(email));

	return c.json({ users, orphanMailboxes });
});

app.post("/api/v1/admin/users", async (c) => {
	const body = AdminCreateUserBody.parse(await c.req.json());
	let email = body.email?.trim().toLowerCase();

	if (!email) {
		if (!body.prefix || !body.domain) {
			return c.json({ error: "请填写邮箱前缀与域名" }, 400);
		}
		email = `${body.prefix.toLowerCase()}@${body.domain.toLowerCase()}`;
	}

	const domain = email.split("@")[1];
	const configuredDomains = getConfiguredDomains(c.env);
	if (configuredDomains.length > 0 && !configuredDomains.includes(domain)) {
		return c.json({ error: `域名必须属于已配置列表：${configuredDomains.join(", ")}` }, 400);
	}

	const displayName = body.displayName?.trim() || email.split("@")[0];
	const passwordHash = await hashPassword(body.password);

	const authStub = getAuthStub(c.env);
	const result = await authStub.createUser({
		email,
		displayName,
		passwordHash,
		role: "user",
	});
	if (result.error || !result.user) {
		return c.json({ error: result.error || "创建账户失败" }, 409);
	}

	// 若该邮箱在旧版部署中已存在邮件，自动继承且不覆盖历史邮件
	await ensureMailboxProvisioned(c.env, email, displayName);

	return c.json({ user: result.user }, 201);
});

app.put("/api/v1/admin/users/:email", async (c) => {
	const targetEmail = decodeURIComponent(c.req.param("email")).toLowerCase();
	const body = AdminUpdateUserBody.parse(await c.req.json());

	if (targetEmail === c.var.user.email.toLowerCase() && body.disabled === true) {
		return c.json({ error: "不能禁用当前登录的管理员账户" }, 400);
	}

	const authStub = getAuthStub(c.env);
	const passwordHash = body.password
		? await hashPassword(body.password)
		: undefined;

	const updated = await authStub.updateUser(targetEmail, {
		displayName: body.displayName,
		disabled: body.disabled,
		passwordHash,
	});
	if (!updated) {
		return c.json({ error: "账户不存在" }, 404);
	}

	// 同步发件人名称到 R2 邮箱配置
	if (body.displayName) {
		const key = `mailboxes/${targetEmail}.json`;
		const obj = await c.env.BUCKET.get(key);
		if (obj) {
			try {
				const existing = (await obj.json()) as Record<string, unknown>;
				await c.env.BUCKET.put(
					key,
					JSON.stringify({ ...existing, fromName: body.displayName }),
				);
			} catch {
				// 忽略解析异常
			}
		}
	}

	return c.json({ user: updated });
});

app.delete("/api/v1/admin/users/:email", async (c) => {
	const targetEmail = decodeURIComponent(c.req.param("email")).toLowerCase();
	if (targetEmail === c.var.user.email.toLowerCase()) {
		return c.json({ error: "不能删除当前管理员账户" }, 400);
	}

	const authStub = getAuthStub(c.env);
	const result = await authStub.deleteUser(targetEmail);
	if (!result.ok) {
		return c.json({ error: result.error || "删除账户失败" }, 400);
	}

	// 彻底清理对应邮箱的 DO 数据、R2 附件与 R2 配置
	try {
		const mailboxStub = getMailboxStub(c.env, targetEmail);
		const attachmentKeys = await mailboxStub.purgeAll();
		if (attachmentKeys.length > 0) {
			await c.env.BUCKET.delete(attachmentKeys);
		}
		await c.env.BUCKET.delete(`mailboxes/${targetEmail}.json`);
	} catch (e) {
		console.error("清理被删除账户的邮箱数据失败:", (e as Error).message);
	}

	return c.body(null, 204);
});

// ── 邮箱接口（严格 1:1 归属校验） ──────────────────────────────────

app.use("/api/v1/mailboxes", requireAuth);
app.use("/api/v1/mailboxes/:mailboxId", requireAuth, requireMailbox);
app.use("/api/v1/mailboxes/:mailboxId/*", requireAuth, requireMailbox);

// 仅返回当前登录用户自己的唯一邮箱
app.get("/api/v1/mailboxes", async (c) => {
	const user = c.var.user;
	const obj = await c.env.BUCKET.get(`mailboxes/${user.email}.json`);
	const settings = obj ? await obj.json() : { fromName: user.displayName };
	return c.json([
		{
			id: user.email,
			email: user.email,
			name: user.displayName,
			settings,
		},
	]);
});

app.get("/api/v1/mailboxes/:mailboxId", async (c) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId")!).toLowerCase();
	const obj = await c.env.BUCKET.get(`mailboxes/${mailboxId}.json`);
	if (!obj) return c.json({ error: "邮箱不存在" }, 404);
	return c.json({
		id: mailboxId,
		name: c.var.user.displayName,
		email: mailboxId,
		settings: await obj.json(),
	});
});

app.put("/api/v1/mailboxes/:mailboxId", async (c) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId")!).toLowerCase();
	const body = (await c.req.json()) as {
		settings?: Record<string, unknown>;
	};
	if (!body?.settings || typeof body.settings !== "object") {
		return c.json({ error: "无效的邮箱配置参数" }, 400);
	}
	const { settings } = body;
	const key = `mailboxes/${mailboxId}.json`;
	if (!(await c.env.BUCKET.head(key))) {
		return c.json({ error: "邮箱不存在" }, 404);
	}
	await c.env.BUCKET.put(key, JSON.stringify(settings));

	// 同步发件人显示名到账户表
	if (typeof settings.fromName === "string" && settings.fromName.trim()) {
		const authStub = getAuthStub(c.env);
		await authStub.updateUser(mailboxId, {
			displayName: settings.fromName.trim(),
		});
	}

	return c.json({
		id: mailboxId,
		name:
			typeof settings.fromName === "string" && settings.fromName.trim()
				? settings.fromName.trim()
				: c.var.user.displayName,
		email: mailboxId,
		settings,
	});
});

// ── 邮件 CRUD ──────────────────────────────────────────────────────

app.get("/api/v1/mailboxes/:mailboxId/emails", async (c: AppContext) => {
	const folder = c.req.query("folder");
	const thread_id = c.req.query("thread_id");
	const threaded = boolQuery(c, "threaded");
	const page = intQuery(c, "page");
	const limit = intQuery(c, "limit");
	const sortColumn = c.req.query("sortColumn") as any;
	const sortDirection = c.req.query("sortDirection") as
		| "ASC"
		| "DESC"
		| undefined;
	const stub = c.var.mailboxStub;

	if (threaded && folder) {
		const emails = await (stub as any).getThreadedEmails({ folder, page, limit });
		const totalCount = await (stub as any).countThreadedEmails(folder);
		return c.json({ emails, totalCount });
	}
	const emails = await stub.getEmails({
		folder,
		thread_id,
		page,
		limit,
		sortColumn,
		sortDirection,
	});
	if (folder) {
		const totalCount = await stub.countEmails({ folder, thread_id });
		return c.json({ emails, totalCount });
	}
	return c.json(emails);
});

app.post("/api/v1/mailboxes/:mailboxId/emails", async (c: AppContext) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId")!).toLowerCase();
	const body = SendEmailRequestSchema.parse(await c.req.json());
	const {
		to,
		cc,
		bcc,
		from,
		subject,
		html,
		text,
		attachments,
		in_reply_to,
		references,
		thread_id,
	} = body;

	let toStr: string;
	let fromEmail: string;
	let fromDomain: string;
	try {
		({ toStr, fromEmail, fromDomain } = validateSender(to, from, mailboxId));
	} catch (e) {
		if (e instanceof SenderValidationError) {
			return c.json({ error: e.message }, 400);
		}
		throw e;
	}

	const { messageId, outgoingMessageId } = generateMessageId(fromDomain);
	const stub = c.var.mailboxStub;
	const rateLimitError = await (stub as any).checkSendRateLimit();
	if (rateLimitError) return c.json({ error: rateLimitError }, 429);
	const attachmentData = await storeAttachments(
		c.env.BUCKET,
		messageId,
		attachments,
	);

	await stub.createEmail(
		Folders.SENT,
		{
			id: messageId,
			subject,
			sender: fromEmail,
			recipient: toStr,
			cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc).toLowerCase() : null,
			bcc: bcc
				? (Array.isArray(bcc) ? bcc.join(", ") : bcc).toLowerCase()
				: null,
			date: new Date().toISOString(),
			body: html || text || "",
			in_reply_to: in_reply_to || null,
			email_references: references ? JSON.stringify(references) : null,
			thread_id: thread_id || in_reply_to || messageId,
			message_id: outgoingMessageId,
			raw_headers: JSON.stringify([
				{
					key: "from",
					value:
						typeof from === "string" ? from : `${from.name} <${from.email}>`,
				},
				{ key: "to", value: Array.isArray(to) ? to.join(", ") : to },
				...(cc
					? [{ key: "cc", value: Array.isArray(cc) ? cc.join(", ") : cc }]
					: []),
				...(bcc
					? [{ key: "bcc", value: Array.isArray(bcc) ? bcc.join(", ") : bcc }]
					: []),
				{ key: "subject", value: subject },
				{ key: "date", value: new Date().toISOString() },
				{ key: "message-id", value: `<${outgoingMessageId}>` },
			]),
		},
		attachmentData,
	);

	c.executionCtx.waitUntil(
		sendEmail(c.env.EMAIL, {
			to,
			cc,
			bcc,
			from,
			subject,
			html,
			text,
			attachments: attachments?.map((att) => ({
				content: att.content,
				filename: att.filename,
				type: att.type,
				disposition: att.disposition || "attachment",
				contentId: att.contentId,
			})),
			...(in_reply_to
				? { headers: buildThreadingHeaders(in_reply_to, references || []) }
				: {}),
		}).catch((e) =>
			console.error("Deferred email delivery failed:", (e as Error).message),
		),
	);
	return c.json({ id: messageId, status: "sent" }, 202);
});

app.post("/api/v1/mailboxes/:mailboxId/drafts", async (c: AppContext) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId")!).toLowerCase();
	const { to, cc, bcc, subject, body, in_reply_to, thread_id, draft_id } =
		DraftBody.parse(await c.req.json());
	const stub = c.var.mailboxStub;
	if (draft_id) await stub.deleteEmail(draft_id);
	const messageId = crypto.randomUUID();
	const now = new Date().toISOString();
	await stub.createEmail(
		Folders.DRAFT,
		{
			id: messageId,
			subject: subject || "",
			sender: mailboxId,
			recipient: (to || "").toLowerCase(),
			cc: cc?.toLowerCase() || null,
			bcc: bcc?.toLowerCase() || null,
			date: now,
			body,
			in_reply_to: in_reply_to || null,
			email_references: null,
			thread_id: thread_id || in_reply_to || messageId,
		},
		[],
	);
	return c.json(
		{
			id: messageId,
			status: "draft",
			subject: subject || "",
			recipient: to || "",
			date: now,
		},
		201,
	);
});

app.get("/api/v1/mailboxes/:mailboxId/emails/:id", async (c: AppContext) => {
	const email = await c.var.mailboxStub.getEmail(c.req.param("id")!);
	if (!email) return c.json({ error: "邮件不存在" }, 404);
	return new Response(JSON.stringify(email), {
		headers: { "Content-Type": "application/json" },
	});
});

app.put("/api/v1/mailboxes/:mailboxId/emails/:id", async (c: AppContext) => {
	const { read, starred } = (await c.req.json()) as {
		read?: boolean;
		starred?: boolean;
	};
	const email = await c.var.mailboxStub.updateEmail(c.req.param("id")!, {
		read,
		starred,
	});
	return email ? c.json(email) : c.json({ error: "邮件不存在" }, 404);
});

app.delete("/api/v1/mailboxes/:mailboxId/emails/:id", async (c: AppContext) => {
	const id = c.req.param("id")!;
	const attachments = await c.var.mailboxStub.deleteEmail(id);
	if (attachments === null) return c.json({ error: "邮件不存在" }, 404);
	if (attachments.length > 0) {
		await c.env.BUCKET.delete(
			attachments.map(
				(att: any) => `attachments/${id}/${att.id}/${att.filename}`,
			),
		);
	}
	return c.body(null, 204);
});

app.post(
	"/api/v1/mailboxes/:mailboxId/emails/:id/move",
	async (c: AppContext) => {
		const { folderId } = (await c.req.json()) as { folderId: string };
		const success = await c.var.mailboxStub.moveEmail(
			c.req.param("id")!,
			folderId,
		);
		return success
			? c.json({ status: "moved" })
			: c.json({ error: "目标文件夹不存在" }, 400);
	},
);

// ── 会话 ───────────────────────────────────────────────────────────

app.get(
	"/api/v1/mailboxes/:mailboxId/threads/:threadId",
	async (c: AppContext) => {
		return c.json(
			await (c.var.mailboxStub as any).getThreadEmails(
				c.req.param("threadId")!,
			),
		);
	},
);

app.post(
	"/api/v1/mailboxes/:mailboxId/threads/:threadId/read",
	async (c: AppContext) => {
		await c.var.mailboxStub.markThreadRead(c.req.param("threadId")!);
		return c.json({ status: "marked_read" });
	},
);

// ── 回复与转发 ─────────────────────────────────────────────────────

app.post("/api/v1/mailboxes/:mailboxId/emails/:id/reply", handleReplyEmail);
app.post("/api/v1/mailboxes/:mailboxId/emails/:id/forward", handleForwardEmail);

// ── 文件夹 ─────────────────────────────────────────────────────────

app.get("/api/v1/mailboxes/:mailboxId/folders", async (c: AppContext) =>
	c.json(await c.var.mailboxStub.getFolders()),
);

app.post("/api/v1/mailboxes/:mailboxId/folders", async (c: AppContext) => {
	const { name } = (await c.req.json()) as { name?: string };
	const trimmedName = name?.trim();
	if (!trimmedName) {
		return c.json({ error: "请输入文件夹名称" }, 400);
	}
	// 支持中文文件夹名：若纯非 ASCII 字符导致 slugify 为空，使用随机短 ID
	const slug = slugify(trimmedName) || `folder-${crypto.randomUUID().slice(0, 8)}`;
	const f = await c.var.mailboxStub.createFolder(slug, trimmedName);
	return f
		? c.json(f, 201)
		: c.json({ error: "同名文件夹已存在" }, 409);
});

app.put("/api/v1/mailboxes/:mailboxId/folders/:id", async (c: AppContext) => {
	const { name } = (await c.req.json()) as { name: string };
	const f = await c.var.mailboxStub.updateFolder(c.req.param("id")!, name);
	return f ? c.json(f) : c.json({ error: "文件夹不存在" }, 404);
});

app.delete("/api/v1/mailboxes/:mailboxId/folders/:id", async (c: AppContext) => {
	const ok = await c.var.mailboxStub.deleteFolder(c.req.param("id")!);
	return ok
		? c.body(null, 204)
		: c.json({ error: "文件夹不存在或不允许删除" }, 400);
});

// ── 搜索 ───────────────────────────────────────────────────────────

app.get("/api/v1/mailboxes/:mailboxId/search", async (c: AppContext) => {
	const searchOpts: Record<string, unknown> = {
		query: c.req.query("query") || "",
		folder: c.req.query("folder"),
		from: c.req.query("from"),
		to: c.req.query("to"),
		subject: c.req.query("subject"),
		date_start: c.req.query("date_start"),
		date_end: c.req.query("date_end"),
		is_read: boolQuery(c, "is_read"),
		is_starred: boolQuery(c, "is_starred"),
		has_attachment: boolQuery(c, "has_attachment"),
	};
	const stub = c.var.mailboxStub as any;
	const emails = await stub.searchEmails({
		...searchOpts,
		page: intQuery(c, "page"),
		limit: intQuery(c, "limit"),
	});
	const totalCount = await stub.countSearchResults(searchOpts);
	return c.json({ emails, totalCount });
});

// ── 附件下载 ───────────────────────────────────────────────────────

app.get(
	"/api/v1/mailboxes/:mailboxId/emails/:emailId/attachments/:attachmentId",
	async (c: AppContext) => {
		const emailId = c.req.param("emailId")!;
		const attachmentId = c.req.param("attachmentId")!;
		const attachment = await c.var.mailboxStub.getAttachment(attachmentId);
		if (!attachment) return c.json({ error: "附件不存在" }, 404);
		const obj = await c.env.BUCKET.get(
			`attachments/${emailId}/${attachmentId}/${attachment.filename}`,
		);
		if (!obj) return c.json({ error: "附件文件不存在" }, 404);
		const headers = new Headers();
		headers.set("Content-Type", attachment.mimetype);
		const sanitized = attachment.filename.replace(/[\x00-\x1f"\\]/g, "_");
		headers.set(
			"Content-Disposition",
			`attachment; filename="${sanitized}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
		);
		return new Response(obj.body, { headers });
	},
);

// ── 入站收信处理（已移除内置 Agent 自动草稿逻辑） ─────────────────

const MAX_EMAIL_SIZE = 25 * 1024 * 1024;

async function streamToArrayBuffer(stream: ReadableStream, streamSize: number) {
	if (streamSize > MAX_EMAIL_SIZE) {
		throw new Error(
			`Email too large: ${streamSize} bytes exceeds ${MAX_EMAIL_SIZE} byte limit`,
		);
	}
	if (streamSize <= 0) {
		throw new Error(`Invalid stream size: ${streamSize}`);
	}
	const result = new Uint8Array(streamSize);
	let bytesRead = 0;
	const reader = stream.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (bytesRead + value.length > streamSize) {
			reader.cancel();
			throw new Error("Stream exceeds declared size");
		}
		result.set(value, bytesRead);
		bytesRead += value.length;
	}
	return result;
}

async function receiveEmail(
	event: { raw: ReadableStream; rawSize: number },
	env: Env,
	_ctx: ExecutionContext,
) {
	const rawEmail = await streamToArrayBuffer(event.raw, event.rawSize);
	const parsedEmail = await new PostalMime().parse(rawEmail);

	if (!parsedEmail.to?.length || !parsedEmail.to[0].address) {
		throw new Error("received email with empty to");
	}

	const allowedAddresses = ((env.EMAIL_ADDRESSES ?? []) as string[]).map((a) =>
		a.toLowerCase(),
	);
	const configuredDomains = getConfiguredDomains(env);
	const allRecipients = parsedEmail.to
		.map((t) => t.address?.toLowerCase())
		.filter(Boolean) as string[];
	const ccRecipients = (parsedEmail.cc || [])
		.map((e) => e.address?.toLowerCase())
		.filter(Boolean) as string[];
	const bccRecipients = (parsedEmail.bcc || [])
		.map((e) => e.address?.toLowerCase())
		.filter(Boolean) as string[];

	// 收集所有可能的收件人（按 To -> Cc -> Bcc 顺序去重），支持多人收件或抄送命中本域邮箱
	const candidateRecipients = Array.from(
		new Set([...allRecipients, ...ccRecipients, ...bccRecipients]),
	).filter((addr) => {
		if (allowedAddresses.length > 0 && !allowedAddresses.includes(addr)) {
			return false;
		}
		if (configuredDomains.length > 0) {
			const domain = addr.split("@")[1];
			return Boolean(domain && configuredDomains.includes(domain));
		}
		return true;
	});

	if (candidateRecipients.length === 0) {
		console.log("Ignoring email: no recipient matches configured DOMAINS / EMAIL_ADDRESSES.");
		return;
	}

	const authStub = getAuthStub(env);
	const targetMailboxes: string[] = [];
	for (const addr of candidateRecipients) {
		const user = await authStub.getUser(addr);
		if (user?.disabled) {
			console.log(`Ignoring email for ${addr}: account is disabled`);
			continue;
		}
		const hasR2Config = Boolean(await env.BUCKET.head(`mailboxes/${addr}.json`));
		if (user || hasR2Config) {
			targetMailboxes.push(addr);
		}
	}

	if (targetMailboxes.length === 0) {
		console.log(
			`Ignoring email for ${candidateRecipients.join(", ")}: no matching mailbox exists`,
		);
		return;
	}

	const extractMsgId = (s: string) => {
		const m = s.match(/<([^>]+)>/);
		return m ? m[1] : s.trim().split(/\s+/)[0];
	};
	const inReplyTo = parsedEmail.inReplyTo
		? extractMsgId(parsedEmail.inReplyTo)
		: null;
	const emailReferences = parsedEmail.references
		? parsedEmail.references.split(/\s+/).filter(Boolean).map(extractMsgId)
		: [];
	const originalMessageId = parsedEmail.messageId
		? extractMsgId(parsedEmail.messageId)
		: null;

	for (const mailboxId of targetMailboxes) {
		const messageId = crypto.randomUUID();
		const stub = getMailboxStub(env, mailboxId);

		const attachmentData: StoredAttachment[] = [];
		if (parsedEmail.attachments) {
			for (const att of parsedEmail.attachments) {
				const attId = crypto.randomUUID();
				const filename = (att.filename || "untitled").replace(
					/[\/\\:*?"<>|\x00-\x1f]/g,
					"_",
				);
				await env.BUCKET.put(
					`attachments/${messageId}/${attId}/${filename}`,
					att.content,
				);
				attachmentData.push({
					id: attId,
					email_id: messageId,
					filename,
					mimetype: att.mimeType,
					size:
						typeof att.content === "string"
							? att.content.length
							: att.content.byteLength,
					content_id: att.contentId || null,
					disposition: att.disposition || "attachment",
				});
			}
		}

		let threadId = emailReferences[0] || inReplyTo || messageId;
		if (!inReplyTo && emailReferences.length === 0) {
			const subjectThread = await (stub as any).findThreadBySubject(
				parsedEmail.subject || "",
				parsedEmail.from?.address || undefined,
			);
			if (subjectThread) threadId = subjectThread;
		}

		await stub.createEmail(
			Folders.INBOX,
			{
				id: messageId,
				subject: parsedEmail.subject || "",
				sender: (parsedEmail.from?.address || "").toLowerCase(),
				recipient: allRecipients.join(", "),
				cc: ccRecipients.join(", ") || null,
				bcc: bccRecipients.join(", ") || null,
				date: new Date().toISOString(),
				body: parsedEmail.html || parsedEmail.text || "",
				in_reply_to: inReplyTo,
				email_references:
					emailReferences.length > 0 ? JSON.stringify(emailReferences) : null,
				thread_id: threadId,
				message_id: originalMessageId,
				raw_headers: JSON.stringify(parsedEmail.headers),
			},
			attachmentData,
		);
	}
}

export { app, receiveEmail };
