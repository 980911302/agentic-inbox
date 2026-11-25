// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Tooltip } from "@cloudflare/kumo";
import {
	CheckIcon,
	CopyIcon,
	KeyIcon,
	PlugsIcon,
	WrenchIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useUIStore } from "~/hooks/useUIStore";
import { useApiKeys } from "~/queries/auth";

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// 剪贴板不可用时静默忽略
		}
	};

	return (
		<Tooltip content={copied ? "已复制" : "复制"} asChild>
			<button
				type="button"
				onClick={handleCopy}
				aria-label="复制到剪贴板"
				className="flex h-7 w-7 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
			>
				{copied ? (
					<CheckIcon size={13} weight="bold" className="text-emerald-400" />
				) : (
					<CopyIcon size={13} />
				)}
			</button>
		</Tooltip>
	);
}

const TOOLS = [
	{ name: "get_mailbox_info", desc: "邮箱与文件夹状态" },
	{ name: "list_emails", desc: "列出文件夹邮件" },
	{ name: "get_email", desc: "读取邮件正文与附件" },
	{ name: "get_thread", desc: "获取完整会话串" },
	{ name: "search_emails", desc: "按语法检索邮件" },
	{ name: "draft_reply", desc: "起草回复草稿" },
	{ name: "create_draft", desc: "创建新草稿" },
	{ name: "update_draft", desc: "修改草稿内容" },
	{ name: "send_reply", desc: "发送回复邮件" },
	{ name: "send_email", desc: "发送新邮件" },
	{ name: "mark_email_read", desc: "标记已读/未读" },
	{ name: "move_email", desc: "移动至文件夹" },
	{ name: "delete_email", desc: "永久删除邮件" },
];

export default function MCPPanel() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const { closeMcpPanel } = useUIStore();
	const { data: apiKeys = [] } = useApiKeys();

	const baseUrl =
		typeof window !== "undefined"
			? window.location.origin
			: "https://your-domain.com";
	const mcpUrl = `${baseUrl}/mcp`;

	const configSnippet = JSON.stringify(
		{
			mcpServers: {
				"agentic-inbox": {
					type: "http",
					url: mcpUrl,
					headers: {
						Authorization: "Bearer <你的MCP密钥>",
					},
				},
			},
		},
		null,
		2,
	);

	return (
		<div className="flex flex-col h-full bg-transparent">
			{/* 顶部标题 */}
			<div className="h-[54px] flex items-center justify-between px-4 border-b border-kumo-line shrink-0">
				<div className="flex items-center gap-2.5">
					<div className="flex h-7 w-7 items-center justify-center rounded-lg craft-accent-badge">
						<PlugsIcon size={15} weight="duotone" />
					</div>
					<span className="text-[14px] font-semibold text-kumo-default">
						MCP 接入面板
					</span>
					<span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/20 tabular-nums">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
						{apiKeys.length} 密钥
					</span>
				</div>
				<button
					type="button"
					onClick={closeMcpPanel}
					aria-label="关闭 MCP 面板"
					className="flex h-7 w-7 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
				>
					<XIcon size={15} />
				</button>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
				{/* 当前绑定说明 */}
				<div className="rounded-xl border border-kumo-line bg-kumo-recessed/55 p-3.5 space-y-2.5">
					<div className="flex items-center justify-between">
						<span className="text-[11px] font-medium tracking-wider text-kumo-subtle uppercase">
							1:1 严格隔离作用域
						</span>
					</div>
					<div className="font-mono text-xs font-medium text-kumo-default bg-kumo-base px-2.5 py-2 rounded-lg border border-kumo-line truncate">
						{mailboxId}
					</div>
					<p className="text-xs text-kumo-subtle leading-relaxed">
						每个 Bearer 密钥仅绑定当前账户邮箱，无需额外传递邮箱 ID，天然防止越权。
					</p>
					<Button
						variant="primary"
						size="sm"
						icon={<KeyIcon size={14} />}
						className="w-full justify-center"
						onClick={() => {
							if (mailboxId) {
								navigate(`/mailbox/${encodeURIComponent(mailboxId)}/settings`);
								closeMcpPanel();
							}
						}}
					>
						管理 / 新建 MCP 密钥
					</Button>
				</div>

				{/* MCP 端点地址 */}
				<div className="space-y-1.5">
					<label className="text-[11.5px] font-medium text-kumo-strong block">
						Streamable HTTP 端点
					</label>
					<div className="relative">
						<div className="absolute right-1.5 top-1/2 -translate-y-1/2">
							<CopyButton text={mcpUrl} />
						</div>
						<div className="bg-kumo-recessed/70 text-kumo-default font-mono text-[11.5px] px-3 py-2.5 pr-10 rounded-xl border border-kumo-line break-all leading-relaxed">
							{mcpUrl}
						</div>
					</div>
				</div>

				{/* 标准客户端配置 */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<label className="text-[11.5px] font-medium text-kumo-strong">
							客户端配置（Bearer 鉴权）
						</label>
						<CopyButton text={configSnippet} />
					</div>
					<pre className="bg-kumo-recessed/70 text-kumo-default font-mono text-[11px] p-3.5 rounded-xl border border-kumo-line overflow-x-auto leading-relaxed m-0">
						{configSnippet}
					</pre>
				</div>

				{/* 可用工具目录 */}
				<div className="space-y-2 pb-4">
					<div className="flex items-center justify-between px-0.5">
						<h4 className="text-[11px] font-semibold tracking-wider text-kumo-subtle uppercase">
							可用工具目录
						</h4>
						<span className="text-[11px] font-mono text-kumo-subtle">
							{TOOLS.length} tools
						</span>
					</div>
					<div className="border border-kumo-line rounded-xl divide-y divide-kumo-line overflow-hidden bg-kumo-recessed/35">
						{TOOLS.map((tool) => (
							<div
								key={tool.name}
								className="flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--surface-hover)] transition-colors"
							>
								<WrenchIcon
									size={12}
									weight="bold"
									className="text-[var(--craft-accent)] shrink-0"
								/>
								<span className="text-xs font-mono font-medium text-kumo-default truncate flex-1">
									{tool.name}
								</span>
								<span className="text-[11px] text-kumo-subtle shrink-0">
									{tool.desc}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
