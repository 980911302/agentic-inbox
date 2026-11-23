// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * MCP 邮件工具的核心业务逻辑
 * 所有工具函数均由服务端注入已鉴权的唯一 mailboxId，防止越权访问其他邮箱
 */

import { Folders } from "../../shared/folders";
import { sendEmail } from "../email-sender";
import type { Env } from "../types";
import {
	buildQuotedReplyBlock,
	buildReferencesChain,
	buildThreadingHeaders,
	generateMessageId,
	getFullEmail,
	getFullThread,
	getMailboxStub,
	textToHtml,
} from "./email-helpers";
import type { EmailFull } from "./schemas";

// Base DO stub 类型未包含的方法补充声明
type MailboxSearchStub = {
	searchEmails: (options: {
		query: string;
		folder?: string;
	}) => Promise<unknown>;
};

type RateLimitStub = {
	checkSendRateLimit: () => Promise<string | null>;
};

// ── get_mailbox_info ───────────────────────────────────────────────

export async function toolGetMailboxInfo(env: Env, mailboxId: string) {
	const stub = getMailboxStub(env, mailboxId);
	const folders = await stub.getFolders();
	let settings: Record<string, unknown> = {};
	const obj = await env.BUCKET.get(`mailboxes/${mailboxId}.json`);
	if (obj) {
		try {
			settings = (await obj.json()) as Record<string, unknown>;
		} catch {
			// 忽略异常配置
		}
	}
	return {
		email: mailboxId,
		fromName:
			typeof settings.fromName === "string" && settings.fromName
				? settings.fromName
				: mailboxId.split("@")[0],
		folders,
	};
}

// ── list_emails ────────────────────────────────────────────────────

export async function toolListEmails(
	env: Env,
	mailboxId: string,
	params: { folder: string; limit: number; page: number },
) {
	const stub = getMailboxStub(env, mailboxId);
	return stub.getEmails({
		folder: params.folder,
		limit: params.limit,
		page: params.page,
		sortColumn: "date",
		sortDirection: "DESC",
	});
}

// ── get_email ──────────────────────────────────────────────────────

export async function toolGetEmail(
	env: Env,
	mailboxId: string,
	emailId: string,
) {
	const stub = getMailboxStub(env, mailboxId);
	const email = await getFullEmail(stub, emailId);
	if (!email) return { error: "邮件不存在" };
	return email;
}

// ── get_thread ─────────────────────────────────────────────────────

export async function toolGetThread(
	env: Env,
	mailboxId: string,
	threadId: string,
) {
	const stub = getMailboxStub(env, mailboxId);
	return getFullThread(stub, threadId);
}

// ── search_emails ──────────────────────────────────────────────────

export async function toolSearchEmails(
	env: Env,
	mailboxId: string,
	params: { query: string; folder?: string },
) {
	const stub = getMailboxStub(env, mailboxId);
	return (stub as unknown as MailboxSearchStub).searchEmails({
		query: params.query,
		folder: params.folder,
	});
}

// ── draft_reply ────────────────────────────────────────────────────

export async function toolDraftReply(
	env: Env,
	mailboxId: string,
	params: {
		originalEmailId: string;
		to: string;
		subject: string;
		body: string;
		isPlainText?: boolean;
	},
): Promise<
	| { status: "draft_saved"; draftId: string; message: string; draft: Record<string, string> }
	| { error: string }
> {
	const stub = getMailboxStub(env, mailboxId);

	let processedBody = params.body.trim();
	if (params.isPlainText) {
		processedBody = textToHtml(processedBody);
	}

	const draftId = crypto.randomUUID();
	const original = (await stub.getEmail(params.originalEmailId)) as EmailFull | null;
	const threadId = original?.thread_id || params.originalEmailId;

	const quotedBlock = original
		? buildQuotedReplyBlock({
				date: original.date,
				sender: original.sender || params.to,
				body: original.body ?? undefined,
			})
		: "";
	const bodyHtml = processedBody + quotedBlock;

	await stub.createEmail(
		Folders.DRAFT,
		{
			id: draftId,
			subject: params.subject,
			sender: mailboxId.toLowerCase(),
			recipient: params.to.toLowerCase(),
			date: new Date().toISOString(),
			body: bodyHtml,
			in_reply_to: params.originalEmailId,
			email_references: null,
			thread_id: threadId,
		},
		[],
	);

	return {
		status: "draft_saved",
		draftId,
		message: "回复草稿已保存到草稿箱。",
		draft: {
			originalEmailId: params.originalEmailId,
			to: params.to,
			subject: params.subject,
			body: params.isPlainText ? params.body.trim() : bodyHtml,
		},
	};
}

