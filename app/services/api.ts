// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type {
	AdminSettings,
	AdminUsersResponse,
	ApiKeyInfo,
	AuthStatus,
	AuthUser,
	CreatedApiKey,
	Email,
	Folder,
	Mailbox,
} from "~/types";

const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
	status: number;
	body: Record<string, unknown>;

	constructor(status: number, body: Record<string, unknown>) {
		super((body.error as string) || `请求失败 (${status})`);
		this.name = "ApiError";
		this.status = status;
		this.body = body;
	}
}

async function request<T>(
	url: string,
	options: RequestInit = {},
): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	const signal = options.signal
		? AbortSignal.any([options.signal, controller.signal])
		: controller.signal;

	try {
		const res = await fetch(url, {
			...options,
			credentials: "include",
			signal,
			headers: {
				"Content-Type": "application/json",
				...(options.headers as Record<string, string>),
			},
		});

		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new ApiError(res.status, body as Record<string, unknown>);
		}

		if (res.status === 204) return undefined as T;

		const contentType = res.headers.get("content-type") ?? "";
		if (contentType.includes("application/json")) {
			return res.json() as Promise<T>;
		}
		return res.blob() as unknown as T;
	} finally {
		clearTimeout(timeout);
	}
}

function get<T>(
	url: string,
	opts?: {
		params?: Record<string, string>;
		responseType?: string;
		signal?: AbortSignal;
	},
) {
	const query = opts?.params ? `?${new URLSearchParams(opts.params)}` : "";
	return request<T>(`${url}${query}`, {
		method: "GET",
		signal: opts?.signal,
		...(opts?.responseType === "blob" ? { headers: { Accept: "*/*" } } : {}),
	});
}

function post<T>(
	url: string,
	body?: unknown,
	opts?: { signal?: AbortSignal },
) {
	return request<T>(url, {
		method: "POST",
		signal: opts?.signal,
		body: body != null ? JSON.stringify(body) : undefined,
	});
}

function put<T>(url: string, body?: unknown) {
	return request<T>(url, {
		method: "PUT",
		body: body != null ? JSON.stringify(body) : undefined,
	});
}

function del<T>(url: string) {
	return request<T>(url, { method: "DELETE" });
}

interface EmailListResponse {
	emails: Email[];
	totalCount: number;
}

const enc = (s: string) => encodeURIComponent(s);

