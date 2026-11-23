// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { getAuthStub, type PublicUser } from "../auth";
import type { Env } from "../types";

export const SESSION_COOKIE_NAME = "agentic_inbox_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 天

export type AuthVariables = {
	user: PublicUser;
	sessionToken: string;
};

export type AuthContext = {
	Bindings: Env;
	Variables: AuthVariables;
};

/** 写入登录 Session Cookie（HttpOnly + SameSite=Lax，HTTPS 下自动加 Secure） */
export function setSessionCookie(c: Context, token: string) {
	const isHttps = c.req.url.startsWith("https://");
	setCookie(c, SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: isHttps,
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_MAX_AGE_SECONDS,
	});
}

/** 清除登录 Session Cookie */
export function clearSessionCookie(c: Context) {
	const isHttps = c.req.url.startsWith("https://");
	deleteCookie(c, SESSION_COOKIE_NAME, {
		httpOnly: true,
		secure: isHttps,
		sameSite: "Lax",
		path: "/",
	});
}

/** 获取当前请求的 Session Cookie 原始值 */
export function getSessionToken(c: Context): string | undefined {
	return getCookie(c, SESSION_COOKIE_NAME);
}

/**
 * 校验 Web 登录态中间件
 * 未登录或会话失效时返回 401
 */
export const requireAuth = createMiddleware<AuthContext>(async (c, next) => {
	const token = getSessionToken(c);
	if (!token) {
		return c.json({ error: "请先登录" }, 401);
	}

	const authStub = getAuthStub(c.env);
	const user = await authStub.validateSession(token);
	if (!user) {
		clearSessionCookie(c);
		return c.json({ error: "登录已过期，请重新登录" }, 401);
	}

	c.set("user", user);
	c.set("sessionToken", token);
	await next();
});

/**
 * 校验管理员权限中间件（需在 requireAuth 之后使用）
 */
export const requireAdmin = createMiddleware<AuthContext>(async (c, next) => {
	const user = c.var.user;
	if (!user || user.role !== "admin") {
		return c.json({ error: "仅管理员可执行此操作" }, 403);
	}
	await next();
});
