// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Badge,
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
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	PlusIcon,
	ShieldCheckIcon,
	SignOutIcon,
	TrashIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router";
import { Folders, SYSTEM_FOLDER_IDS } from "shared/folders";
import { useUIStore } from "~/hooks/useUIStore";
import { useCurrentUser, useLogout } from "~/queries/auth";
import {
	useCreateFolder,
	useDeleteFolder,
	useFolders,
} from "~/queries/folders";
import { useMailbox } from "~/queries/mailboxes";

const FOLDER_ICONS: Record<string, React.ReactNode> = {
	[Folders.INBOX]: <TrayIcon size={17} weight="regular" />,
	[Folders.SENT]: <PaperPlaneTiltIcon size={17} weight="regular" />,
	[Folders.DRAFT]: <FileIcon size={17} weight="regular" />,
	[Folders.ARCHIVE]: <ArchiveIcon size={17} weight="regular" />,
	[Folders.TRASH]: <TrashIcon size={17} weight="regular" />,
};

const SYSTEM_FOLDER_LINKS = [
	{ id: Folders.INBOX, label: "收件箱" },
	{ id: Folders.SENT, label: "已发送" },
	{ id: Folders.DRAFT, label: "草稿箱" },
	{ id: Folders.ARCHIVE, label: "归档" },
	{ id: Folders.TRASH, label: "回收站" },
];

interface FolderLinkProps {
	to: string;
	icon: React.ReactNode;
	label: string;
	unreadCount?: number;
	onClick?: () => void;
	onDelete?: () => void;
}

function FolderLink({
	to,
	icon,
	label,
	unreadCount,
	onClick,
	onDelete,
}: FolderLinkProps) {
	return (
		<div className="group/folder relative flex items-center">
			<NavLink
				to={to}
				onClick={onClick}
				className={({ isActive }) =>
					`flex-1 flex items-center gap-2.5 py-2 px-3 rounded-lg text-[13.5px] transition-colors ${
						isActive
							? "bg-kumo-base font-medium text-kumo-default shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-kumo-line"
							: "text-kumo-strong hover:bg-kumo-tint/80"
					}`
				}
			>
				<span className="shrink-0 opacity-85">{icon}</span>
				<span className="truncate flex-1">{label}</span>
				{unreadCount != null && unreadCount > 0 && (
					<span className="tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-kumo-brand/12 text-kumo-brand">
						{unreadCount}
					</span>
				)}
			</NavLink>
			{onDelete && (
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onDelete();
					}}
					title="删除文件夹"
					aria-label={`删除文件夹 ${label}`}
					className="opacity-0 group-hover/folder:opacity-100 focus:opacity-100 absolute right-2 p-1 rounded text-kumo-subtle hover:text-kumo-destructive hover:bg-kumo-base transition-all cursor-pointer bg-transparent border-0"
				>
					<TrashIcon size={13} />
				</button>
			)}
		</div>
	);
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
	const { startCompose, openComposeModal, closeSidebar } = useUIStore();
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
			// 在设置页或管理后台点击「写邮件」时使用弹窗写信，无需跳离当前页
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

	const avatarChar = (displayName || mailboxId || "U").trim().charAt(0).toUpperCase();

	const handleNavClick = () => {
		closeSidebar();
	};

	return (
		<aside className="h-full w-64 bg-kumo-recessed flex flex-col shrink-0 border-r border-kumo-line">
			{/* 当前账户身份卡片 */}
			<div className="px-3.5 pt-4 pb-2">
				<div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-kumo-base/75 border border-kumo-line/80">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-sm font-semibold ring-1 ring-blue-600/15">
						{avatarChar}
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-1.5">
							<span className="text-sm font-semibold text-kumo-default truncate">
								{displayName}
							</span>
							{user?.role === "admin" && (
								<Badge variant="primary">管理员</Badge>
							)}
						</div>
						<div className="text-[11.5px] text-kumo-subtle truncate font-mono mt-0.5">
							{currentMailbox?.email || mailboxId}
						</div>
					</div>
				</div>
			</div>

			{/* 写邮件 */}
			<div className="px-3.5 py-2.5">
				<Button
					variant="primary"
					icon={<PencilSimpleIcon size={16} />}
					onClick={handleComposeClick}
					className="w-full justify-center"
				>
					写邮件
				</Button>
			</div>

			{/* 文件夹导航 */}
			<nav className="flex-1 overflow-y-auto px-2.5 py-1 space-y-0.5">
				{SYSTEM_FOLDER_LINKS.map((folder) => (
					<FolderLink
						key={folder.id}
						to={`/mailbox/${encodedMailboxId}/emails/${folder.id}`}
						icon={FOLDER_ICONS[folder.id]}
						label={folder.label}
						unreadCount={getUnreadCount(folder.id)}
						onClick={handleNavClick}
					/>
				))}

				{/* 自定义文件夹 */}
				<div className="pt-5">
					<div className="flex items-center justify-between px-3 mb-1.5">
						<span className="text-[11px] tracking-wider font-semibold text-kumo-subtle">
							自定义文件夹
						</span>
						<Tooltip content="新建文件夹" asChild>
							<Button
								variant="ghost"
								shape="square"
								size="sm"
								icon={<PlusIcon size={15} />}
								onClick={() => setIsCreateFolderOpen(true)}
								aria-label="新建文件夹"
							/>
						</Tooltip>
					</div>
					{customFolders.length === 0 ? (
						<p className="px-3 py-1.5 text-xs text-kumo-subtle/75">
							暂无自定义文件夹
						</p>
					) : (
						<div className="space-y-0.5">
							{customFolders.map((folder) => (
								<FolderLink
									key={folder.id}
									to={`/mailbox/${encodedMailboxId}/emails/${folder.id}`}
									icon={<FolderIcon size={17} />}
									label={folder.name}
									unreadCount={folder.unreadCount}
									onClick={handleNavClick}
									onDelete={() => handleDeleteFolder(folder.id, folder.name)}
								/>
							))}
						</div>
					)}
				</div>
			</nav>

			{/* 底部管理与退出栏 */}
			<div className="p-2.5 border-t border-kumo-line space-y-0.5 shrink-0 bg-kumo-recessed">
				<FolderLink
					to={`/mailbox/${encodedMailboxId}/settings`}
					icon={<KeyIcon size={17} />}
					label="MCP 密钥与设置"
					onClick={handleNavClick}
				/>
				{user?.role === "admin" && (
					<FolderLink
						to={`/mailbox/${encodedMailboxId}/admin`}
						icon={<ShieldCheckIcon size={17} />}
						label="管理员控制台"
						onClick={handleNavClick}
					/>
				)}
				<button
					type="button"
					onClick={handleLogout}
					disabled={logoutMutation.isPending}
					className="w-full flex items-center gap-2.5 py-2 px-3 rounded-lg text-[13.5px] text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint/80 transition-colors cursor-pointer bg-transparent border-0"
				>
					<SignOutIcon size={17} />
					<span>退出登录</span>
				</button>
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
