// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Pagination, Tooltip, useKumoToastManager } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowBendUpLeftIcon,
	ArrowsClockwiseIcon,
	CheckIcon,
	EnvelopeOpenIcon,
	EnvelopeSimpleIcon,
	FileIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	StarIcon,
	TrashIcon,
	TrayIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { formatListDate } from "shared/dates";
import { Folders, getFolderDisplayName } from "shared/folders";
import MailboxSplitView from "~/components/MailboxSplitView";
import { useUIStore } from "~/hooks/useUIStore";
import {
	getAvatarTone,
	getCatchAllAlias,
	getInitials,
	getTimeBucket,
	isEditableEventTarget,
	type TimeBucket,
} from "~/lib/ui-helpers";
import { getSnippetText } from "~/lib/utils";
import {
	useDeleteEmail,
	useEmails,
	useMarkThreadRead,
	useMoveEmail,
	useUpdateEmail,
} from "~/queries/emails";
import { useFolders } from "~/queries/folders";
import { queryKeys } from "~/queries/keys";
import type { Email } from "~/types";

const PAGE_SIZE = 25;
type QuickFilter = "all" | "unread" | "starred";

const FOLDER_EMPTY_STATES: Record<
	string,
	{
		icon: React.ReactNode;
		title: string;
		description: string;
		showCompose?: boolean;
	}
> = {
	[Folders.INBOX]: {
		icon: <TrayIcon size={34} weight="duotone" className="text-[var(--craft-accent)]" />,
		title: "收件箱已清空",
		description: "新邮件到达后会实时显示在这里，也可以按 C 键立即开始写信。",
		showCompose: true,
	},
	[Folders.SENT]: {
		icon: (
			<PaperPlaneTiltIcon size={34} weight="duotone" className="text-[var(--craft-accent)]" />
		),
		title: "暂无已发送邮件",
		description: "你发出的邮件将会保存在这里。",
		showCompose: true,
	},
	[Folders.DRAFT]: {
		icon: <FileIcon size={34} weight="duotone" className="text-[var(--craft-accent)]" />,
		title: "暂无草稿",
		description: "尚未发送的邮件草稿会保存在这里。",
		showCompose: true,
	},
	[Folders.ARCHIVE]: {
		icon: <ArchiveIcon size={34} weight="duotone" className="text-[var(--craft-accent)]" />,
		title: "归档夹为空",
		description: "按 E 键即可将处理完的邮件快速归档，保持收件箱轻盈整洁。",
	},
	[Folders.TRASH]: {
		icon: <TrashIcon size={34} weight="duotone" className="text-[var(--craft-accent)]" />,
		title: "回收站为空",
		description: "移入回收站的邮件会显示在这里。",
	},
};

function EmailListSkeleton() {
	return (
		<div className="space-y-1 p-3">
			{Array.from({ length: 8 }).map((_, i) => (
				<div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl">
					<div className="w-8 h-8 rounded-full skeleton bg-kumo-fill shrink-0" />
					<div className="flex-1 space-y-2">
						<div className="flex items-center gap-2">
							<div className="h-3 w-24 rounded-md skeleton bg-kumo-fill" />
							<div className="h-3 w-12 rounded-md skeleton bg-kumo-fill ml-auto" />
						</div>
						<div className="h-2.5 w-3/4 rounded-md skeleton bg-kumo-fill" />
					</div>
				</div>
			))}
		</div>
	);
}

