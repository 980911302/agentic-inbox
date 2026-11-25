// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

interface EmailPanelHeaderProps {
	subject: string;
	messageCount: number;
	showThreadCount: boolean;
	catchAllAlias?: string | null;
}

export default function EmailPanelHeader({
	subject,
	messageCount,
	showThreadCount,
	catchAllAlias,
}: EmailPanelHeaderProps) {
	return (
		<div className="px-5 py-4 border-b border-kumo-line shrink-0 md:px-7">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="text-[17px] font-semibold tracking-tight text-kumo-default leading-snug">
					{subject || "（无主题）"}
				</h2>
				{showThreadCount && (
					<span className="tabular-nums text-[11px] font-medium px-2 py-0.5 rounded-full bg-kumo-recessed border border-kumo-line text-kumo-subtle">
						{messageCount} 封往来
					</span>
				)}
				{catchAllAlias && (
					<span className="font-mono text-[11px] px-2 py-0.5 rounded-full craft-accent-badge">
						原投递至 {catchAllAlias}
					</span>
				)}
			</div>
		</div>
	);
}
