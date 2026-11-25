// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { ReactNode } from "react";
import ComposePanel from "~/components/ComposePanel";
import EmailPanel from "~/components/EmailPanel";
import { useUIStore } from "~/hooks/useUIStore";

interface MailboxSplitViewProps {
	selectedEmailId: string | null;
	isComposing: boolean;
	children: ReactNode;
}

export default function MailboxSplitView({
	selectedEmailId,
	isComposing,
	children,
}: MailboxSplitViewProps) {
	const isFocusMode = useUIStore((s) => s.isFocusMode);
	const isPanelOpen = selectedEmailId !== null || isComposing;
	const hideListInFocus = isFocusMode && selectedEmailId !== null && !isComposing;

	return (
		<div className="flex h-full min-h-0">
			{/* 左侧邮件列表栏（专注阅读模式下自动收起） */}
			{!hideListInFocus && (
				<div
					className={`relative flex flex-col min-w-0 shrink-0 ${
						isPanelOpen
							? "hidden md:flex md:w-[360px] lg:w-[396px] xl:w-[420px] md:border-r md:border-kumo-line"
							: "w-full"
					}`}
				>
					{children}
				</div>
			)}

			{/* 右侧读信 / 写信工作台 */}
			{isPanelOpen && (
				<div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full md:w-auto animate-craft-panel bg-kumo-base">
					{isComposing && !selectedEmailId ? (
						<ComposePanel />
					) : isComposing && selectedEmailId ? (
						<div className="flex flex-col h-full overflow-y-auto">
							<ComposePanel />
							<div className="border-t border-kumo-line">
								<EmailPanel emailId={selectedEmailId} />
							</div>
						</div>
					) : selectedEmailId ? (
						<EmailPanel emailId={selectedEmailId} />
					) : null}
				</div>
			)}
		</div>
	);
}