const api = {
	// 系统配置
	getConfig: () =>
		get<{ domains: string[]; emailAddresses: string[] }>("/api/v1/config"),

	// 认证与会话
	getAuthStatus: () => get<AuthStatus>("/api/v1/auth/status"),
	setupAdmin: (data: { password: string; displayName?: string }) =>
		post<{ user: AuthUser }>("/api/v1/auth/setup", data),
	login: (data: { email: string; password: string }) =>
		post<{ user: AuthUser }>("/api/v1/auth/login", data),
	register: (data: {
		prefix: string;
		domain: string;
		displayName?: string;
		password: string;
	}) => post<{ user: AuthUser }>("/api/v1/auth/register", data),
	logout: () => post<{ ok: boolean }>("/api/v1/auth/logout"),
	getMe: () => get<{ user: AuthUser }>("/api/v1/auth/me"),
	changePassword: (data: { currentPassword: string; newPassword: string }) =>
		put<{ ok: boolean }>("/api/v1/auth/password", data),

	// MCP 密钥管理
	listApiKeys: () => get<{ keys: ApiKeyInfo[] }>("/api/v1/keys"),
	createApiKey: (name: string) => post<CreatedApiKey>("/api/v1/keys", { name }),
	deleteApiKey: (id: string) => del<void>(`/api/v1/keys/${enc(id)}`),

	// 管理员接口
	getAdminSettings: () => get<AdminSettings>("/api/v1/admin/settings"),
	updateAdminSettings: (settings: AdminSettings) =>
		put<AdminSettings>("/api/v1/admin/settings", settings),
	listAdminUsers: () => get<AdminUsersResponse>("/api/v1/admin/users"),
	createAdminUser: (data: {
		prefix?: string;
		domain?: string;
		email?: string;
		displayName?: string;
		password: string;
	}) => post<{ user: AuthUser }>("/api/v1/admin/users", data),
	updateAdminUser: (
		email: string,
		data: { displayName?: string; disabled?: boolean; password?: string },
	) => put<{ user: AuthUser }>(`/api/v1/admin/users/${enc(email)}`, data),
	deleteAdminUser: (email: string) =>
		del<void>(`/api/v1/admin/users/${enc(email)}`),

	// 邮箱（严格绑定当前账户）
	listMailboxes: () => get<Mailbox[]>("/api/v1/mailboxes"),
	getMailbox: (mailboxId: string) =>
		get<Mailbox>(`/api/v1/mailboxes/${enc(mailboxId)}`),
	updateMailbox: (mailboxId: string, settings: unknown) =>
		put<Mailbox>(`/api/v1/mailboxes/${enc(mailboxId)}`, { settings }),

	// 邮件
	listEmails: (
		mailboxId: string,
		params: Record<string, string>,
		opts?: { signal?: AbortSignal },
	) =>
		get<EmailListResponse | Email[]>(
			`/api/v1/mailboxes/${enc(mailboxId)}/emails`,
			{ params, signal: opts?.signal },
		),
	sendEmail: (mailboxId: string, email: unknown) =>
		post<void>(`/api/v1/mailboxes/${enc(mailboxId)}/emails`, email),
	getEmail: (mailboxId: string, id: string, opts?: { signal?: AbortSignal }) =>
		get<Email>(`/api/v1/mailboxes/${enc(mailboxId)}/emails/${enc(id)}`, {
			signal: opts?.signal,
		}),
	updateEmail: (mailboxId: string, id: string, data: unknown) =>
		put<Email>(`/api/v1/mailboxes/${enc(mailboxId)}/emails/${enc(id)}`, data),
	deleteEmail: (mailboxId: string, id: string) =>
		del<void>(`/api/v1/mailboxes/${enc(mailboxId)}/emails/${enc(id)}`),
	moveEmail: (mailboxId: string, id: string, folderId: string) =>
		post<void>(`/api/v1/mailboxes/${enc(mailboxId)}/emails/${enc(id)}/move`, {
			folderId,
		}),
	getThread: (
		mailboxId: string,
		threadId: string,
		opts?: { signal?: AbortSignal },
	) =>
		get<Email[]>(
			`/api/v1/mailboxes/${enc(mailboxId)}/threads/${enc(threadId)}`,
			{ signal: opts?.signal },
		),
	markThreadRead: (mailboxId: string, threadId: string) =>
		post<void>(
			`/api/v1/mailboxes/${enc(mailboxId)}/threads/${enc(threadId)}/read`,
		),
	getAttachment: (mailboxId: string, emailId: string, attachmentId: string) =>
		get<Blob>(
			`/api/v1/mailboxes/${enc(mailboxId)}/emails/${enc(emailId)}/attachments/${enc(attachmentId)}`,
			{ responseType: "blob" },
		),
	saveDraft: (
		mailboxId: string,
		draft: {
			to?: string;
			cc?: string;
			bcc?: string;
			subject?: string;
			body: string;
			in_reply_to?: string;
			thread_id?: string;
			draft_id?: string;
		},
	) =>
		post<{ id: string }>(`/api/v1/mailboxes/${enc(mailboxId)}/drafts`, draft),
	replyToEmail: (mailboxId: string, emailId: string, email: unknown) =>
		post<void>(
			`/api/v1/mailboxes/${enc(mailboxId)}/emails/${enc(emailId)}/reply`,
			email,
		),
	forwardEmail: (mailboxId: string, emailId: string, email: unknown) =>
		post<void>(
			`/api/v1/mailboxes/${enc(mailboxId)}/emails/${enc(emailId)}/forward`,
			email,
		),

	// 文件夹
	listFolders: (mailboxId: string) =>
		get<Folder[]>(`/api/v1/mailboxes/${enc(mailboxId)}/folders`),
	createFolder: (mailboxId: string, name: string) =>
		post<Folder>(`/api/v1/mailboxes/${enc(mailboxId)}/folders`, { name }),
	updateFolder: (mailboxId: string, id: string, name: string) =>
		put<Folder>(`/api/v1/mailboxes/${enc(mailboxId)}/folders/${enc(id)}`, {
			name,
		}),
	deleteFolder: (mailboxId: string, id: string) =>
		del<void>(`/api/v1/mailboxes/${enc(mailboxId)}/folders/${enc(id)}`),

	// 搜索
	searchEmails: (mailboxId: string, params: Record<string, string>) =>
		get<EmailListResponse | Email[]>(
			`/api/v1/mailboxes/${enc(mailboxId)}/search`,
			{ params },
		),
};

export default api;