function FolderEmptyState({
	folder,
	filter,
	onResetFilter,
	onCompose,
}: {
	folder?: string;
	filter: QuickFilter;
	onResetFilter: () => void;
	onCompose: () => void;
}) {
	if (filter !== "all") {
		return (
			<div className="flex flex-col items-center justify-center py-24 px-6 text-center">
				<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl craft-accent-badge">
					<EnvelopeOpenIcon size={28} weight="duotone" />
				</div>
				<h3 className="text-sm font-semibold text-kumo-default mb-1">
					{filter === "unread" ? "没有未读邮件" : "没有星标邮件"}
				</h3>
				<p className="text-xs text-kumo-subtle max-w-xs mb-4">
					当前筛选条件下暂无会话。
				</p>
				<Button variant="secondary" size="sm" onClick={onResetFilter}>
					查看全部邮件
				</Button>
			</div>
		);
	}

	const config = (folder && FOLDER_EMPTY_STATES[folder]) || {
		icon: (
			<EnvelopeSimpleIcon size={34} weight="duotone" className="text-[var(--craft-accent)]" />
		),
		title: "暂无邮件",
		description: "该文件夹当前没有任何邮件。",
	};

	return (
		<div className="flex flex-col items-center justify-center py-24 px-6 text-center">
			<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl craft-accent-badge">
				{config.icon}
			</div>
			<h3 className="text-base font-semibold text-kumo-default mb-1.5">
				{config.title}
			</h3>
			<p className="text-xs text-kumo-subtle max-w-xs leading-relaxed mb-5">
				{config.description}
			</p>
			{"showCompose" in config && config.showCompose && (
				<Button
					variant="primary"
					size="sm"
					icon={<PencilSimpleIcon size={15} />}
					onClick={onCompose}
				>
					写邮件
				</Button>
			)}
		</div>
	);
}

