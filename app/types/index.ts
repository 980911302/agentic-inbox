// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export type UserRole = "admin" | "user";

export interface AuthUser {
	email: string;
	displayName: string;
	role: UserRole;
	disabled?: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface AuthStatus {
	initialized: boolean;
	adminEmail: string;
	allowRegistration: boolean;
	domains: string[];
}

export interface ApiKeyInfo {
	id: string;
	name: string;
	keyPrefix: string;
	lastUsedAt: string | null;
	createdAt: string;
}

export interface CreatedApiKey {
	id: string;
	name: string;
	keyPrefix: string;
	key: string;
	createdAt: string;
}

export interface AdminUserItem extends AuthUser {
	disabled: boolean;
	createdAt: string;
	updatedAt: string;
	keyCount: number;
}

export interface AdminUsersResponse {
	users: AdminUserItem[];
	orphanMailboxes: string[];
}

export interface AdminSettings {
	allowRegistration: boolean;
}

export interface SignatureSettings {
	enabled: boolean;
	text: string;
	html?: string;
}

export interface MailboxSettings {
	fromName?: string;
	forwarding?: { enabled: boolean; email: string };
	signature?: SignatureSettings;
	autoReply?: { enabled: boolean; subject: string; message: string };
}

export interface Mailbox {
	id: string;
	email: string;
	name: string;
	settings?: MailboxSettings;
}

export interface Email {
	id: string;
	thread_id?: string | null;
	folder_id?: string | null;
	subject: string;
	sender: string;
	recipient: string;
	cc?: string;
	bcc?: string;
	date: string;
	read: boolean;
	starred: boolean;
	body?: string | null;
	in_reply_to?: string | null;
	email_references?: string | null;
	message_id?: string | null;
	raw_headers?: string | null;
	attachments?: Attachment[];
	snippet?: string | null;
	// 会话列表聚合字段
	thread_count?: number;
	thread_unread_count?: number;
	participants?: string;
	needs_reply?: boolean;
	has_draft?: boolean;
}

export interface Attachment {
	id: string;
	filename: string;
	mimetype: string;
	size: number;
	content_id?: string;
	disposition?: string;
}

export interface Folder {
	id: string;
	name: string;
	unreadCount: number;
}