// ── draft_email (新建草稿) ─────────────────────────────────────────

export async function toolDraftEmail(
	env: Env,
	mailboxId: string,
	params: {
		to: string;
		subject: string;
		body: string;
		isPlainText?: boolean;
		in_reply_to?: string;
		thread_id?: string;
	},
): Promise<
	| { status: string; draftId: string; threadId?: string; message: string; draft?: Record<string, string> }
	| { error: string }
> {
	const stub = getMailboxStub(env, mailboxId);

	let processedBody = params.body.trim();
	if (params.isPlainText) {
		processedBody = textToHtml(processedBody);
	}

	const draftId = crypto.randomUUID();

	let resolvedThreadId = params.thread_id;
	if (!resolvedThreadId && params.in_reply_to) {
		const original = (await stub.getEmail(params.in_reply_to)) as EmailFull | null;
		resolvedThreadId = original?.thread_id || params.in_reply_to;
	}
	if (!resolvedThreadId) {
		resolvedThreadId = draftId;
	}

	await stub.createEmail(
		Folders.DRAFT,
		{
			id: draftId,
			subject: params.subject,
			sender: mailboxId.toLowerCase(),
			recipient: (params.to || "").toLowerCase(),
			date: new Date().toISOString(),
			body: processedBody,
			in_reply_to: params.in_reply_to || null,
			email_references: null,
			thread_id: resolvedThreadId,
		},
		[],
	);

	return {
		status: "draft_saved",
		draftId,
		threadId: resolvedThreadId,
		message: "草稿已保存到草稿箱。",
		draft: {
			to: params.to,
			subject: params.subject,
			body: params.isPlainText ? params.body.trim() : processedBody,
		},
	};
}

// ── update_draft ───────────────────────────────────────────────────

export async function toolUpdateDraft(
	env: Env,
	mailboxId: string,
	params: {
		draftId: string;
		to?: string;
		subject?: string;
		bodyHtml?: string;
	},
): Promise<
	| { status: string; newDraftId: string; oldDraftId: string; message: string }
	| { error: string }
> {
	const stub = getMailboxStub(env, mailboxId);

	const oldDraft = (await stub.getEmail(params.draftId)) as EmailFull | null;
	if (!oldDraft) {
		return { error: "草稿不存在" };
	}

	const newDraftId = crypto.randomUUID();
	const nextBody = params.bodyHtml ?? oldDraft.body ?? "";

	await stub.deleteEmail(params.draftId);
	await stub.createEmail(
		Folders.DRAFT,
		{
			id: newDraftId,
			subject: params.subject ?? oldDraft.subject,
			sender: mailboxId.toLowerCase(),
			recipient: (params.to ?? oldDraft.recipient).toLowerCase(),
			date: new Date().toISOString(),
			body: nextBody,
			in_reply_to: oldDraft.in_reply_to || null,
			email_references: oldDraft.email_references || null,
			thread_id: oldDraft.thread_id || newDraftId,
		},
		[],
	);

	return {
		status: "draft_updated",
		newDraftId,
		oldDraftId: params.draftId,
		message: "草稿已更新。",
	};
}

// ── mark_email_read ────────────────────────────────────────────────

export async function toolMarkEmailRead(
	env: Env,
	mailboxId: string,
	emailId: string,
	read: boolean,
) {
	const stub = getMailboxStub(env, mailboxId);
	await stub.updateEmail(emailId, { read });
	return { status: "updated", emailId, read };
}

// ── move_email ─────────────────────────────────────────────────────

export async function toolMoveEmail(
	env: Env,
	mailboxId: string,
	emailId: string,
	folderId: string,
) {
	const stub = getMailboxStub(env, mailboxId);
	const success = await stub.moveEmail(emailId, folderId);
	if (success) {
		return { status: "moved", emailId, folder: folderId };
	}
	return { error: "移动邮件失败，请检查目标文件夹是否存在" };
}

// ── delete_email ───────────────────────────────────────────────────

