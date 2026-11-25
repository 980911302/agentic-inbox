// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { FileIcon, ImageIcon, PaperclipIcon } from "@phosphor-icons/react";
import {
	formatBytes,
	getAttachmentUrl,
	getNonInlineAttachments,
} from "~/lib/utils";
import type { Attachment } from "~/types";

interface EmailAttachmentListProps {
	mailboxId?: string;
	emailId: string;
	attachments?: Attachment[];
	onPreviewImage?: (url: string, filename: string) => void;
	className?: string;
	showHeading?: boolean;
}

export default function EmailAttachmentList({
	mailboxId,
	emailId,
	attachments,
	onPreviewImage,
	className,
	showHeading = false,
}: EmailAttachmentListProps) {
	if (!mailboxId) return null;

	const files = getNonInlineAttachments(attachments);
	if (files.length === 0) return null;

	const chipClass =
		"group flex items-center gap-2 rounded-xl border border-kumo-line bg-kumo-base/80 px-3 py-2 text-xs transition-all hover:border-[var(--craft-accent-ring)] hover:bg-[var(--surface-hover)] cursor-pointer";

	return (
		<div className={className}>
			{showHeading && (
				<div className="flex items-center gap-1.5 mb-2.5">
					<PaperclipIcon size={13} className="text-[var(--craft-accent)]" />
					<span className="text-xs font-medium text-kumo-strong">
						{files.length} 个附件
					</span>
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				{files.map((attachment) => {
					const url = getAttachmentUrl(mailboxId, emailId, attachment.id);
					const isImage = attachment.mimetype?.startsWith("image/");

					if (isImage && onPreviewImage) {
						return (
							<button
								key={attachment.id}
								type="button"
								onClick={() => onPreviewImage(url, attachment.filename)}
								className={`${chipClass} text-left`}
							>
								<ImageIcon
									size={15}
									className="text-[var(--craft-accent)] shrink-0"
								/>
								<span className="text-kumo-default font-medium truncate max-w-[160px]">
									{attachment.filename}
								</span>
								<span className="text-kumo-subtle font-mono text-[11px]">
									{formatBytes(attachment.size)}
								</span>
							</button>
						);
					}

					return (
						<a
							key={attachment.id}
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							className={`${chipClass} no-underline`}
						>
							<FileIcon size={15} className="text-kumo-subtle shrink-0" />
							<span className="text-kumo-default font-medium truncate max-w-[160px]">
								{attachment.filename}
							</span>
							<span className="text-kumo-subtle font-mono text-[11px]">
								{formatBytes(attachment.size)}
							</span>
						</a>
					);
				})}
			</div>
		</div>
	);
}
