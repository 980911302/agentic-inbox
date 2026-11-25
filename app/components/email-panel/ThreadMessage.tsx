// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Tooltip } from "@cloudflare/kumo";
import {
	CaretDownIcon,
	CaretUpIcon,
	CodeIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import EmailAttachmentList from "~/components/EmailAttachmentList";
import EmailIframe from "~/components/EmailIframe";
import { getAvatarTone, getInitials } from "~/lib/ui-helpers";
import {
	formatDetailDate,
	formatShortDate,
	rewriteInlineImages,
	stripHtml,
} from "~/lib/utils";
import type { Email } from "~/types";

interface ThreadMessageProps {
	email: Email;
	mailboxId?: string;
	mailboxEmail?: string;
	isLast: boolean;
	isDraft?: boolean;
	isSending?: boolean;
	isExpanded: boolean;
	paperMode?: "auto" | "light" | "dark";
	onToggleExpand: () => void;
	onSendDraft?: () => void;
	onEditDraft?: () => void;
	onDeleteDraft?: () => void;
	onViewSource?: () => void;
	onPreviewImage?: (url: string, filename: string) => void;
}

function Avatar({
	isDraft,
	isSelf,
	sender,
}: {
	isDraft?: boolean;
	isSelf: boolean;
	sender: string;
}) {
	if (isDraft) {
		return (
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold bg-amber-500/14 text-amber-400 ring-1 ring-amber-500/25">
				草
			</div>
		);
	}
	if (isSelf) {
		return (
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold bg-[var(--craft-accent)] text-white shadow-xs">
				我
			</div>
		);
	}
	const tone = getAvatarTone(sender);
	return (
		<div
			className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
		>
			{getInitials(sender)}
		</div>
	);
}

export default function ThreadMessage({
	email,
	mailboxId,
	mailboxEmail,
	isDraft,
	isSending,
	isExpanded,
	paperMode = "auto",
	onToggleExpand,
	onSendDraft,
	onEditDraft,
	onDeleteDraft,
	onViewSource,
	onPreviewImage,
}: ThreadMessageProps) {
	const isSelf = email.sender === mailboxEmail;
	const senderLabel = isDraft ? "回复草稿" : isSelf ? "我" : email.sender;

	const cardBase = isDraft
		? "rounded-xl border border-amber-500/30 bg-amber-500/[0.04]"
		: "rounded-xl border border-kumo-line bg-kumo-recessed/35";

	if (!isExpanded) {
		return (
			<div className={`${cardBase} transition-colors hover:bg-[var(--surface-hover)]`}>
				<button
					type="button"
					onClick={onToggleExpand}
					className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer bg-transparent border-0"
				>
					<Avatar isDraft={isDraft} isSelf={isSelf} sender={email.sender} />
					<div className="flex-1 min-w-0">
						<div className="flex items-center justify-between gap-2">
							<span className="text-[13.5px] font-medium text-kumo-default truncate">
								{senderLabel}
							</span>
							<span className="text-[11.5px] tabular-nums text-kumo-subtle shrink-0">
								{formatDetailDate(email.date)}
							</span>
						</div>
						<p className="text-xs text-kumo-subtle truncate mt-0.5">
							{stripHtml(email.body || "").slice(0, 90) || "（无正文内容）"}
						</p>
					</div>
					<CaretDownIcon size={14} className="text-kumo-subtle shrink-0" />
				</button>
			</div>
		);
	}

	return (
		<div className={`group/thread-msg ${cardBase} overflow-hidden`}>
			<div className="px-4 py-4 md:px-5">
				<div className="flex items-start justify-between gap-3 mb-3">
					<div className="flex items-center gap-2.5 min-w-0">
						<button
							type="button"
							onClick={onToggleExpand}
							className="shrink-0 cursor-pointer bg-transparent border-0 p-0 rounded-full hover:ring-2 hover:ring-[var(--craft-accent-ring)] transition-shadow"
							aria-label="折叠邮件"
						>
							<Avatar isDraft={isDraft} isSelf={isSelf} sender={email.sender} />
						</button>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<span className="text-[13.5px] font-medium text-kumo-default truncate font-mono">
									{senderLabel}
								</span>
								{isDraft && (
									<span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400">
										草稿
									</span>
								)}
							</div>
							<div className="text-xs text-kumo-subtle truncate">
								收件人：<span className="font-mono">{email.recipient}</span>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-1 shrink-0">
						<span className="text-[11.5px] tabular-nums text-kumo-subtle">
							{formatShortDate(email.date)}
						</span>
						{onViewSource && (
							<Tooltip content="查看邮件头" side="bottom" asChild>
								<button
									type="button"
									onClick={onViewSource}
									aria-label="查看邮件头"
									className="flex h-6 w-6 items-center justify-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] cursor-pointer bg-transparent border-0"
								>
									<CodeIcon size={13} />
								</button>
							</Tooltip>
						)}
						<button
							type="button"
							onClick={onToggleExpand}
							className="flex h-6 w-6 items-center justify-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] cursor-pointer bg-transparent border-0"
							aria-label="折叠邮件"
						>
							<CaretUpIcon size={13} />
						</button>
					</div>
				</div>

				<div className="md:ml-[42px]">
					<EmailIframe
						paperMode={paperMode}
						body={rewriteInlineImages(
							email.body || "",
							mailboxId || "",
							email.id,
							email.attachments,
						)}
						autoSize
					/>
				</div>

				{isDraft && (onSendDraft || onEditDraft || onDeleteDraft) && (
					<div className="flex gap-2 mt-3.5 md:ml-[42px]">
						{onSendDraft && (
							<Button
								variant="primary"
								size="sm"
								icon={<PaperPlaneTiltIcon size={14} />}
								onClick={onSendDraft}
								loading={isSending}
								disabled={isSending}
							>
								{isSending ? "发送中..." : "发送"}
							</Button>
						)}
						{onEditDraft && (
							<Button
								variant="secondary"
								size="sm"
								icon={<PencilSimpleIcon size={14} />}
								onClick={onEditDraft}
								disabled={isSending}
							>
								编辑
							</Button>
						)}
						{onDeleteDraft && (
							<Button
								variant="ghost"
								size="sm"
								icon={<TrashIcon size={14} />}
								onClick={onDeleteDraft}
								disabled={isSending}
							>
								丢弃
							</Button>
						)}
					</div>
				)}

				<EmailAttachmentList
					mailboxId={mailboxId}
					emailId={email.id}
					attachments={email.attachments}
					onPreviewImage={onPreviewImage}
					className="mt-3 md:ml-[42px]"
				/>
			</div>
		</div>
	);
}
