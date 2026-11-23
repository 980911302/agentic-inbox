// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * 账户表：账户与邮箱严格 1 对 1 绑定（主键 email 即邮箱地址）
 */
export const users = sqliteTable("users", {
	email: text("email").primaryKey(),
	display_name: text("display_name").notNull(),
	password_hash: text("password_hash").notNull(),
	role: text("role").notNull().default("user"), // "admin" | "user"
	disabled: integer("disabled").notNull().default(0),
	created_at: text("created_at").notNull(),
	updated_at: text("updated_at").notNull(),
});

/**
 * Web 登录会话表：存储随机 Session Token 的 SHA-256 哈希
 */
export const sessions = sqliteTable("sessions", {
	token_hash: text("token_hash").primaryKey(),
	user_email: text("user_email")
		.notNull()
		.references(() => users.email, { onDelete: "cascade" }),
	expires_at: text("expires_at").notNull(),
	created_at: text("created_at").notNull(),
});

/**
 * MCP API 密钥表：每个账户可创建多个独立密钥，仅操作本账户对应的邮箱
 */
export const apiKeys = sqliteTable("api_keys", {
	id: text("id").primaryKey(),
	user_email: text("user_email")
		.notNull()
		.references(() => users.email, { onDelete: "cascade" }),
	name: text("name").notNull(),
	key_prefix: text("key_prefix").notNull(),
	key_hash: text("key_hash").notNull().unique(),
	last_used_at: text("last_used_at"),
	created_at: text("created_at").notNull(),
});

/**
 * 系统配置表（如是否开放注册 allow_registration）
 */
export const systemSettings = sqliteTable("system_settings", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
});