export async function toolDeleteEmail(
	env: Env,
	mailboxId: string,
	emailId: string,
) {
	const stub = getMailboxStub(env, mailboxId);
	const attachments = await stub.deleteEmail(emailId);
	if (attachments === null) {
		return { error: "邮件不存在", emailId };
	}
	// 同步清理 R2 中的附件文件
	if (attachments.length > 0) {
		await env.BUCKET.delete(
			attachments.map(
				(att: { id: string; filename: string }) =>
					`attachments/${emailId}/${att.id}/${att.filename}`,
			),
		);
	}
	return { status: "deleted", emailId };
}

// ── send_reply ─────────────────────────────────────────────────────

export async function toolSendReply(
	env: Env,
	mailboxId: string,
	params: {
		originalEmailId: string;
		to: string;
		subject: string;
		bodyHtml: string;
	},
): Promise<
	| { status: "sent"; messageId: string; message: string }
	| { error: string }
> {
	const stub = getMailboxStub(env, mailboxId);

	const rateLimitError = await (stub as unknown as RateLimitStub).checkSendRateLimit();
	if (rateLimitError) {
		return { error: rateLimitError };
	}

	const originalEmail = (await stub.getEmail(params.originalEmailId)) as EmailFull | null;
	if (!originalEmail) {
		return { error: "原邮件不存在" };
	}

	const { originalMsgId, references, threadId } = buildReferencesChain(originalEmail);
	const fromDomain = mailboxId.split("@")[1];
	if (!fromDomain) throw new Error("无效的发件邮箱地址");
	const { messageId, outgoingMessageId } = generateMessageId(fromDomain);

	const quotedBlock = buildQuotedReplyBlock({
		date: originalEmail.date,
		sender: originalEmail.sender || params.to,
		body: originalEmail.body ?? undefined,
	});
	const fullBodyHtml = params.bodyHtml + quotedBlock;

	try {
		await sendEmail(env.EMAIL, {
			to: params.to,
			from: mailboxId,
			subject: params.subject,
			html: fullBodyHtml,
			headers: buildThreadingHeaders(originalMsgId, references),
		});
	} catch (e) {
		console.error("Email send failed:", (e as Error).message);
		return { error: `发送回复失败: ${(e as Error).message}` };
	}

	await stub.createEmail(
		Folders.SENT,
		{
			id: messageId,
			subject: params.subject,
			sender: mailboxId.toLowerCase(),
			recipient: params.to.toLowerCase(),
			date: new Date().toISOString(),
			body: fullBodyHtml,
			in_reply_to: originalMsgId,
			email_references:
				references.length > 0 ? JSON.stringify(references) : null,
			thread_id: threadId,
			message_id: outgoingMessageId,
		},
		[],
	);

	return { status: "sent", messageId, message: `回复已发送至 ${params.to}` };
}

// ── send_email ─────────────────────────────────────────────────────

export async function toolSendEmail(
	env: Env,
	mailboxId: string,
	params: {
		to: string;
		subject: string;
		bodyHtml: string;
	},
): Promise<
	| { status: "sent"; messageId: string; message: string }
	| { error: string }
> {
	const stub = getMailboxStub(env, mailboxId);

	const rateLimitError = await (stub as unknown as RateLimitStub).checkSendRateLimit();
	if (rateLimitError) {
		return { error: rateLimitError };
	}

	const fromDomain = mailboxId.split("@")[1];
	if (!fromDomain) throw new Error("无效的发件邮箱地址");
	const { messageId, outgoingMessageId } = generateMessageId(fromDomain);

	try {
		await sendEmail(env.EMAIL, {
			to: params.to,
			from: mailboxId,
			subject: params.subject,
			html: params.bodyHtml,
		});
	} catch (e) {
		console.error("Email send failed:", (e as Error).message);
		return { error: `发送邮件失败: ${(e as Error).message}` };
	}

	await stub.createEmail(
		Folders.SENT,
		{
			id: messageId,
			subject: params.subject,
			sender: mailboxId.toLowerCase(),
			recipient: params.to.toLowerCase(),
			date: new Date().toISOString(),
			body: params.bodyHtml,
			in_reply_to: null,
			email_references: null,
			thread_id: messageId,
			message_id: outgoingMessageId,
		},
		[],
	);

	return { status: "sent", messageId, message: `邮件已发送至 ${params.to}` };
}
