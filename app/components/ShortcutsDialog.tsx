// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { KeyboardIcon, XIcon } from "@phosphor-icons/react";
import { useUIStore } from "~/hooks/useUIStore";

interface ShortcutGroup {
	title: string;
	items: { label: string; keys: string[] }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
	{
		title: "全局与工作台",
		items: [
			{ label: "打开命令面板", keys: ["⌘", "K"] },
			{ label: "撰写新邮件", keys: ["C"] },
			{ label: "聚焦搜索框", keys: ["/"] },
			{ label: "折叠 / 展开侧栏", keys: ["["] },
			{ label: "打开快捷键指南", keys: ["?"] },
			{ label: "关闭面板 / 取消选择", keys: ["ESC"] },
		],
	},
	{
		title: "邮件列表浏览",
		items: [
			{ label: "下一封邮件", keys: ["J"] },
			{ label: "上一封邮件", keys: ["K"] },
			{ label: "打开当前邮件", keys: ["↵"] },
			{ label: "勾选 / 取消多选", keys: ["X"] },
		],
	},
	{
		title: "邮件快捷处理",
		items: [
			{ label: "归档当前邮件", keys: ["E"] },
			{ label: "添加 / 取消星标", keys: ["S"] },
			{ label: "切换已读 / 未读", keys: ["U"] },
			{ label: "回复发件人", keys: ["R"] },
			{ label: "回复全部", keys: ["A"] },
			{ label: "切换专注阅读模式", keys: ["F"] },
			{ label: "写信时立即发送", keys: ["⌘", "↵"] },
		],
	},
	{
		title: "极速跳转（先按 G）",
		items: [
			{ label: "前往收件箱", keys: ["G", "I"] },
			{ label: "前往已发送", keys: ["G", "S"] },
			{ label: "前往草稿箱", keys: ["G", "D"] },
			{ label: "前往归档", keys: ["G", "A"] },
			{ label: "前往回收站", keys: ["G", "T"] },
			{ label: "前往 MCP 与设置", keys: ["G", "M"] },
		],
	},
];

export default function ShortcutsDialog() {
	const { isShortcutsOpen, setShortcutsOpen } = useUIStore();

	if (!isShortcutsOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-craft-fade"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) setShortcutsOpen(false);
			}}
		>
			<div
				className="w-full max-w-[680px] rounded-2xl craft-glass-strong overflow-hidden animate-craft-scale"
				role="dialog"
				aria-modal="true"
				aria-label="键盘快捷键指南"
			>
				<div className="flex items-center justify-between px-5 py-4 border-b border-kumo-line">
					<div className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg craft-accent-badge">
							<KeyboardIcon size={17} weight="duotone" />
						</div>
						<div>
							<h2 className="text-sm font-semibold text-kumo-default">
								键盘流快捷键
							</h2>
							<p className="text-xs text-kumo-subtle">
								无需离开键盘即可完成全流程收发与整理（Windows 请将 ⌘ 替换为 Ctrl）
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setShortcutsOpen(false)}
						className="p-1.5 rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
						aria-label="关闭"
					>
						<XIcon size={16} />
					</button>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5 max-h-[68vh] overflow-y-auto">
					{SHORTCUT_GROUPS.map((group) => (
						<div key={group.title} className="space-y-2">
							<h3 className="text-[11px] font-semibold tracking-wider text-kumo-subtle uppercase px-1">
								{group.title}
							</h3>
							<div className="rounded-xl border border-kumo-line bg-kumo-recessed/50 divide-y divide-kumo-line">
								{group.items.map((item) => (
									<div
										key={item.label}
										className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]"
									>
										<span className="text-kumo-strong">{item.label}</span>
										<div className="flex items-center gap-1 shrink-0">
											{item.keys.map((k, idx) => (
												<span key={`${k}-${idx}`} className="inline-flex items-center gap-1">
													<kbd className="craft-kbd">{k}</kbd>
													{idx === 0 && item.keys[0] === "G" && (
														<span className="text-[10px] text-kumo-subtle">then</span>
													)}
												</span>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
