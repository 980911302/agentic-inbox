// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Badge, Button, Tooltip } from "@cloudflare/kumo";
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
			<Button
				variant="ghost"
				shape="square"
				size="sm"
				icon={
					copied ? (
						<CheckIcon size={13} weight="bold" className="text-kumo-success" />
					) : (
						<CopyIcon size={13} />
					)
				}
				onClick={handleCopy}
				aria-label="复制到剪贴板"
			/>
		</Tooltip>
	);
}

const TOOLS = [
	{ name: "get_mailbox_info", desc: "获取当前邮箱与文件夹信息" },
	{ name: "list_emails", desc: "列出指定文件夹的邮件" },
	{ name: "get_email", desc: "读取单封邮件正文与附件" },
	{ name: "get_thread", desc: "获取完整邮件会话串" },
	{ name: "search_emails", desc: "按关键词搜索邮件" },
	{ name: "draft_reply", desc: "起草回复保存到草稿箱" },
	{ name: "create_draft", desc: "创建新草稿邮件" },
	{ name: "update_draft", desc: "修改已有草稿内容" },
	{ name: "send_reply", desc: "发送回复邮件" },
	{ name: "send_email", desc: "发送新邮件" },
	{ name: "mark_email_read", desc: "标记已读或未读" },
	{ name: "move_email", desc: "移动邮件至指定文件夹" },
	{ name: "delete_email", desc: "永久删除指定邮件" },
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
		<div className="flex flex-col h-full bg-kumo-base">
			{/* 顶部标题 */}
			<div className="h-14 flex items-center justify-between px-4 border-b border-kumo-line shrink-0">
				<div className="flex items-center gap-2">
					<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
						<PlugsIcon size={15} weight="duotone" />
					</div>
					<span className="text-sm font-semibold text-kumo-default">
						MCP 接入指南
					</span>
					<Badge variant="secondary">{apiKeys.length} 个密钥</Badge>
				</div>
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					icon={<XIcon size={16} />}
					onClick={closeMcpPanel}
					aria-label="关闭 MCP 面板"
				/>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
				{/* 当前绑定说明 */}
				<div className="rounded-xl border border-kumo-line bg-kumo-recessed/60 p-3.5 space-y-2.5">
					<div className="flex items-center justify-between gap-2">
						<span className="text-[11px] font-medium text-kumo-subtle">
							当前密钥作用域（1:1 严格绑定）
						</span>
					</div>
					<div className="font-mono text-xs font-medium text-kumo-default bg-kumo-base px-2.5 py-1.5 rounded-lg border border-kumo-line truncate">
						{mailboxId}
					</div>
					<p className="text-xs text-kumo-subtle leading-relaxed">
						每个密钥仅可读写与收发此邮箱的邮件，所有工具无需手动传递邮箱参数，天然隔离。
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

				{/* MCP 地址 */}
				<div className="space-y-1.5">
					<label className="text-xs font-medium text-kumo-strong block">
						服务地址（Streamable HTTP）
					</label>
					<div className="relative">
						<div className="absolute right-1.5 top-1/2 -translate-y-1/2">
							<CopyButton text={mcpUrl} />
						</div>
						<div className="bg-kumo-recessed text-kumo-default font-mono text-[11.5px] px-3 py-2.5 pr-10 rounded-lg border border-kumo-line break-all leading-relaxed">
							{mcpUrl}
						</div>
					</div>
				</div>

				{/* 标准客户端配置 */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<label className="text-xs font-medium text-kumo-strong">
							客户端配置模板（Bearer 鉴权）
						</label>
						<CopyButton text={configSnippet} />
					</div>
					<pre className="bg-kumo-recessed text-kumo-default font-mono text-[11px] p-3 rounded-lg border border-kumo-line overflow-x-auto leading-relaxed m-0">
						{configSnippet}
					</pre>
				</div>

				{/* 可用工具列表 */}
				<div className="space-y-2 pb-4">
					<h4 className="text-xs font-semibold text-kumo-subtle px-0.5">
						可用工具（{TOOLS.length} 项）
					</h4>
					<div className="border border-kumo-line rounded-xl divide-y divide-kumo-line overflow-hidden">
						{TOOLS.map((tool) => (
							<div
								key={tool.name}
								className="flex items-center gap-2.5 px-3 py-2 bg-kumo-base hover:bg-kumo-recessed/50 transition-colors"
							>
								<WrenchIcon
									size={12}
									weight="bold"
									className="text-blue-600 shrink-0"
								/>
								<div className="min-w-0 flex-1">
									<span className="text-xs font-mono font-medium text-kumo-default">
										{tool.name}
									</span>
								</div>
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
