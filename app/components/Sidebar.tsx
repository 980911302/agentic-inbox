// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Button,
	Dialog,
	Input,
	Tooltip,
	useKumoToastManager,
} from "@cloudflare/kumo";
import {
	ArchiveIcon,
	FileIcon,
	FolderIcon,
	KeyIcon,
	KeyboardIcon,
	MoonIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	PlusIcon,
	ShieldCheckIcon,
	SidebarSimpleIcon,
	SignOutIcon,
	SunIcon,
	TrashIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router";
import { Folders, SYSTEM_FOLDER_IDS } from "shared/folders";
import { useUIStore } from "~/hooks/useUIStore";
import { getInitials } from "~/lib/ui-helpers";
import { useCurrentUser, useLogout } from "~/queries/auth";
import {
	useCreateFolder,
	useDeleteFolder,
	useFolders,
} from "~/queries/folders";
import { useMailbox } from "~/queries/mailboxes";

const SYSTEM_FOLDER_LINKS = [
	{ id: Folders.INBOX, label: "收件箱", Icon: TrayIcon, shortcut: "G I" },
	{ id: Folders.SENT, label: "已发送", Icon: PaperPlaneTiltIcon, shortcut: "G S" },
	{ id: Folders.DRAFT, label: "草稿箱", Icon: FileIcon, shortcut: "G D" },
	{ id: Folders.ARCHIVE, label: "归档", Icon: ArchiveIcon, shortcut: "G A" },
	{ id: Folders.TRASH, label: "回收站", Icon: TrashIcon, shortcut: "G T" },
];

interface FolderLinkProps {
	to: string;
	Icon: React.ComponentType<{ size?: number; weight?: "regular" | "fill" | "duotone" }>;
	label: string;
	unreadCount?: number;
	collapsed?: boolean;
	shortcutHint?: string;
	onClick?: () => void;
	onDelete?: () => void;
}

function FolderLink({
	to,
	Icon,
	label,
	unreadCount,
	collapsed,
	shortcutHint,
	onClick,
	onDelete,
}: FolderLinkProps) {
	const linkEl = (
		<div className="group/folder relative flex items-center">
			<NavLink
				to={to}
				onClick={onClick}
				className={({ isActive }) =>
					`relative flex-1 flex items-center rounded-xl text-[13.5px] transition-all duration-150 ${
						collapsed
							? "justify-center h-10 w-10 mx-auto px-0"
							: "gap-2.5 py-2 px-3"
					} ${
						isActive
							? "bg-[var(--craft-accent-soft)] text-kumo-default font-medium shadow-[inset_0_0_0_1px_var(--craft-accent-ring)]"
							: "text-kumo-strong hover:text-kumo-default hover:bg-[var(--surface-hover)]"
					}`
				}
			>
				{({ isActive }) => (
					<>
						{!collapsed && isActive && (
							<span className="absolute left-1 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-[var(--craft-accent)]" />
						)}
						<span
							className={`shrink-0 transition-colors ${
								isActive
									? "text-[var(--craft-accent)]"
									: "text-kumo-subtle group-hover/folder:text-kumo-strong"
							}`}
						>
							<Icon size={17} weight={isActive ? "fill" : "regular"} />
						</span>
						{!collapsed && (
							<>
								<span className="truncate flex-1">{label}</span>
								{unreadCount != null && unreadCount > 0 && (
									<span
										className={`tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
											isActive
												? "bg-[var(--craft-accent)] text-white"
												: "bg-[var(--craft-accent-soft)] text-[var(--craft-accent)]"
										}`}
									>
										{unreadCount}
									</span>
								)}
							</>
						)}
						{collapsed && unreadCount != null && unreadCount > 0 && (
							<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--craft-accent)] ring-2 ring-[var(--surface-canvas)]" />
						)}
					</>
				)}
			</NavLink>
			{!collapsed && onDelete && (
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onDelete();
					}}
					title="删除文件夹"
					aria-label={`删除文件夹 ${label}`}
					className="opacity-0 group-hover/folder:opacity-100 focus:opacity-100 absolute right-2 p-1 rounded-md text-kumo-subtle hover:text-kumo-danger hover:bg-kumo-base transition-all cursor-pointer bg-transparent border-0"
				>
					<TrashIcon size={13} />
				</button>
			)}
		</div>
	);

	if (collapsed) {
		return (
			<Tooltip
				content={
					unreadCount
						? `${label}（${unreadCount} 未读）${shortcutHint ? ` · ${shortcutHint}` : ""}`
						: `${label}${shortcutHint ? ` · ${shortcutHint}` : ""}`
				}
				side="right"
				asChild
			>
				{linkEl}
			</Tooltip>
		);
	}

	return linkEl;
}

