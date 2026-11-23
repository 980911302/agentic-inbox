// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Pagination, Tooltip } from "@cloudflare/kumo";
import {
	ArchiveIcon,
	ArrowBendUpLeftIcon,
	ArrowsClockwiseIcon,
	EnvelopeOpenIcon,
	EnvelopeSimpleIcon,
	FileIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	StarIcon,
	TrashIcon,
	TrayIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { formatListDate } from "shared/dates";
import { Folders, getFolderDisplayName } from "shared/folders";
import MailboxSplitView from "~/components/MailboxSplitView";
import { useUIStore } from "~/hooks/useUIStore";
import { getSnippetText } from "~/lib/utils";
import {
	useDeleteEmail,
	useEmails,
	useMarkThreadRead,
	useUpdateEmail,
} from "~/queries/emails";
import { useFolders } from "~/queries/folders";
import { queryKeys } from "~/queries/keys";
import type { Email } from "~/types";

const PAGE_SIZE = 25;

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
		icon: <TrayIcon size={48} weight="thin" className="text-kumo-subtle" />,
		title: "收件箱为空",
		description: "收到新邮件后会显示在这里，你也可以主动发送一封邮件开始沟通。",
		showCompose: true,
	},
	[Folders.SENT]: {
		icon: (
			<PaperPlaneTiltIcon size={48} weight="thin" className="text-kumo-subtle" />
		),
		title: "暂无已发送邮件",
		description: "你发出的邮件将会保存在这里。",
		showCompose: true,
	},
	[Folders.DRAFT]: {
		icon: <FileIcon size={48} weight="thin" className="text-kumo-subtle" />,
		title: "暂无草稿",
		description: "尚未发送的邮件草稿会保存在这里。",
		showCompose: true,
	},
	[Folders.ARCHIVE]: {
		icon: <ArchiveIcon size={48} weight="thin" className="text-kumo-subtle" />,
		title: "归档夹为空",
		description: "将暂时不需处理但希望保留的邮件归档到这里，让收件箱保持整洁。",
	},
	[Folders.TRASH]: {
		icon: <TrashIcon size={48} weight="thin" className="text-kumo-subtle" />,
		title: "回收站为空",
		description: "移入回收站的邮件会显示在这里，可随时恢复或彻底删除。",
	},
};

function EmailListSkeleton() {
	return (
		<div className="animate-pulse space-y-1 p-2">
			{Array.from({ length: 8 }).map((_, i) => (
				<div key={i} className="flex items-center gap-3 px-3 py-3">
					<div className="w-4 h-4 rounded bg-kumo-fill" />
					<div className="w-5 h-5 rounded bg-kumo-fill" />
					<div className="flex-1 space-y-2">
						<div className="flex items-center gap-2">
							<div className="h-3 w-24 rounded bg-kumo-fill" />
							<div className="h-3 w-4 rounded bg-kumo-fill" />
							<div className="h-3 flex-1 rounded bg-kumo-fill" />
							<div className="h-3 w-12 rounded bg-kumo-fill" />
						</div>
						<div className="h-2.5 w-3/4 rounded bg-kumo-fill" />
					</div>
				</div>
			))}
		</div>
	);
}