export default function EmailListRoute() {
	const { mailboxId, folder } = useParams<{
		mailboxId: string;
		folder: string;
	}>();
	const toastManager = useKumoToastManager();
	const {
		selectedEmailId,
		focusedEmailId,
		setFocusedEmailId,
		isComposing,
		selectEmail,
		closePanel,
		startCompose,
		selectedIds,
		toggleSelectId,
		clearSelection,
	} = useUIStore();
	const [page, setPage] = useState(1);
	const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
	const listContainerRef = useRef<HTMLDivElement>(null);

	const queryClient = useQueryClient();
	const updateEmail = useUpdateEmail();
	const markThreadRead = useMarkThreadRead();
	const deleteEmail = useDeleteEmail();
	const moveEmail = useMoveEmail();

	const params = useMemo(
		() => ({
			folder: folder || "",
			page: String(page),
			limit: String(PAGE_SIZE),
		}),
		[folder, page],
	);

	// 15 秒静默后台轮询，配合窗口切回自动刷新，确保新邮件即时呈现
	const { data: emailData, isFetching: isRefreshing } = useEmails(
		mailboxId,
		params,
		{ refetchInterval: 15_000 },
	);

	const rawEmails = emailData?.emails ?? [];
	const totalCount = emailData?.totalCount ?? 0;

	const hasUnread = useCallback((email: Email): boolean => {
		if (email.thread_unread_count !== undefined) {
			return email.thread_unread_count > 0;
		}
		return !email.read;
	}, []);

	const emails = useMemo(() => {
		if (quickFilter === "unread") return rawEmails.filter((e) => hasUnread(e));
		if (quickFilter === "starred") return rawEmails.filter((e) => e.starred);
		return rawEmails;
	}, [rawEmails, quickFilter, hasUnread]);

	const unreadInPage = useMemo(
		() => rawEmails.filter((e) => hasUnread(e)).length,
		[rawEmails, hasUnread],
	);

	// 按时间桶分组：今天 / 昨天 / 近 7 天 / 更早
	const groupedEmails = useMemo(() => {
		const groups: { bucket: TimeBucket; items: Email[] }[] = [];
		for (const email of emails) {
			const bucket = getTimeBucket(email.date);
			const last = groups[groups.length - 1];
			if (last && last.bucket === bucket) {
				last.items.push(email);
			} else {
				groups.push({ bucket, items: [email] });
			}
		}
		return groups;
	}, [emails]);

	const { data: folders = [] } = useFolders(mailboxId);

	const folderName = useMemo(() => {
		if (folder && folder in FOLDER_EMPTY_STATES) {
			return getFolderDisplayName(folder);
		}
		const found = folders.find((f) => f.id === folder);
		if (found) return getFolderDisplayName(found.name);
		return folder ? getFolderDisplayName(folder) : "收件箱";
	}, [folders, folder]);

	const isPanelOpen = selectedEmailId !== null || isComposing;
	const prevFolderRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		const folderChanged = prevFolderRef.current !== `${mailboxId}/${folder}`;
		prevFolderRef.current = `${mailboxId}/${folder}`;

		if (folderChanged) {
			closePanel();
			clearSelection();
			setFocusedEmailId(null);
			setQuickFilter("all");
			setPage(1);
		}
	}, [mailboxId, folder, closePanel, clearSelection, setFocusedEmailId]);

	const handleRefresh = useCallback(() => {
		if (mailboxId) {
			queryClient.invalidateQueries({ queryKey: ["emails", mailboxId] });
			queryClient.invalidateQueries({
				queryKey: queryKeys.folders.list(mailboxId),
			});
		}
	}, [mailboxId, queryClient]);

	const openEmail = useCallback(
		(email: Email) => {
			selectEmail(email.id);
			if (mailboxId && hasUnread(email)) {
				if (email.thread_id && email.thread_count && email.thread_count > 1) {
					markThreadRead.mutate({
						mailboxId,
						threadId: email.thread_id,
					});
				} else {
					updateEmail.mutate({
						mailboxId,
						id: email.id,
						data: { read: true },
					});
				}
			}
		},
		[selectEmail, mailboxId, hasUnread, markThreadRead, updateEmail],
	);

	const handleArchiveSingle = useCallback(
		(email: Email) => {
			if (!mailboxId || folder === Folders.ARCHIVE) return;
			moveEmail.mutate({
				mailboxId,
				id: email.id,
				folderId: Folders.ARCHIVE,
			});
			if (selectedEmailId === email.id) closePanel();
			toastManager.add({ title: "已归档会话" });
		},
		[mailboxId, folder, moveEmail, selectedEmailId, closePanel, toastManager],
	);

	const handleDeleteSingle = useCallback(
		(emailId: string, skipConfirm = false) => {
			if (!mailboxId) return;
			if (!skipConfirm && !window.confirm("确定要删除这封邮件吗？")) return;
			deleteEmail.mutate({ mailboxId, id: emailId });
			if (selectedEmailId === emailId) closePanel();
		},
		[mailboxId, deleteEmail, selectedEmailId, closePanel],
	);

	// 列表级 Superhuman 键盘流：J/K 上下移动、Enter/O 打开、X 多选、E 归档、S 星标、U 已读/未读、# 删除
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const state = useUIStore.getState();
			if (
				state.isCommandPaletteOpen ||
				state.isShortcutsOpen ||
				state.isComposeModalOpen ||
				state.isComposing ||
				isEditableEventTarget(e.target) ||
				e.metaKey ||
				e.ctrlKey ||
				e.altKey ||
				emails.length === 0
			) {
				return;
			}

			const key = e.key.toLowerCase();
			const activeId = state.focusedEmailId || state.selectedEmailId;
			const currentIdx = activeId
				? emails.findIndex((item) => item.id === activeId)
				: -1;
			const activeEmail = currentIdx >= 0 ? emails[currentIdx] : null;

			if (key === "j" || e.key === "ArrowDown") {
				e.preventDefault();
				const nextIdx = currentIdx < emails.length - 1 ? currentIdx + 1 : 0;
				const nextEmail = emails[nextIdx];
				if (nextEmail) {
					setFocusedEmailId(nextEmail.id);
					if (state.selectedEmailId) openEmail(nextEmail);
					listContainerRef.current
						?.querySelector(`[data-email-id="${nextEmail.id}"]`)
						?.scrollIntoView({ block: "nearest" });
				}
				return;
			}

			if (key === "k" || e.key === "ArrowUp") {
				e.preventDefault();
				const prevIdx = currentIdx > 0 ? currentIdx - 1 : emails.length - 1;
				const prevEmail = emails[prevIdx];
				if (prevEmail) {
					setFocusedEmailId(prevEmail.id);
					if (state.selectedEmailId) openEmail(prevEmail);
					listContainerRef.current
						?.querySelector(`[data-email-id="${prevEmail.id}"]`)
						?.scrollIntoView({ block: "nearest" });
				}
				return;
			}

			if ((e.key === "Enter" || key === "o") && activeEmail && !state.selectedEmailId) {
				e.preventDefault();
				openEmail(activeEmail);
				return;
			}

			if (key === "x" && activeEmail) {
				e.preventDefault();
				toggleSelectId(activeEmail.id);
				return;
			}

			if (key === "e" && activeEmail) {
				e.preventDefault();
				handleArchiveSingle(activeEmail);
				return;
			}

			if (key === "s" && activeEmail && mailboxId) {
				e.preventDefault();
				updateEmail.mutate({
					mailboxId,
					id: activeEmail.id,
					data: { starred: !activeEmail.starred },
				});
				return;
			}

			if (key === "u" && activeEmail && mailboxId) {
				e.preventDefault();
				updateEmail.mutate({
					mailboxId,
					id: activeEmail.id,
					data: { read: !activeEmail.read },
				});
				return;
			}

			if (e.key === "#" && activeEmail) {
				e.preventDefault();
				handleDeleteSingle(activeEmail.id);
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		emails,
		mailboxId,
		setFocusedEmailId,
		openEmail,
		toggleSelectId,
		handleArchiveSingle,
		handleDeleteSingle,
		updateEmail,
	]);

	// 批量操作
	const handleBulkRead = async () => {
		if (!mailboxId || selectedIds.length === 0) return;
		await Promise.all(
			selectedIds.map((id) =>
				updateEmail.mutateAsync({ mailboxId, id, data: { read: true } }),
			),
		);
		toastManager.add({ title: `已将 ${selectedIds.length} 封邮件标为已读` });
		clearSelection();
	};

	const handleBulkArchive = async () => {
		if (!mailboxId || selectedIds.length === 0) return;
		await Promise.all(
			selectedIds.map((id) =>
				moveEmail.mutateAsync({ mailboxId, id, folderId: Folders.ARCHIVE }),
			),
		);
		if (selectedEmailId && selectedIds.includes(selectedEmailId)) closePanel();
		toastManager.add({ title: `已归档 ${selectedIds.length} 封邮件` });
		clearSelection();
	};

	const handleBulkStar = async () => {
		if (!mailboxId || selectedIds.length === 0) return;
		await Promise.all(
			selectedIds.map((id) =>
				updateEmail.mutateAsync({ mailboxId, id, data: { starred: true } }),
			),
		);
		toastManager.add({ title: `已为 ${selectedIds.length} 封邮件添加星标` });
		clearSelection();
	};

	const handleBulkDelete = async () => {
		if (!mailboxId || selectedIds.length === 0) return;
		if (!window.confirm(`确定要永久删除选中的 ${selectedIds.length} 封邮件吗？`)) {
			return;
		}
		await Promise.all(
			selectedIds.map((id) => deleteEmail.mutateAsync({ mailboxId, id })),
		);
		if (selectedEmailId && selectedIds.includes(selectedEmailId)) closePanel();
		toastManager.add({ title: `已删除 ${selectedIds.length} 封邮件` });
		clearSelection();
	};

	const formatParticipants = (email: Email): string => {
		if (email.participants) {
			const names = email.participants
				.split(",")
				.map((p) => p.trim().split("@")[0])
				.filter((name, idx, arr) => arr.indexOf(name) === idx);
			if (names.length <= 3) return names.join("、");
			return `${names.slice(0, 2).join("、")} 等 ${names.length} 人`;
		}
		return email.sender.split("@")[0] || email.sender;
	};

	return (
		<MailboxSplitView
			selectedEmailId={selectedEmailId}
			isComposing={isComposing}
		>
			{/* 文件夹顶栏 + 分段筛选胶囊 */}
			<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-kumo-line shrink-0">
				<div className="flex items-center gap-2.5 min-w-0">
					<h1 className="text-[15.5px] font-semibold tracking-tight text-kumo-default truncate">
						{folderName}
					</h1>
					{totalCount > 0 && (
						<span className="tabular-nums text-[11.5px] font-medium text-kumo-subtle bg-kumo-recessed border border-kumo-line px-1.5 py-0.5 rounded-md">
							{totalCount}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1.5 shrink-0">
					{/* 快捷筛选分段胶囊 */}
					<div className="inline-flex items-center p-0.5 rounded-lg bg-kumo-recessed border border-kumo-line text-[11.5px]">
						{(
							[
								{ id: "all", label: "全部" },
								{
									id: "unread",
									label: unreadInPage > 0 ? `未读 ${unreadInPage}` : "未读",
								},
								{ id: "starred", label: "星标" },
							] as const
						).map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setQuickFilter(tab.id)}
								className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer border-0 ${
									quickFilter === tab.id
										? "bg-kumo-base text-kumo-default shadow-xs"
										: "bg-transparent text-kumo-subtle hover:text-kumo-default"
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>

					<Tooltip content={isRefreshing ? "正在同步..." : "刷新"} side="bottom" asChild>
						<button
							type="button"
							onClick={handleRefresh}
							disabled={isRefreshing}
							aria-label="刷新"
							className="flex h-7 w-7 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
						>
							<ArrowsClockwiseIcon
								size={15}
								className={isRefreshing ? "animate-spin" : ""}
							/>
						</button>
					</Tooltip>
				</div>
			</div>

			{/* 邮件列表主体（按时间分组） */}
			<div ref={listContainerRef} className="flex-1 overflow-y-auto px-2 py-2">
				{isRefreshing && rawEmails.length === 0 ? (
					<EmailListSkeleton />
				) : emails.length > 0 ? (
					<div className="space-y-3 pb-16">
						{groupedEmails.map(({ bucket, items }) => (
							<div key={bucket}>
								<div className="sticky top-0 z-[5] flex items-center gap-2 px-2.5 py-1.5 bg-kumo-base/90 backdrop-blur-md">
									<span className="text-[11px] font-semibold tracking-wider text-kumo-subtle uppercase">
										{bucket}
									</span>
									<span className="h-px flex-1 bg-kumo-line/60" />
								</div>

								<div className="space-y-0.5 mt-0.5">
									{items.map((email) => {
										const isSelected = selectedEmailId === email.id;
										const isFocused = focusedEmailId === email.id && !isSelected;
										const isChecked = selectedIds.includes(email.id);
										const unread = hasUnread(email);
										const snippet = getSnippetText(email.snippet);
										const avatarTone = getAvatarTone(email.sender);
										const catchAllAlias = getCatchAllAlias(
											mailboxId,
											email.recipient,
											email.bcc,
										);

										return (
											<div
												key={email.id}
												data-email-id={email.id}
												role="button"
												tabIndex={0}
												onClick={() => openEmail(email)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														openEmail(email);
													}
												}}
												className={`group relative flex items-start gap-3 w-full text-left cursor-pointer rounded-xl px-3 py-2.5 transition-all duration-150 ${
													isSelected
														? "craft-row-selected ring-1 ring-[var(--craft-accent-ring)]"
														: isChecked
															? "bg-[var(--craft-accent-soft)]/60 ring-1 ring-[var(--craft-accent-ring)]/60"
															: isFocused
																? "bg-[var(--surface-hover)] ring-1 ring-kumo-line"
																: "craft-row-hover"
												}`}
											>
												{/* 左侧未读 / 选中发光细条 */}
												{(isSelected || unread) && (
													<span
														className={`absolute left-1 top-3 bottom-3 w-[2.5px] rounded-full transition-opacity ${
															isSelected
																? "bg-[var(--craft-accent)] opacity-100"
																: "bg-[var(--craft-accent)] opacity-75"
														}`}
													/>
												)}

												{/* 确定性色标头像（悬停或勾选时切换为多选框） */}
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														toggleSelectId(email.id);
													}}
													aria-label={isChecked ? "取消选择" : "选择此邮件"}
													className={`relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 transition-all cursor-pointer border-0 ${
														isChecked
															? "bg-[var(--craft-accent)] text-white ring-[var(--craft-accent)]"
															: `${avatarTone.bg} ${avatarTone.text} ${avatarTone.ring}`
													}`}
												>
													{isChecked ? (
														<CheckIcon size={14} weight="bold" />
													) : (
														<>
															<span className="group-hover:opacity-0 transition-opacity">
																{getInitials(email.sender)}
															</span>
															<span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-kumo-elevated/90 ring-1 ring-kumo-line text-kumo-subtle">
																<CheckIcon size={13} />
															</span>
														</>
													)}
												</button>

												{/* 邮件内容摘要 */}
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-1.5">
														<span
															className={`truncate text-[13.5px] ${
																unread
																	? "font-semibold text-kumo-default"
																	: "font-medium text-kumo-strong"
															}`}
														>
															{formatParticipants(email)}
														</span>

														{(email.thread_count ?? 1) > 1 && (
															<span className="shrink-0 tabular-nums text-[10.5px] text-kumo-subtle bg-kumo-recessed border border-kumo-line rounded-md px-1.5 py-0.25 font-medium">
																{email.thread_count}
															</span>
														)}

														{catchAllAlias && (
															<Tooltip
																content={`Catch-all 兜底收信 · 原投递地址：${catchAllAlias}`}
																side="top"
																asChild
															>
																<span className="shrink-0 max-w-[120px] truncate font-mono text-[10px] px-1.5 py-0.5 rounded-md craft-accent-badge">
																	→ {catchAllAlias.split("@")[0]}
																</span>
															</Tooltip>
														)}

														{email.has_draft && (
															<span className="shrink-0 text-[10.5px] px-1.5 py-0.5 rounded-md bg-rose-500/12 text-rose-400 font-medium">
																草稿
															</span>
														)}

														{email.needs_reply && !email.has_draft && (
															<Tooltip content="待回复" asChild>
																<span className="shrink-0 text-amber-400">
																	<ArrowBendUpLeftIcon size={13} weight="bold" />
																</span>
															</Tooltip>
														)}

														{/* 右侧时间与星标（悬停时让位给快捷操作胶囊） */}
														<div className="ml-auto flex items-center gap-1.5 shrink-0 group-hover:opacity-0 transition-opacity">
															{email.starred && (
																<StarIcon
																	size={13}
																	weight="fill"
																	className="text-amber-400"
																/>
															)}
															<span
																className={`text-[11.5px] tabular-nums ${
																	unread
																		? "font-medium text-[var(--craft-accent)]"
																		: "text-kumo-subtle"
																}`}
															>
																{formatListDate(email.date)}
															</span>
														</div>
													</div>

													<div
														className={`truncate text-[13px] mt-0.5 ${
															unread
																? "font-medium text-kumo-default"
																: "text-kumo-strong/90"
														}`}
													>
														{email.subject || "（无主题）"}
													</div>

													{snippet && (
														<div className="truncate text-[12px] text-kumo-subtle mt-0.5 leading-relaxed">
															{snippet}
														</div>
													)}
												</div>

												{/* 悬停悬浮操作胶囊 */}
												<div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto absolute right-2.5 top-2 flex items-center gap-0.5 p-0.5 rounded-lg craft-glass transition-opacity">
													{folder !== Folders.ARCHIVE && (
														<Tooltip content="归档 (E)" side="top" asChild>
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	handleArchiveSingle(email);
																}}
																className="flex h-6 w-6 items-center justify-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] cursor-pointer bg-transparent border-0"
																aria-label="归档"
															>
																<ArchiveIcon size={13} />
															</button>
														</Tooltip>
													)}
													<Tooltip
														content={email.starred ? "取消星标 (S)" : "星标 (S)"}
														side="top"
														asChild
													>
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																if (mailboxId) {
																	updateEmail.mutate({
																		mailboxId,
																		id: email.id,
																		data: { starred: !email.starred },
																	});
																}
															}}
															className="flex h-6 w-6 items-center justify-center rounded-md text-kumo-subtle hover:text-amber-400 hover:bg-[var(--surface-hover)] cursor-pointer bg-transparent border-0"
															aria-label="星标"
														>
															<StarIcon
																size={13}
																weight={email.starred ? "fill" : "regular"}
																className={email.starred ? "text-amber-400" : ""}
															/>
														</button>
													</Tooltip>
													<Tooltip
														content={email.read ? "标为未读 (U)" : "标为已读 (U)"}
														side="top"
														asChild
													>
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																if (mailboxId) {
																	updateEmail.mutate({
																		mailboxId,
																		id: email.id,
																		data: { read: !email.read },
																	});
																}
															}}
															className="flex h-6 w-6 items-center justify-center rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] cursor-pointer bg-transparent border-0"
															aria-label={email.read ? "标为未读" : "标为已读"}
														>
															{email.read ? (
																<EnvelopeSimpleIcon size={13} />
															) : (
																<EnvelopeOpenIcon size={13} />
															)}
														</button>
													</Tooltip>
													<Tooltip content="删除 (#)" side="top" asChild>
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																handleDeleteSingle(email.id);
															}}
															className="flex h-6 w-6 items-center justify-center rounded-md text-kumo-subtle hover:text-kumo-danger hover:bg-[var(--surface-hover)] cursor-pointer bg-transparent border-0"
															aria-label="删除"
														>
															<TrashIcon size={13} />
														</button>
													</Tooltip>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
				) : (
					<FolderEmptyState
						folder={folder}
						filter={quickFilter}
						onResetFilter={() => setQuickFilter("all")}
						onCompose={() => startCompose()}
					/>
				)}
			</div>

			{/* 底部玻璃态多选批量操作 Dock */}
			{selectedIds.length > 0 && (
				<div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2.5 py-1.5 rounded-2xl craft-glass-strong animate-craft-dock">
					<span className="text-xs font-medium text-kumo-default px-2 tabular-nums">
						已选 {selectedIds.length} 项
					</span>
					<div className="h-4 w-px bg-kumo-line mx-0.5" />
					<Tooltip content="全部标为已读" side="top" asChild>
						<button
							type="button"
							onClick={handleBulkRead}
							className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-kumo-strong hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
						>
							<EnvelopeOpenIcon size={14} />
							<span className="hidden sm:inline">已读</span>
						</button>
					</Tooltip>
					{folder !== Folders.ARCHIVE && (
						<Tooltip content="批量归档" side="top" asChild>
							<button
								type="button"
								onClick={handleBulkArchive}
								className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-kumo-strong hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
							>
								<ArchiveIcon size={14} />
								<span className="hidden sm:inline">归档</span>
							</button>
						</Tooltip>
					)}
					<Tooltip content="批量星标" side="top" asChild>
						<button
							type="button"
							onClick={handleBulkStar}
							className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-kumo-strong hover:text-amber-400 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
						>
							<StarIcon size={14} />
							<span className="hidden sm:inline">星标</span>
						</button>
					</Tooltip>
					<Tooltip content="批量删除" side="top" asChild>
						<button
							type="button"
							onClick={handleBulkDelete}
							className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-kumo-danger hover:bg-rose-500/12 transition-colors cursor-pointer bg-transparent border-0"
						>
							<TrashIcon size={14} />
							<span className="hidden sm:inline">删除</span>
						</button>
					</Tooltip>
					<div className="h-4 w-px bg-kumo-line mx-0.5" />
					<button
						type="button"
						onClick={clearSelection}
						aria-label="取消选择"
						className="flex h-7 w-7 items-center justify-center rounded-xl text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
					>
						<XIcon size={14} />
					</button>
				</div>
			)}

			{/* 分页 */}
			{totalCount > PAGE_SIZE && (
				<div className="flex justify-center py-2.5 border-t border-kumo-line shrink-0">
					<Pagination
						page={page}
						setPage={setPage}
						perPage={PAGE_SIZE}
						totalCount={totalCount}
					/>
				</div>
			)}
		</MailboxSplitView>
	);
}
