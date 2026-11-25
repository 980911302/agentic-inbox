// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Tooltip } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowBendUpLeftIcon,
	ArrowBendUpRightIcon,
	ArrowLeftIcon,
	ChatCircleIcon,
	CodeIcon,
	CornersInIcon,
	CornersOutIcon,
	EnvelopeOpenIcon,
	EnvelopeSimpleIcon,
	FolderSimpleIcon,
	MoonIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	StarIcon,
	SunIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { getFolderDisplayName } from "shared/folders";
import type { Email, Folder } from "~/types";

interface EmailPanelToolbarProps {
	email: Email;
	mailboxId?: string;
	isDraftFolder: boolean;
	isArchiveFolder?: boolean;
	isSending: boolean;
	isFocusMode?: boolean;
	isDarkTheme?: boolean;
	paperMode?: "auto" | "light" | "dark";
	moveToFolders: Folder[];
	lastReceivedMessage?: Email;
	onBack: () => void;
	onSendDraft: () => void;
	onEditDraft: () => void;
	onReply: () => void;
	onReplyAll: () => void;
	onForward: () => void;
	onArchive?: () => void;
	onToggleStar: () => void;
	onToggleRead: () => void;
	onToggleFocus?: () => void;
	onTogglePaperMode?: () => void;
	onMove: (folderId: string) => void;
	onViewSource: () => void;
	onDelete: () => void;
}

function ToolIconBtn({
	tooltip,
	onClick,
	icon,
	active,
	danger,
	className = "",
}: {
	tooltip: string;
	onClick: () => void;
	icon: React.ReactNode;
	active?: boolean;
	danger?: boolean;
	className?: string;
}) {
	return (
		<Tooltip content={tooltip} side="bottom" asChild>
			<button
				type="button"
				onClick={onClick}
				aria-label={tooltip}
				className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer border ${
					active
						? "craft-accent-badge"
						: danger
							? "border-transparent bg-transparent text-kumo-subtle hover:text-kumo-danger hover:bg-rose-500/10"
							: "border-transparent bg-transparent text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)]"
				} ${className}`}
			>
				{icon}
			</button>
		</Tooltip>
	);
}

export default function EmailPanelToolbar({
	email,
	isDraftFolder,
	isArchiveFolder,
	isSending,
	isFocusMode,
	isDarkTheme,
	paperMode,
	moveToFolders,
	onBack,
	onSendDraft,
	onEditDraft,
	onReply,
	onReplyAll,
	onForward,
	onArchive,
	onToggleStar,
	onToggleRead,
	onToggleFocus,
	onTogglePaperMode,
	onMove,
	onViewSource,
	onDelete,
}: EmailPanelToolbarProps) {
	return (
		<div className="flex items-center gap-1 px-3 py-2 border-b border-kumo-line shrink-0 md:px-4 bg-kumo-base/80 backdrop-blur-sm">
			<ToolIconBtn
				tooltip="返回列表"
				onClick={onBack}
				icon={<ArrowLeftIcon size={17} />}
				className="md:hidden shrink-0"
			/>

			{isDraftFolder ? (
				<div className="flex items-center gap-1.5">
					<Button
						variant="primary"
						size="sm"
						icon={<PaperPlaneTiltIcon size={15} />}
						onClick={onSendDraft}
						loading={isSending}
					>
						{isSending ? "发送中..." : "发送"}
					</Button>
					<Button
						variant="secondary"
						size="sm"
						icon={<PencilSimpleIcon size={15} />}
						onClick={onEditDraft}
					>
						编辑
					</Button>
				</div>
			) : (
				<>
					<ToolIconBtn
						tooltip="回复 (R)"
						onClick={onReply}
						icon={<ArrowBendUpLeftIcon size={16} />}
					/>
					<ToolIconBtn
						tooltip="回复全部 (A)"
						onClick={onReplyAll}
						icon={<ChatCircleIcon size={16} />}
					/>
					<ToolIconBtn
						tooltip="转发 (⇧F)"
						onClick={onForward}
						icon={<ArrowBendUpRightIcon size={16} />}
					/>
				</>
			)}

			<div className="h-4 w-px bg-kumo-line mx-1" />

			{!isArchiveFolder && onArchive && (
				<ToolIconBtn
					tooltip="归档 (E)"
					onClick={onArchive}
					icon={<ArchiveIcon size={16} />}
				/>
			)}

			<ToolIconBtn
				tooltip={email.starred ? "取消星标 (S)" : "添加星标 (S)"}
				onClick={onToggleStar}
				icon={
					<StarIcon
						size={16}
						weight={email.starred ? "fill" : "regular"}
						className={email.starred ? "text-amber-400" : ""}
					/>
				}
			/>

			<ToolIconBtn
				tooltip={email.read ? "标为未读 (U)" : "标为已读 (U)"}
				onClick={onToggleRead}
				icon={
					email.read ? (
						<EnvelopeSimpleIcon size={16} />
					) : (
						<EnvelopeOpenIcon size={16} />
					)
				}
			/>

			<MoveToFolderMenu folders={moveToFolders} onMove={onMove} />

			<div className="ml-auto flex items-center gap-1">
				{isDarkTheme && onTogglePaperMode && (
					<ToolIconBtn
						tooltip={
							paperMode === "light"
								? "切换暗色正文底色"
								: "切换原色浅纸阅读"
						}
						onClick={onTogglePaperMode}
						active={paperMode === "light"}
						icon={
							paperMode === "light" ? (
								<MoonIcon size={16} />
							) : (
								<SunIcon size={16} />
							)
						}
					/>
				)}
				{onToggleFocus && (
					<ToolIconBtn
						tooltip={isFocusMode ? "退出专注阅读 (F)" : "专注阅读模式 (F)"}
						onClick={onToggleFocus}
						active={isFocusMode}
						icon={
							isFocusMode ? (
								<CornersInIcon size={16} />
							) : (
								<CornersOutIcon size={16} />
							)
						}
						className="hidden md:flex"
					/>
				)}
				<ToolIconBtn
					tooltip="查看原始邮件头"
					onClick={onViewSource}
					icon={<CodeIcon size={16} />}
				/>
				<ToolIconBtn
					tooltip="删除 (#)"
					onClick={onDelete}
					danger
					icon={<TrashIcon size={16} />}
				/>
				<ToolIconBtn
					tooltip="关闭 (ESC)"
					onClick={onBack}
					icon={<XIcon size={16} />}
					className="hidden md:flex"
				/>
			</div>
		</div>
	);
}

function MoveToFolderMenu({
	folders,
	onMove,
}: {
	folders: Folder[];
	onMove: (id: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	return (
		<div ref={ref} className="relative">
			<ToolIconBtn
				tooltip="移动到文件夹"
				onClick={() => setOpen((o) => !o)}
				active={open}
				icon={<FolderSimpleIcon size={16} />}
			/>
			{open && (
				<div className="absolute top-full left-0 z-50 mt-1.5 min-w-[168px] rounded-xl craft-glass-strong py-1.5 animate-craft-scale">
					<div className="px-3 py-1 text-[11px] font-medium tracking-wider text-kumo-subtle uppercase">
						移动到文件夹
					</div>
					<div className="h-px bg-kumo-line my-1" />
					{folders.map((f) => (
						<button
							key={f.id}
							type="button"
							className="w-full text-left px-3 py-1.5 text-[13px] text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
							onClick={() => {
								onMove(f.id);
								setOpen(false);
							}}
						>
							{getFolderDisplayName(f.id === f.name.toLowerCase() ? f.id : f.name)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