function FolderEmptyState({
	folder,
	onCompose,
}: {
	folder?: string;
	onCompose: () => void;
}) {
	const config = (folder && FOLDER_EMPTY_STATES[folder]) || {
		icon: (
			<EnvelopeSimpleIcon size={48} weight="thin" className="text-kumo-subtle" />
		),
		title: "暂无邮件",
		description: "该文件夹当前没有任何邮件。",
	};

	return (
		<div className="flex flex-col items-center justify-center py-28 px-6 text-center">
			<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-kumo-recessed border border-kumo-line">
				{config.icon}
			</div>
			<h3 className="text-base font-semibold text-kumo-default mb-1.5">
				{config.title}
			</h3>
			<p className="text-sm text-kumo-subtle max-w-xs leading-relaxed mb-5">
				{config.description}
			</p>
			{"showCompose" in config && config.showCompose && (
				<Button
					variant="primary"
					size="sm"
					icon={<PencilSimpleIcon size={16} />}
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
	const {
		selectedEmailId,
		isComposing,
		selectEmail,
		closePanel,
		startCompose,
	} = useUIStore();
	const [page, setPage] = useState(1);

	const queryClient = useQueryClient();
	const updateEmail = useUpdateEmail();
	const markThreadRead = useMarkThreadRead();
	const deleteEmail = useDeleteEmail();

	const params = useMemo(
		() => ({
			folder: folder || "",
			page: String(page),
			limit: String(PAGE_SIZE),
		}),
		[folder, page],
	);

	const { data: emailData, isFetching: isRefreshing } = useEmails(
		mailboxId,
		params,
		{ refetchInterval: 30_000 },
	);

	const emails = emailData?.emails ?? [];
	const totalCount = emailData?.totalCount ?? 0;

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
			setPage(1);
		}
	}, [mailboxId, folder, closePanel]);

	const toggleStar = (e: React.MouseEvent, email: Email) => {
		e.preventDefault();
		e.stopPropagation();
		if (mailboxId)
			updateEmail.mutate({
				mailboxId,
				id: email.id,
				data: { starred: !email.starred },
			});
	};

	const handleDelete = (e: React.MouseEvent, emailId: string) => {
		e.preventDefault();
		e.stopPropagation();
		if (mailboxId) {
			const confirmed = window.confirm("确定要删除这封邮件吗？");
			if (!confirmed) return;
			deleteEmail.mutate({ mailboxId, id: emailId });
			if (selectedEmailId === emailId) closePanel();
		}
	};

	const handleRefresh = () => {
		if (mailboxId) {
			queryClient.invalidateQueries({ queryKey: ["emails", mailboxId] });
			queryClient.invalidateQueries({
				queryKey: queryKeys.folders.list(mailboxId),
			});
		}
	};

	const hasUnread = (email: Email): boolean => {
		if (email.thread_unread_count !== undefined) {
			return email.thread_unread_count > 0;
		}
		return !email.read;
	};

	const handleRowClick = (email: Email) => {
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
		return email.sender.split("@")[0];
	};

	return (
		<MailboxSplitView
			selectedEmailId={selectedEmailId}
			isComposing={isComposing}
		>
			{/* 文件夹标题栏 */}
			<div className="flex items-center justify-between px-4 py-3.5 border-b border-kumo-line shrink-0 md:px-5">
				<h1 className="text-lg font-semibold text-kumo-default">
					{folderName}
				</h1>
				<div className="flex items-center gap-1">
					{totalCount > 0 && (
						<span className="text-sm text-kumo-subtle mr-2 hidden sm:inline">
							共 {totalCount} 组会话
						</span>
					)}
					<Tooltip
						content={isRefreshing ? "正在刷新..." : "刷新"}
						side="bottom"
						asChild
					>
						<Button
							variant="ghost"
							shape="square"
							size="sm"
							icon={
								<ArrowsClockwiseIcon
									size={18}
									className={isRefreshing ? "animate-spin" : ""}
								/>
							}
							onClick={handleRefresh}
							disabled={isRefreshing}
							aria-label="刷新"
						/>
					</Tooltip>
				</div>
			</div>

			{/* 邮件列表 */}
			<div className="flex-1 overflow-y-auto">
				{isRefreshing && emails.length === 0 ? (
					<EmailListSkeleton />
				) : emails.length > 0 ? (
					<div>
						{emails.map((email) => {
							const isSelected = selectedEmailId === email.id;
							const snippet = getSnippetText(email.snippet);
							return (
								<div
									key={email.id}
									role="button"
									tabIndex={0}
									onClick={() => handleRowClick(email)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											handleRowClick(email);
										}
									}}
									className={`group flex items-center gap-3 w-full text-left cursor-pointer transition-colors border-b border-kumo-line border-l-2 px-4 py-3 md:px-5 ${
										isPanelOpen ? "md:px-4 md:py-2.5" : ""
									} ${
										isSelected
											? "bg-kumo-tint/90 border-l-kumo-brand"
											: "border-l-transparent hover:bg-kumo-tint/60"
									}`}
								>
									{/* 未读圆点 */}
									<div className="w-2.5 shrink-0 flex justify-center">
										{hasUnread(email) && (
											<div className="h-2 w-2 rounded-full bg-kumo-brand" />
										)}
									</div>

									{/* 星标 */}
									<button
										type="button"
										className="shrink-0 p-0.5 bg-transparent border-0 cursor-pointer"
										onClick={(e) => {
											e.stopPropagation();
											toggleStar(e, email);
										}}
									>
										<StarIcon
											size={16}
											weight={email.starred ? "fill" : "regular"}
											className={
												email.starred
													? "text-kumo-warning"
													: "text-kumo-subtle hover:text-kumo-warning"
											}
										/>
									</button>

									{/* 邮件摘要 */}
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span
												className={`truncate text-sm ${hasUnread(email) ? "font-semibold text-kumo-default" : "text-kumo-strong"}`}
											>
												{formatParticipants(email)}
											</span>
											{(email.thread_count ?? 1) > 1 && (
												<span className="shrink-0 text-xs text-kumo-subtle bg-kumo-fill rounded-full px-1.5 py-0.5 font-medium">
													{email.thread_count}
												</span>
											)}
											{email.has_draft && (
												<span className="shrink-0 text-xs text-kumo-destructive font-medium">
													草稿
												</span>
											)}
											{email.needs_reply && !email.has_draft && (
												<Tooltip content="待回复" asChild>
													<span className="shrink-0 text-kumo-warning">
														<ArrowBendUpLeftIcon size={14} weight="bold" />
													</span>
												</Tooltip>
											)}
											<span className="text-xs tabular-nums text-kumo-subtle shrink-0 ml-auto">
												{formatListDate(email.date)}
											</span>
										</div>
										<div className="truncate text-sm mt-0.5">
											<span
												className={
													hasUnread(email)
														? "font-medium text-kumo-default"
														: "text-kumo-subtle"
												}
											>
												{email.subject || "（无主题）"}
											</span>
											{snippet && (
												<span className="text-kumo-subtle font-normal">
													{" "}
													&mdash; {snippet}
												</span>
											)}
										</div>
									</div>

									{/* 悬停快捷操作 */}
									<div className="hidden group-hover:flex items-center shrink-0">
										<Tooltip
											content={email.read ? "标为未读" : "标为已读"}
											asChild
										>
											<Button
												variant="ghost"
												shape="square"
												size="sm"
												icon={
													email.read ? (
														<EnvelopeSimpleIcon size={14} />
													) : (
														<EnvelopeOpenIcon size={14} />
													)
												}
												onClick={(e) => {
													e.stopPropagation();
													if (mailboxId)
														updateEmail.mutate({
															mailboxId,
															id: email.id,
															data: { read: !email.read },
														});
												}}
												aria-label={email.read ? "标为未读" : "标为已读"}
											/>
										</Tooltip>
										<Tooltip content="删除" asChild>
											<Button
												variant="ghost"
												shape="square"
												size="sm"
												icon={<TrashIcon size={14} />}
												onClick={(e) => handleDelete(e, email.id)}
												aria-label="删除"
											/>
										</Tooltip>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<FolderEmptyState
						folder={folder}
						onCompose={() => startCompose()}
					/>
				)}
			</div>

			{/* 分页 */}
			{totalCount > PAGE_SIZE && (
				<div className="flex justify-center py-3 border-t border-kumo-line shrink-0">
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
