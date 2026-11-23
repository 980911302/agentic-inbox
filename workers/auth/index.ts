// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { DurableObject } from "cloudflare:workers";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/durable-sqlite";
import * as authSchema from "../db/auth-schema";
import { applyMigrations, type Migration } from "../durableObject/migrations";
import {
	generateApiKey,
	generateSecureToken,
	hashPassword,
	sha256Hex,
} from "../lib/crypto";
import { getMailboxStub } from "../lib/email-helpers";
import type { Env } from "../types";

export type UserRole = "admin" | "user";

export interface PublicUser {
	email: string;
	displayName: string;
	role: UserRole;
	disabled: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface AdminUserItem extends PublicUser {
	keyCount: number;
}

export interface ApiKeyInfo {
	id: string;
	name: string;
	keyPrefix: string;
	lastUsedAt: string | null;
	createdAt: string;
}

export interface SystemSettings {
	allowRegistration: boolean;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

const authMigrations: Migration[] = [
	{
		name: "1_init_auth_tables",
		sql: `
			CREATE TABLE IF NOT EXISTS users (
				email TEXT PRIMARY KEY,
				display_name TEXT NOT NULL,
				password_hash TEXT NOT NULL,
				role TEXT NOT NULL DEFAULT 'user',
				disabled INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS sessions (
				token_hash TEXT PRIMARY KEY,
				user_email TEXT NOT NULL,
				expires_at TEXT NOT NULL,
				created_at TEXT NOT NULL,
				FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
			);

			CREATE INDEX IF NOT EXISTS idx_sessions_user_email ON sessions(user_email);
			CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

			CREATE TABLE IF NOT EXISTS api_keys (
				id TEXT PRIMARY KEY,
				user_email TEXT NOT NULL,
				name TEXT NOT NULL,
				key_prefix TEXT NOT NULL,
				key_hash TEXT NOT NULL UNIQUE,
				last_used_at TEXT,
				created_at TEXT NOT NULL,
				FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
			);

			CREATE INDEX IF NOT EXISTS idx_api_keys_user_email ON api_keys(user_email);

			CREATE TABLE IF NOT EXISTS system_settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			);

			INSERT OR IGNORE INTO system_settings (key, value) VALUES ('allow_registration', 'false');
		`,
	},
];

/**
 * 全局认证与账号管理 Durable Object（基于 SQLite）
 * 统一管理 1:1 邮箱账户、Web 登录会话、MCP API 密钥以及系统级配置
 */
export class AuthDO extends DurableObject<Env> {
	declare __DURABLE_OBJECT_BRAND: never;
	db: ReturnType<typeof drizzle>;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.ctx.storage.sql.exec("PRAGMA foreign_keys = ON;");
		this.db = drizzle(this.ctx.storage, { schema: authSchema });
		applyMigrations(this.ctx.storage.sql, authMigrations, this.ctx.storage);
	}

	// ── 系统设置 ───────────────────────────────────────────────────

	async hasAdmin(): Promise<boolean> {
		const row = this.db
			.select({ email: authSchema.users.email })
			.from(authSchema.users)
			.where(eq(authSchema.users.role, "admin"))
			.limit(1)
			.get();
		return Boolean(row);
	}

	async getSystemSettings(): Promise<SystemSettings> {
		const row = this.db
			.select({ value: authSchema.systemSettings.value })
			.from(authSchema.systemSettings)
			.where(eq(authSchema.systemSettings.key, "allow_registration"))
			.limit(1)
			.get();
		return {
			allowRegistration: row?.value === "true",
		};
	}

	async updateSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
		if (typeof settings.allowRegistration === "boolean") {
			const val = settings.allowRegistration ? "true" : "false";
			this.db
				.insert(authSchema.systemSettings)
				.values({ key: "allow_registration", value: val })
				.onConflictDoUpdate({
					target: authSchema.systemSettings.key,
					set: { value: val },
				})
				.run();
		}
		return this.getSystemSettings();
	}

	// ── 账户管理 ───────────────────────────────────────────────────

