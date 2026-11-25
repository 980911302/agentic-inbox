// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import EmailAttachmentList from "~/components/EmailAttachmentList";
import EmailIframe from "~/components/EmailIframe";
import { getAvatarTone, getInitials } from "~/lib/ui-helpers";
import { formatDetailDate, rewriteInlineImages } from "~/lib/utils";
import type { Email } from "~/types";

interface SingleMessageViewProps {
	email: Email;
	mailboxId?: string;
	paperMode?: "auto" | "light" | "dark";
	onPreviewImage: (url: string, filename: string) => void;
}

export default function SingleMessageView({
	email,
	mailboxId,
	paperMode = "auto",
	onPreviewImage,
}: SingleMessageViewProps) {
	const tone = getAvatarTone(email.sender);

	return (
		<div className="flex flex-col h-full">
			{/* 发件人 / 收件人信息头 */}
			<div className="px-5 py-3.5 border-b border-kumo-line md:px-7 bg-kumo-recessed/30 shrink-0">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3 min-w-0">
						<div
							className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
						>
							{getInitials(email.sender)}
						</div>
						<div className="min-w-0 space-y-0.5">
							<div className="text-sm font-medium text-kumo-default truncate font-mono">
								{email.sender}
							</div>
							<div className="text-xs text-kumo-subtle truncate">
								<span>收件人：</span>
								<span className="font-mono text-kumo-strong">
									{email.recipient}
								</span>
							</div>
							{email.cc && (
								<div className="text-xs text-kumo-subtle truncate">
									<span>抄送：</span>
									<span className="font-mono text-kumo-strong">{email.cc}</span>
								</div>
							)}
						</div>
					</div>
					<span className="text-xs tabular-nums text-kumo-subtle shrink-0 pt-0.5">
						{formatDetailDate(email.date)}
					</span>
				</div>
			</div>

			{/* 邮件正文 */}
			<div className="flex-1 min-h-0">
				<EmailIframe
					paperMode={paperMode}
					body={rewriteInlineImages(
						email.body || "",
						mailboxId || "",
						email.id,
						email.attachments,
					)}
				/>
			</div>

			<EmailAttachmentList
				mailboxId={mailboxId}
				emailId={email.id}
				attachments={email.attachments}
				onPreviewImage={onPreviewImage}
				className="px-5 py-3 border-t border-kumo-line shrink-0 md:px-7 bg-kumo-recessed/25"
				showHeading
			/>
		</div>
	);
}
