// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useKumoToastManager } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowRightIcon,
	ArrowsClockwiseIcon,
	CopyIcon,
	EnvelopeSimpleIcon,
	FileIcon,
	FolderIcon,
	GearSixIcon,
	KeyIcon,
	KeyboardIcon,
	MagnifyingGlassIcon,
	MoonIcon,
	PaperclipIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	PlugsIcon,
	ShieldCheckIcon,
	SidebarSimpleIcon,
	SignOutIcon,
	SunIcon,
	TrashIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Folders, SYSTEM_FOLDER_IDS } from "shared/folders";
import { useUIStore } from "~/hooks/useUIStore";
import { useCurrentUser, useLogout } from "~/queries/auth";
import { useFolders } from "~/queries/folders";
import { queryKeys } from "~/queries/keys";

interface CommandItem {
	id: string;
	group: "搜索与筛选" | "常用操作" | "前往文件夹" | "开发者与账户";
	label: string;
	description?: string;
	keywords?: string;
	icon: React.ReactNode;
	shortcut?: string[];
	onSelect: () => void;
}

export default function CommandPalette() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const toastManager = useKumoToastManager();

	const {
		isCommandPaletteOpen,
		setCommandPaletteOpen,
		theme,
		toggleTheme,
		toggleSidebarCollapsed,
		toggleMcpPanel,
		toggleShortcuts,
		startCompose,
		openComposeModal,
	} = useUIStore();

	const { data: user } = useCurrentUser();
	const { data: folders = [] } = useFolders(mailboxId);
	const logoutMutation = useLogout();

	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const encodedMailboxId = mailboxId ? encodeURIComponent(mailboxId) : "";

	useEffect(() => {
		if (isCommandPaletteOpen) {
			setQuery("");
			setActiveIndex(0);
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [isCommandPaletteOpen]);

	const customFolders = useMemo(
		() =>
			folders.filter(
				(f) =>
					!(SYSTEM_FOLDER_IDS as readonly string[]).includes(f.id) &&
					f.id !== Folders.SPAM,
			),
		[folders],
	);

	const closeAndRun = (fn: () => void) => {
		setCommandPaletteOpen(false);
		fn();
	};

	const commands = useMemo<CommandItem[]>(() => {
		const trimmed = query.trim();
		const list: CommandItem[] = [];

		if (trimmed && mailboxId) {
			list.push({
				id: "search-free-text",
				group: "搜索与筛选",
				label: `搜索邮件 “${trimmed}”`,
				description: "在全部文件夹中按主题、发件人与正文检索",
				icon: <MagnifyingGlassIcon size={16} />,
				shortcut: ["↵"],
				onSelect: () =>
					closeAndRun(() =>
						navigate(
							`/mailbox/${encodedMailboxId}/search?q=${encodeURIComponent(trimmed)}`,
						),
					),
			});
		}

		// 常用操作
		list.push(
			{
				id: "compose",
				group: "常用操作",
				label: "撰写新邮件",
				description: "立即打开写信编辑器",
				keywords: "write compose new mail xie",
				icon: <PencilSimpleIcon size={16} />,
				shortcut: ["C"],
				onSelect: () =>
					closeAndRun(() => {
						const isSplitPage =
							location.pathname.includes("/emails/") ||
							location.pathname.includes("/search");
						if (isSplitPage) startCompose();
						else openComposeModal();
					}),
			},
			{
				id: "refresh",
				group: "常用操作",
				label: "刷新收件箱",
				description: "同步最新入站邮件与未读计数",
				keywords: "sync reload refresh shuaxin",
				icon: <ArrowsClockwiseIcon size={16} />,
				onSelect: () =>
					closeAndRun(() => {
						if (mailboxId) {
							queryClient.invalidateQueries({ queryKey: ["emails", mailboxId] });
							queryClient.invalidateQueries({
								queryKey: queryKeys.folders.list(mailboxId),
							});
							toastManager.add({ title: "已同步最新邮件" });
						}
					}),
			},
			{
				id: "toggle-theme",
				group: "常用操作",
				label: theme === "dark" ? "切换为暖白浅色主题" : "切换为黑曜石深色主题",
				description: "实时切换深浅外观（已自动保存偏好）",
				keywords: "theme dark light mode zhuti",
				icon: theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />,
				onSelect: () => closeAndRun(toggleTheme),
			},
			{
				id: "toggle-mcp",
				group: "常用操作",
				label: "展开 / 收起 MCP 接入面板",
				description: "快速查看 Streamable HTTP 地址与工具目录",
				keywords: "mcp agent panel claude cursor",
				icon: <PlugsIcon size={16} />,
				onSelect: () => closeAndRun(toggleMcpPanel),
			},
			{
				id: "toggle-sidebar",
				group: "常用操作",
				label: "折叠 / 展开左侧导航栏",
				keywords: "sidebar rail collapse",
				icon: <SidebarSimpleIcon size={16} />,
				shortcut: ["["],
				onSelect: () => closeAndRun(toggleSidebarCollapsed),
			},
			{
				id: "shortcuts",
				group: "常用操作",
				label: "查看键盘快捷键指南",
				keywords: "keyboard shortcuts help kuaijiejian",
				icon: <KeyboardIcon size={16} />,
				shortcut: ["?"],
				onSelect: () => closeAndRun(toggleShortcuts),
			},
		);

		// 快捷筛选
		if (mailboxId) {
			list.push(
				{
					id: "filter-unread",
					group: "搜索与筛选",
					label: "查看所有未读邮件",
					description: "is:unread",
					keywords: "unread weidu filter",
					icon: <EnvelopeSimpleIcon size={16} />,
					onSelect: () =>
						closeAndRun(() =>
							navigate(
								`/mailbox/${encodedMailboxId}/search?q=${encodeURIComponent("is:unread")}`,
							),
						),
				},
				{
					id: "filter-attachment",
					group: "搜索与筛选",
					label: "查看包含附件的邮件",
					description: "has:attachment",
					keywords: "attachment fujian file",
					icon: <PaperclipIcon size={16} />,
					onSelect: () =>
						closeAndRun(() =>
							navigate(
								`/mailbox/${encodedMailboxId}/search?q=${encodeURIComponent("has:attachment")}`,
							),
						),
				},
			);
		}

		// 前往文件夹
		if (mailboxId) {
			const sysFolders: {
				id: string;
				label: string;
				icon: React.ReactNode;
				shortcut: string[];
				keywords: string;
			}[] = [
				{
					id: Folders.INBOX,
					label: "前往 收件箱",
					icon: <TrayIcon size={16} />,
					shortcut: ["G", "I"],
					keywords: "inbox shoujianxiang",
				},
				{
					id: Folders.SENT,
					label: "前往 已发送",
					icon: <PaperPlaneTiltIcon size={16} />,
					shortcut: ["G", "S"],
					keywords: "sent yifasong",
				},
				{
					id: Folders.DRAFT,
					label: "前往 草稿箱",
					icon: <FileIcon size={16} />,
					shortcut: ["G", "D"],
					keywords: "draft caogao",
				},
				{
					id: Folders.ARCHIVE,
					label: "前往 归档",
					icon: <ArchiveIcon size={16} />,
					shortcut: ["G", "A"],
					keywords: "archive guidang",
				},
				{
					id: Folders.TRASH,
					label: "前往 回收站",
					icon: <TrashIcon size={16} />,
					shortcut: ["G", "T"],
					keywords: "trash huishouzhan",
				},
			];

			for (const sf of sysFolders) {
				list.push({
					id: `go-${sf.id}`,
					group: "前往文件夹",
					label: sf.label,
					icon: sf.icon,
					shortcut: sf.shortcut,
					keywords: sf.keywords,
					onSelect: () =>
						closeAndRun(() =>
							navigate(`/mailbox/${encodedMailboxId}/emails/${sf.id}`),
						),
				});
			}

			for (const cf of customFolders) {
				list.push({
					id: `go-custom-${cf.id}`,
					group: "前往文件夹",
					label: `前往 ${cf.name}`,
					icon: <FolderIcon size={16} />,
					keywords: `folder ${cf.name}`,
					onSelect: () =>
						closeAndRun(() =>
							navigate(`/mailbox/${encodedMailboxId}/emails/${cf.id}`),
						),
				});
			}
		}

		// 开发者与账户
		const mcpUrl =
			typeof window !== "undefined"
				? `${window.location.origin}/mcp`
				: "https://your-domain.com/mcp";

		list.push({
			id: "copy-mcp-url",
			group: "开发者与账户",
			label: "复制 MCP 端点地址",
			description: mcpUrl,
			keywords: "copy mcp url endpoint",
			icon: <CopyIcon size={16} />,
			onSelect: () =>
				closeAndRun(async () => {
					try {
						await navigator.clipboard.writeText(mcpUrl);
						toastManager.add({ title: "已复制 MCP 服务地址" });
					} catch {
						// 静默忽略
					}
				}),
		});

		if (mailboxId) {
			list.push({
				id: "go-settings",
				group: "开发者与账户",
				label: "MCP 密钥与账户设置",
				description: "管理 Bearer API 密钥、签名与密码",
				keywords: "settings keys api mcp password shezhi",
				icon: <KeyIcon size={16} />,
				shortcut: ["G", "M"],
				onSelect: () =>
					closeAndRun(() =>
						navigate(`/mailbox/${encodedMailboxId}/settings`),
					),
			});
		}

		if (user?.role === "admin" && mailboxId) {
			list.push({
				id: "go-admin",
				group: "开发者与账户",
				label: "管理员控制台",
				description: "管理多用户邮箱账户与注册策略",
				keywords: "admin console users guanli",
				icon: <ShieldCheckIcon size={16} />,
				onSelect: () =>
					closeAndRun(() => navigate(`/mailbox/${encodedMailboxId}/admin`)),
			});
		}

		list.push({
			id: "logout",
			group: "开发者与账户",
			label: "退出当前账号",
			keywords: "logout signout exit tuichu",
			icon: <SignOutIcon size={16} />,
			onSelect: () =>
				closeAndRun(async () => {
					await logoutMutation.mutateAsync();
					navigate("/login", { replace: true });
				}),
		});

		return list;
	}, [
		query,
		mailboxId,
		encodedMailboxId,
		location.pathname,
		theme,
		customFolders,
		user?.role,
		navigate,
		queryClient,
		toastManager,
		toggleTheme,
		toggleMcpPanel,
		toggleSidebarCollapsed,
		toggleShortcuts,
		startCompose,
		openComposeModal,
		logoutMutation,
	]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return commands;
		return commands.filter((cmd) => {
			if (cmd.id === "search-free-text") return true;
			const haystack =
				`${cmd.label} ${cmd.description || ""} ${cmd.keywords || ""} ${cmd.group}`.toLowerCase();
			return haystack.includes(q);
		});
	}, [commands, query]);

	useEffect(() => {
		setActiveIndex(0);
	}, [query]);

	useEffect(() => {
		if (!listRef.current) return;
		const el = listRef.current.querySelector(
			`[data-cmd-index="${activeIndex}"]`,
		) as HTMLElement | null;
		el?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	if (!isCommandPaletteOpen) return null;

	// 按分组归类但保留全局索引以便上下键导航
	const grouped: { group: string; items: { item: CommandItem; index: number }[] }[] = [];
	filtered.forEach((item, index) => {
		const last = grouped[grouped.length - 1];
		if (last && last.group === item.group) {
			last.items.push({ item, index });
		} else {
			grouped.push({ group: item.group, items: [{ item, index }] });
		}
	});

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((prev) =>
				filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0,
			);
		} else if (e.key === "Enter") {
			e.preventDefault();
			filtered[activeIndex]?.onSelect();
		} else if (e.key === "Escape") {
			e.preventDefault();
			setCommandPaletteOpen(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/55 backdrop-blur-sm animate-craft-fade"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) setCommandPaletteOpen(false);
			}}
		>
			<div
				className="w-full max-w-[580px] rounded-2xl craft-glass-strong overflow-hidden animate-craft-scale"
				role="dialog"
				aria-modal="true"
				aria-label="全局命令面板"
			>
				{/* 顶部搜索输入 */}
				<div className="flex items-center gap-3 px-4 h-13 border-b border-kumo-line">
					<MagnifyingGlassIcon
						size={18}
						className="text-[var(--craft-accent)] shrink-0"
					/>
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="输入命令、跳转文件夹，或直接输入关键词搜索邮件..."
						className="flex-1 bg-transparent border-0 outline-none text-[14.5px] text-kumo-default placeholder:text-kumo-subtle"
					/>
					<kbd className="craft-kbd">ESC</kbd>
				</div>

				{/* 命令列表 */}
				<div
					ref={listRef}
					className="max-h-[56vh] overflow-y-auto p-2 space-y-2"
				>
					{grouped.length === 0 ? (
						<div className="py-10 text-center text-sm text-kumo-subtle">
							未匹配到相关命令
						</div>
					) : (
						grouped.map(({ group, items }) => (
							<div key={group}>
								<div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium tracking-wider text-kumo-subtle uppercase">
									{group}
								</div>
								<div className="space-y-0.5">
									{items.map(({ item, index }) => {
										const isActive = index === activeIndex;
										return (
											<button
												key={item.id}
												type="button"
												data-cmd-index={index}
												onMouseEnter={() => setActiveIndex(index)}
												onClick={item.onSelect}
												className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer border-0 ${
													isActive
														? "bg-[var(--craft-accent-soft)] text-kumo-default"
														: "bg-transparent text-kumo-strong hover:bg-[var(--surface-hover)]"
												}`}
											>
												<span
													className={`shrink-0 ${
														isActive
															? "text-[var(--craft-accent)]"
															: "text-kumo-subtle"
													}`}
												>
													{item.icon}
												</span>
												<div className="min-w-0 flex-1">
													<div className="text-[13.5px] font-medium text-kumo-default truncate">
														{item.label}
													</div>
													{item.description && (
														<div className="text-[11.5px] text-kumo-subtle truncate mt-0.5">
															{item.description}
														</div>
													)}
												</div>
												{item.shortcut ? (
													<div className="flex items-center gap-1 shrink-0">
														{item.shortcut.map((k) => (
															<kbd key={k} className="craft-kbd">
																{k}
															</kbd>
														))}
													</div>
												) : isActive ? (
													<ArrowRightIcon
														size={14}
														className="text-[var(--craft-accent)] shrink-0"
													/>
												) : null}
											</button>
										);
									})}
								</div>
							</div>
						))
					)}
				</div>

				{/* 底部提示条 */}
				<div className="flex items-center justify-between px-4 py-2.5 border-t border-kumo-line text-[11.5px] text-kumo-subtle">
					<div className="flex items-center gap-3">
						<span className="inline-flex items-center gap-1">
							<kbd className="craft-kbd">↑</kbd>
							<kbd className="craft-kbd">↓</kbd>
							<span>选择</span>
						</span>
						<span className="inline-flex items-center gap-1">
							<kbd className="craft-kbd">↵</kbd>
							<span>执行</span>
						</span>
					</div>
					<span className="inline-flex items-center gap-1.5 font-mono text-[11px] opacity-80">
						<GearSixIcon size={12} />
						Agentic Inbox
					</span>
				</div>
			</div>
		</div>
	);
}