	private toPublicUser(row: typeof authSchema.users.$inferSelect): PublicUser {
		return {
			email: row.email,
			displayName: row.display_name,
			role: (row.role === "admin" ? "admin" : "user") as UserRole,
			disabled: Boolean(row.disabled),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	async getUser(email: string): Promise<PublicUser | null> {
		const normalized = email.trim().toLowerCase();
		const row = this.db
			.select()
			.from(authSchema.users)
			.where(eq(authSchema.users.email, normalized))
			.limit(1)
			.get();
		return row ? this.toPublicUser(row) : null;
	}

	async getUserForAuth(email: string): Promise<{
		email: string;
		displayName: string;
		passwordHash: string;
		role: UserRole;
		disabled: boolean;
	} | null> {
		const normalized = email.trim().toLowerCase();
		const row = this.db
			.select()
			.from(authSchema.users)
			.where(eq(authSchema.users.email, normalized))
			.limit(1)
			.get();
		if (!row) return null;
		return {
			email: row.email,
			displayName: row.display_name,
			passwordHash: row.password_hash,
			role: (row.role === "admin" ? "admin" : "user") as UserRole,
			disabled: Boolean(row.disabled),
		};
	}

	async listUsers(): Promise<AdminUserItem[]> {
		const rows = [
			...this.ctx.storage.sql.exec(`
				SELECT
					u.email,
					u.display_name,
					u.role,
					u.disabled,
					u.created_at,
					u.updated_at,
					COUNT(k.id) AS key_count
				FROM users u
				LEFT JOIN api_keys k ON k.user_email = u.email
				GROUP BY u.email
				ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.created_at DESC
			`),
		] as Array<{
			email: string;
			display_name: string;
			role: string;
			disabled: number;
			created_at: string;
			updated_at: string;
			key_count: number;
		}>;

		return rows.map((row) => ({
			email: row.email,
			displayName: row.display_name,
			role: (row.role === "admin" ? "admin" : "user") as UserRole,
			disabled: Boolean(row.disabled),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			keyCount: Number(row.key_count || 0),
		}));
	}

	async createUser(params: {
		email: string;
		displayName: string;
		passwordHash: string;
		role?: UserRole;
	}): Promise<{ user?: PublicUser; error?: string }> {
		const normalized = params.email.trim().toLowerCase();
		const existing = this.db
			.select({ email: authSchema.users.email })
			.from(authSchema.users)
			.where(eq(authSchema.users.email, normalized))
			.limit(1)
			.get();
		if (existing) {
			return { error: "该邮箱账户已存在" };
		}

		const now = new Date().toISOString();
		const role: UserRole = params.role === "admin" ? "admin" : "user";
		const displayName = params.displayName.trim() || normalized.split("@")[0];

		this.db
			.insert(authSchema.users)
			.values({
				email: normalized,
				display_name: displayName,
				password_hash: params.passwordHash,
				role,
				disabled: 0,
				created_at: now,
				updated_at: now,
			})
			.run();

		return {
			user: {
				email: normalized,
				displayName,
				role,
				disabled: false,
				createdAt: now,
				updatedAt: now,
			},
		};
	}

	async updateUser(
		email: string,
		updates: {
			displayName?: string;
			passwordHash?: string;
			disabled?: boolean;
		},
	): Promise<PublicUser | null> {
		const normalized = email.trim().toLowerCase();
		const existing = this.db
			.select()
			.from(authSchema.users)
			.where(eq(authSchema.users.email, normalized))
			.limit(1)
			.get();
		if (!existing) return null;

		const now = new Date().toISOString();
		const patch: Partial<typeof authSchema.users.$inferInsert> = {
			updated_at: now,
		};
		if (updates.displayName !== undefined) {
			patch.display_name = updates.displayName.trim() || existing.display_name;
		}
		if (updates.passwordHash !== undefined) {
			patch.password_hash = updates.passwordHash;
		}
		if (updates.disabled !== undefined) {
			patch.disabled = updates.disabled ? 1 : 0;
		}

		this.db
			.update(authSchema.users)
			.set(patch)
			.where(eq(authSchema.users.email, normalized))
			.run();

		// 若禁用账户或重置密码，立即踢掉旧会话
		if (updates.disabled === true || updates.passwordHash !== undefined) {
			this.db
				.delete(authSchema.sessions)
				.where(eq(authSchema.sessions.user_email, normalized))
				.run();
		}

		const updated = this.db
			.select()
			.from(authSchema.users)
			.where(eq(authSchema.users.email, normalized))
			.limit(1)
			.get();
		return updated ? this.toPublicUser(updated) : null;
	}

	async deleteUser(email: string): Promise<{ ok: boolean; error?: string }> {
		const normalized = email.trim().toLowerCase();
		const existing = this.db
			.select()
			.from(authSchema.users)
			.where(eq(authSchema.users.email, normalized))
			.limit(1)
			.get();
		if (!existing) {
			return { ok: false, error: "账户不存在" };
		}
		if (existing.role === "admin") {
			return { ok: false, error: "不能删除管理员账户" };
		}

		this.ctx.storage.transactionSync(() => {
			this.db
				.delete(authSchema.sessions)
				.where(eq(authSchema.sessions.user_email, normalized))
				.run();
			this.db
				.delete(authSchema.apiKeys)
				.where(eq(authSchema.apiKeys.user_email, normalized))
				.run();
			this.db
				.delete(authSchema.users)
				.where(eq(authSchema.users.email, normalized))
				.run();
		});

		return { ok: true };
	}

	// ── 会话管理 ───────────────────────────────────────────────────

	async createSession(
		userEmail: string,
	): Promise<{ token: string; expiresAt: string }> {
		const normalized = userEmail.trim().toLowerCase();
		const token = generateSecureToken(32);
		const tokenHash = await sha256Hex(token);
		const now = new Date();
		const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

		// 顺便清理过期会话，避免表无限增长
		this.db
			.delete(authSchema.sessions)
			.where(sql`${authSchema.sessions.expires_at} < ${now.toISOString()}`)
			.run();

		this.db
			.insert(authSchema.sessions)
			.values({
				token_hash: tokenHash,
				user_email: normalized,
				expires_at: expiresAt,
				created_at: now.toISOString(),
			})
			.run();

		return { token, expiresAt };
	}

	async validateSession(rawToken: string): Promise<PublicUser | null> {
		if (!rawToken) return null;
		const tokenHash = await sha256Hex(rawToken);
		const session = this.db
			.select()
			.from(authSchema.sessions)
			.where(eq(authSchema.sessions.token_hash, tokenHash))
			.limit(1)
			.get();

		if (!session) return null;

		if (new Date(session.expires_at).getTime() <= Date.now()) {
			this.db
				.delete(authSchema.sessions)
				.where(eq(authSchema.sessions.token_hash, tokenHash))
				.run();
			return null;
		}

		const user = this.db
			.select()
			.from(authSchema.users)
			.where(eq(authSchema.users.email, session.user_email))
			.limit(1)
			.get();

		if (!user || user.disabled) {
			return null;
		}

		return this.toPublicUser(user);
	}

	async deleteSession(rawToken: string): Promise<void> {
		if (!rawToken) return;
		const tokenHash = await sha256Hex(rawToken);
		this.db
			.delete(authSchema.sessions)
			.where(eq(authSchema.sessions.token_hash, tokenHash))
			.run();
	}

	// ── MCP 密钥管理 ───────────────────────────────────────────────

	async listApiKeys(userEmail: string): Promise<ApiKeyInfo[]> {
		const normalized = userEmail.trim().toLowerCase();
		const rows = this.db
			.select({
				id: authSchema.apiKeys.id,
				name: authSchema.apiKeys.name,
				keyPrefix: authSchema.apiKeys.key_prefix,
				lastUsedAt: authSchema.apiKeys.last_used_at,
				createdAt: authSchema.apiKeys.created_at,
			})
			.from(authSchema.apiKeys)
			.where(eq(authSchema.apiKeys.user_email, normalized))
			.orderBy(desc(authSchema.apiKeys.created_at))
			.all();

		return rows;
	}

	async createApiKey(
		userEmail: string,
		name: string,
	): Promise<{ id: string; name: string; keyPrefix: string; key: string; createdAt: string }> {
		const normalized = userEmail.trim().toLowerCase();
		const { key, keyPrefix } = generateApiKey();
		const keyHash = await sha256Hex(key);
		const id = crypto.randomUUID();
		const createdAt = new Date().toISOString();
		const trimmedName = name.trim() || "未命名密钥";

		this.db
			.insert(authSchema.apiKeys)
			.values({
				id,
				user_email: normalized,
				name: trimmedName,
				key_prefix: keyPrefix,
				key_hash: keyHash,
				last_used_at: null,
				created_at: createdAt,
			})
			.run();

		return {
			id,
			name: trimmedName,
			keyPrefix,
			key,
			createdAt,
		};
	}

	async deleteApiKey(userEmail: string, keyId: string): Promise<boolean> {
		const normalized = userEmail.trim().toLowerCase();
		const existing = this.db
			.select({ id: authSchema.apiKeys.id })
			.from(authSchema.apiKeys)
			.where(
				and(
					eq(authSchema.apiKeys.id, keyId),
					eq(authSchema.apiKeys.user_email, normalized),
				),
			)
			.limit(1)
			.get();

		if (!existing) return false;

		this.db
			.delete(authSchema.apiKeys)
			.where(
				and(
					eq(authSchema.apiKeys.id, keyId),
					eq(authSchema.apiKeys.user_email, normalized),
				),
			)
			.run();
		return true;
	}

	async verifyApiKey(rawKey: string): Promise<{
		keyId: string;
		email: string;
		displayName: string;
		role: UserRole;
	} | null> {
		if (!rawKey) return null;
		const keyHash = await sha256Hex(rawKey.trim());
		const keyRow = this.db
			.select()
			.from(authSchema.apiKeys)
			.where(eq(authSchema.apiKeys.key_hash, keyHash))
			.limit(1)
			.get();

		if (!keyRow) return null;

		const user = this.db
			.select()
			.from(authSchema.users)
			.where(eq(authSchema.users.email, keyRow.user_email))
			.limit(1)
			.get();

		if (!user || user.disabled) {
			return null;
		}

		// 更新最近使用时间
		this.db
			.update(authSchema.apiKeys)
			.set({ last_used_at: new Date().toISOString() })
			.where(eq(authSchema.apiKeys.id, keyRow.id))
			.run();

		return {
			keyId: keyRow.id,
			email: user.email,
			displayName: user.display_name,
			role: (user.role === "admin" ? "admin" : "user") as UserRole,
		};
	}
}

// ── 全局辅助函数 ───────────────────────────────────────────────────

/** 获取全局唯一的 AuthDO Stub */
export function getAuthStub(env: Env): DurableObjectStub<AuthDO> {
	return env.AUTH.get(env.AUTH.idFromName("global"));
}

/** 解析环境变量中的可用域名列表 */
export function getConfiguredDomains(env: Env): string[] {
	const raw = env.DOMAINS || "";
	return raw
		.split(",")
		.map((d) => d.trim().toLowerCase())
		.filter(Boolean);
}

/** 获取管理员邮箱地址（默认 admin@<主域名>，如 admin@zll300.com） */
export function getAdminEmail(env: Env): string {
	if (env.ADMIN_EMAIL && env.ADMIN_EMAIL.includes("@")) {
		return env.ADMIN_EMAIL.trim().toLowerCase();
	}
	const domains = getConfiguredDomains(env);
	const primaryDomain = domains[0] || "zll300.com";
	return `admin@${primaryDomain}`;
}

/** 规范化登录输入：支持直接输入 "admin" 快捷登录管理员邮箱 */
export function normalizeLoginIdentifier(identifier: string, env: Env): string {
	const trimmed = identifier.trim().toLowerCase();
	if (trimmed === "admin") {
		return getAdminEmail(env);
	}
	return trimmed;
}

/**
 * 确保邮箱的 R2 配置与 MailboxDO 已初始化
 * 若线上旧版部署中已存在同名邮箱，则保留原有设置与邮件数据，不覆盖
 */
export async function ensureMailboxProvisioned(
	env: Env,
	email: string,
	displayName: string,
): Promise<void> {
	const normalized = email.trim().toLowerCase();
	const key = `mailboxes/${normalized}.json`;
	const existingObj = await env.BUCKET.get(key);

	if (existingObj) {
		try {
			const existingSettings = (await existingObj.json()) as Record<string, unknown>;
			if (!existingSettings.fromName && displayName) {
				await env.BUCKET.put(
					key,
					JSON.stringify({ ...existingSettings, fromName: displayName }),
				);
			}
		} catch {
			// 旧配置解析失败时不做破坏性覆盖
		}
	} else {
		const defaultSettings = {
			fromName: displayName || normalized.split("@")[0],
			forwarding: { enabled: false, email: "" },
			signature: { enabled: false, text: "" },
			autoReply: { enabled: false, subject: "", message: "" },
		};
		await env.BUCKET.put(key, JSON.stringify(defaultSettings));
	}

	const mailboxStub = getMailboxStub(env, normalized);
	await mailboxStub.getFolders();
}

/**
 * 若配置了 ADMIN_PASSWORD 且尚未初始化管理员，自动初始化管理员账户
 */
export async function ensureAdminSeeded(env: Env): Promise<boolean> {
	const authStub = getAuthStub(env);
	const hasAdmin = await authStub.hasAdmin();
	if (hasAdmin) return true;

	const envPassword = env.ADMIN_PASSWORD?.trim();
	if (!envPassword) {
		return false;
	}

	const adminEmail = getAdminEmail(env);
	const passwordHash = await hashPassword(envPassword);
	const res = await authStub.createUser({
		email: adminEmail,
		displayName: "管理员",
		passwordHash,
		role: "admin",
	});
	if (!res.error) {
		await ensureMailboxProvisioned(env, adminEmail, "管理员");
	}
	return true;
}