export default function Sidebar() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const location = useLocation();
	const navigate = useNavigate();
	const toastManager = useKumoToastManager();
	const { data: user } = useCurrentUser();
	const logoutMutation = useLogout();
	const { data: folders = [] } = useFolders(mailboxId);
	const createFolderMutation = useCreateFolder();
	const deleteFolderMutation = useDeleteFolder();
	const {
		startCompose,
		openComposeModal,
		closeSidebar,
		isSidebarCollapsed,
		toggleSidebarCollapsed,
		theme,
		toggleTheme,
		toggleShortcuts,
	} = useUIStore();
	const { data: currentMailbox } = useMailbox(mailboxId);
	const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");

	const encodedMailboxId = mailboxId ? encodeURIComponent(mailboxId) : "";

	const customFolders = useMemo(
		() =>
			folders.filter(
				(f) =>
					!(SYSTEM_FOLDER_IDS as readonly string[]).includes(f.id) &&
					f.id !== Folders.SPAM,
			),
		[folders],
	);

	const getUnreadCount = (folderId: string) => {
		const found = folders.find((f) => f.id === folderId);
		return found?.unreadCount || 0;
	};

	const handleComposeClick = () => {
		const isSplitPage =
			location.pathname.includes("/emails/") ||
			location.pathname.includes("/search");
		if (isSplitPage) {
			startCompose();
		} else {
			openComposeModal();
			closeSidebar();
		}
	};

	const handleCreateFolder = async (e: React.FormEvent) => {
		e.preventDefault();
		if (newFolderName.trim() && mailboxId) {
			try {
				await createFolderMutation.mutateAsync({
					mailboxId,
					name: newFolderName.trim(),
				});
				toastManager.add({ title: "文件夹已创建" });
				setNewFolderName("");
				setIsCreateFolderOpen(false);
			} catch (err: unknown) {
				toastManager.add({
					title: err instanceof Error ? err.message : "创建文件夹失败",
					variant: "error",
				});
			}
		}
	};

	const handleDeleteFolder = async (folderId: string, folderName: string) => {
		if (!mailboxId) return;
		if (
			!window.confirm(
				`确定要删除文件夹「${folderName}」吗？其中的邮件将被一并删除。`,
			)
		) {
			return;
		}
		try {
			await deleteFolderMutation.mutateAsync({ mailboxId, id: folderId });
			toastManager.add({ title: `已删除文件夹「${folderName}」` });
			if (location.pathname.endsWith(`/emails/${folderId}`)) {
				navigate(`/mailbox/${encodedMailboxId}/emails/inbox`);
			}
		} catch (err: unknown) {
			toastManager.add({
				title: err instanceof Error ? err.message : "删除文件夹失败",
				variant: "error",
			});
		}
	};

	const handleLogout = async () => {
		await logoutMutation.mutateAsync();
		closeSidebar();
		navigate("/login", { replace: true });
	};

	const displayName = useMemo(() => {
		if (currentMailbox?.settings?.fromName) {
			return currentMailbox.settings.fromName;
		}
		if (user?.displayName) return user.displayName;
		if (currentMailbox?.name && currentMailbox.name !== currentMailbox.email) {
			return currentMailbox.name;
		}
		return mailboxId?.split("@")[0] || "我的邮箱";
	}, [currentMailbox, user, mailboxId]);

	const avatarChar = getInitials(displayName || mailboxId || "U");
	const handleNavClick = () => closeSidebar();

	return (
		<aside className="h-full w-full flex flex-col bg-[var(--surface-rail)] md:bg-transparent border-r border-kumo-line md:border-r-0 select-none">
			{/* 顶部身份卡片 + 折叠按钮 */}
			<div className={isSidebarCollapsed ? "px-2 pt-3 pb-2" : "px-2.5 pt-2.5 pb-2"}>
				<div
					className={`flex items-center rounded-xl transition-all ${
						isSidebarCollapsed
							? "justify-center py-1.5"
							: "gap-2.5 px-2.5 py-2 craft-card"
					}`}
				>
					<Tooltip
						content={
							isSidebarCollapsed
								? `${displayName} (${currentMailbox?.email || mailboxId})`
								: ""
						}
						side="right"
						asChild
					>
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6e7bf2] to-[#4f46e5] text-white text-xs font-semibold shadow-[0_2px_10px_-2px_rgba(99,114,241,0.6)]">
							{avatarChar}
						</div>
					</Tooltip>
					{!isSidebarCollapsed && (
						<>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1.5">
									<span className="text-[13.5px] font-semibold text-kumo-default truncate">
										{displayName}
									</span>
									{user?.role === "admin" && (
										<span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md craft-accent-badge">
											管理员
										</span>
									)}
								</div>
								<div className="text-[11px] text-kumo-subtle truncate font-mono mt-0.5">
									{currentMailbox?.email || mailboxId}
								</div>
							</div>
							<Tooltip content="折叠导航栏 [" side="right" asChild>
								<button
									type="button"
									onClick={toggleSidebarCollapsed}
									className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
									aria-label="折叠侧边栏"
								>
									<SidebarSimpleIcon size={15} />
								</button>
							</Tooltip>
						</>
					)}
				</div>
				{isSidebarCollapsed && (
					<div className="hidden md:flex justify-center mt-1.5">
						<Tooltip content="展开导航栏 [" side="right" asChild>
							<button
								type="button"
								onClick={toggleSidebarCollapsed}
								className="flex h-8 w-8 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
								aria-label="展开侧边栏"
							>
								<SidebarSimpleIcon size={16} />
							</button>
						</Tooltip>
					</div>
				)}
			</div>

			{/* 写邮件核心动作按钮 */}
			<div className={isSidebarCollapsed ? "px-2 py-2 flex justify-center" : "px-2.5 py-2"}>
				<Tooltip content={isSidebarCollapsed ? "写邮件 (C)" : ""} side="right" asChild>
					<button
						type="button"
						onClick={handleComposeClick}
						className={`group flex items-center justify-center gap-2 rounded-xl font-medium text-[13.5px] text-white bg-[var(--craft-accent)] hover:bg-[var(--craft-accent-hover)] active:scale-[0.985] transition-all cursor-pointer border-0 shadow-[0_6px_20px_-6px_var(--craft-accent-ring),inset_0_1px_0_rgba(255,255,255,0.22)] ${
							isSidebarCollapsed ? "h-10 w-10 p-0" : "w-full h-9.5 px-3.5"
						}`}
					>
						<PencilSimpleIcon size={16} weight="bold" />
						{!isSidebarCollapsed && (
							<>
								<span className="flex-1 text-left">写邮件</span>
								<kbd className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md font-mono text-[10px] bg-white/18 text-white/95 border border-white/20">
									C
								</kbd>
							</>
						)}
					</button>
				</Tooltip>
			</div>

			{/* 文件夹列表 */}
			<nav
				className={`flex-1 overflow-y-auto py-1 space-y-0.5 ${
					isSidebarCollapsed ? "px-2" : "px-2.5"
				}`}
			>
				{SYSTEM_FOLDER_LINKS.map((folder) => (
					<FolderLink
						key={folder.id}
						to={`/mailbox/${encodedMailboxId}/emails/${folder.id}`}
						Icon={folder.Icon}
						label={folder.label}
						unreadCount={getUnreadCount(folder.id)}
						collapsed={isSidebarCollapsed}
						shortcutHint={folder.shortcut}
						onClick={handleNavClick}
					/>
				))}

				{/* 自定义文件夹 */}
				<div className="pt-4">
					{!isSidebarCollapsed ? (
						<div className="flex items-center justify-between px-3 mb-1.5">
							<span className="text-[11px] tracking-wider font-medium text-kumo-subtle uppercase">
								自定义文件夹
							</span>
							<Tooltip content="新建文件夹" asChild>
								<button
									type="button"
									onClick={() => setIsCreateFolderOpen(true)}
									className="flex h-6 w-6 items-center justify-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
									aria-label="新建文件夹"
								>
									<PlusIcon size={14} />
								</button>
							</Tooltip>
						</div>
					) : (
						<div className="flex justify-center mb-1.5 pt-1 border-t border-kumo-line">
							<Tooltip content="新建文件夹" side="right" asChild>
								<button
									type="button"
									onClick={() => setIsCreateFolderOpen(true)}
									className="flex h-8 w-8 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
									aria-label="新建文件夹"
								>
									<PlusIcon size={15} />
								</button>
							</Tooltip>
						</div>
					)}
					{customFolders.length === 0 ? (
						!isSidebarCollapsed && (
							<p className="px-3 py-1.5 text-xs text-kumo-subtle/75">
								暂无自定义文件夹
							</p>
						)
					) : (
						<div className="space-y-0.5">
							{customFolders.map((folder) => (
								<FolderLink
									key={folder.id}
									to={`/mailbox/${encodedMailboxId}/emails/${folder.id}`}
									Icon={FolderIcon}
									label={folder.name}
									unreadCount={folder.unreadCount}
									collapsed={isSidebarCollapsed}
									onClick={handleNavClick}
									onDelete={() => handleDeleteFolder(folder.id, folder.name)}
								/>
							))}
						</div>
					)}
				</div>
			</nav>

			{/* 底部快捷工具区 */}
			<div
				className={`border-t border-kumo-line space-y-0.5 shrink-0 ${
					isSidebarCollapsed ? "p-2" : "p-2.5"
				}`}
			>
				<FolderLink
					to={`/mailbox/${encodedMailboxId}/settings`}
					Icon={KeyIcon}
					label="MCP 密钥与设置"
					collapsed={isSidebarCollapsed}
					shortcutHint="G M"
					onClick={handleNavClick}
				/>
				{user?.role === "admin" && (
					<FolderLink
						to={`/mailbox/${encodedMailboxId}/admin`}
						Icon={ShieldCheckIcon}
						label="管理员控制台"
						collapsed={isSidebarCollapsed}
						onClick={handleNavClick}
					/>
				)}

				{!isSidebarCollapsed ? (
					<div className="flex items-center justify-between gap-1 pt-1.5 mt-1 border-t border-kumo-line/60">
						<Tooltip content={theme === "dark" ? "切至暖白浅色" : "切至黑曜石深色"} side="top" asChild>
							<button
								type="button"
								onClick={toggleTheme}
								className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
							>
								{theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
								<span>{theme === "dark" ? "浅色" : "深色"}</span>
							</button>
						</Tooltip>
						<Tooltip content="键盘快捷键 (?)" side="top" asChild>
							<button
								type="button"
								onClick={toggleShortcuts}
								className="flex h-7 w-7 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
								aria-label="快捷键"
							>
								<KeyboardIcon size={15} />
							</button>
						</Tooltip>
						<Tooltip content="退出登录" side="top" asChild>
							<button
								type="button"
								onClick={handleLogout}
								disabled={logoutMutation.isPending}
								className="flex h-7 w-7 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-danger hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0 ml-auto"
								aria-label="退出登录"
							>
								<SignOutIcon size={15} />
							</button>
						</Tooltip>
					</div>
				) : (
					<div className="flex flex-col items-center gap-1 pt-1.5 mt-1 border-t border-kumo-line/60">
						<Tooltip content={theme === "dark" ? "切换浅色模式" : "切换深色模式"} side="right" asChild>
							<button
								type="button"
								onClick={toggleTheme}
								className="flex h-9 w-9 items-center justify-center rounded-xl text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
								aria-label="切换主题"
							>
								{theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
							</button>
						</Tooltip>
						<Tooltip content="退出登录" side="right" asChild>
							<button
								type="button"
								onClick={handleLogout}
								disabled={logoutMutation.isPending}
								className="flex h-9 w-9 items-center justify-center rounded-xl text-kumo-subtle hover:text-kumo-danger hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
								aria-label="退出登录"
							>
								<SignOutIcon size={16} />
							</button>
						</Tooltip>
					</div>
				)}
			</div>

			{/* 新建文件夹弹窗 */}
			<Dialog.Root
				open={isCreateFolderOpen}
				onOpenChange={setIsCreateFolderOpen}
			>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-4">
						新建文件夹
					</Dialog.Title>
					<form onSubmit={handleCreateFolder} className="space-y-4">
						<Input
							label="文件夹名称"
							className="w-full"
							placeholder="例如：工作、账单、重要"
							value={newFolderName}
							onChange={(e) => setNewFolderName(e.target.value)}
							required
						/>
						<div className="flex justify-end gap-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										取消
									</Button>
								)}
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={createFolderMutation.isPending}
								disabled={!newFolderName.trim()}
							>
								创建
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
		</aside>
	);
}
