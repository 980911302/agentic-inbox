// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/** 统一维护 TanStack Query 缓存键工厂 */
export const queryKeys = {
	auth: {
		status: ["auth", "status"] as const,
		me: ["auth", "me"] as const,
	},
	apiKeys: ["api-keys"] as const,
	admin: {
		settings: ["admin", "settings"] as const,
		users: ["admin", "users"] as const,
	},
	mailboxes: {
		all: ["mailboxes"] as const,
		detail: (id: string) => ["mailboxes", id] as const,
	},
	emails: {
		list: (mailboxId: string, params: Record<string, string>) =>
			["emails", mailboxId, params] as const,
		detail: (mailboxId: string, emailId: string) =>
			["emails", mailboxId, emailId] as const,
		thread: (mailboxId: string, threadId: string) =>
			["emails", mailboxId, "thread", threadId] as const,
	},
	folders: {
		list: (mailboxId: string) => ["folders", mailboxId] as const,
	},
	search: {
		results: (mailboxId: string, query: string, page: number) =>
			["search", mailboxId, query, page] as const,
	},
	config: ["config"] as const,
};
