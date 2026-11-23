// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * 邮箱归属校验与 MailboxDO 实例注入中间件
 * 严格执行 1 账户 = 1 邮箱隔离，禁止越权访问其他用户的邮箱
 */
import { createMiddleware } from "hono/factory";
import type { PublicUser } from "../auth";
import type { MailboxDO } from "../durableObject";
import type { Env } from "../types";

export type MailboxContext = {
	Bindings: Env;
	Variables: {
		user: PublicUser;
		sessionToken: string;
		mailboxStub: DurableObjectStub<MailboxDO>;
	};
};

export const requireMailbox = createMiddleware<MailboxContext>(async (c, next) => {
	const rawId = c.req.param("mailboxId");
	if (!rawId) return c.json({ error: "缺少邮箱标识" }, 400);
	const mailboxId = decodeURIComponent(rawId).toLowerCase();

	// 严格校验 1:1 归属关系：仅允许访问当前登录账户自己的邮箱
	const user = c.var.user;
	if (!user || user.email.toLowerCase() !== mailboxId) {
		return c.json({ error: "无权访问该邮箱" }, 403);
	}

	// 验证邮箱配置存在（兼容自动初始化场景）
	const key = `mailboxes/${mailboxId}.json`;
	const obj = await c.env.BUCKET.head(key);
	if (!obj) {
		const defaultSettings = {
			fromName: user.displayName || mailboxId.split("@")[0],
			forwarding: { enabled: false, email: "" },
			signature: { enabled: false, text: "" },
			autoReply: { enabled: false, subject: "", message: "" },
		};
		await c.env.BUCKET.put(key, JSON.stringify(defaultSettings));
	}

	// 获取当前邮箱对应的 Durable Object Stub
	const ns = c.env.MAILBOX;
	const id = ns.idFromName(mailboxId);
	const stub = ns.get(id);

	c.set("mailboxStub", stub);
	await next();
});
