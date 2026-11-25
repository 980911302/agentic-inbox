// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Loader, Pagination, Tooltip } from "@cloudflare/kumo";
import { ArrowLeftIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { getFolderDisplayName } from "shared/folders";
import MailboxSplitView from "~/components/MailboxSplitView";
import { useUIStore } from "~/hooks/useUIStore";
import { getAvatarTone, getCatchAllAlias, getInitials } from "~/lib/ui-helpers";
import { formatListDate, getSnippetText } from "~/lib/utils";
import { useUpdateEmail } from "~/queries/emails";
import { SEARCH_PAGE_SIZE, useSearchEmails } from "~/queries/search";
import type { Email } from "~/types";

const QUICK_SEARCH_PRESETS = [
	{ label: "未读邮件", query: "is:unread" },
	{ label: "含附件", query: "has:attachment" },
	{ label: "星标邮件", query: "is:starred" },
];

function highlightTerms(text: string, query: string): React.ReactNode {
	if (!query || !text) return text;
	const freeText = query
		.replace(/\b(?:from|to|subject|in|is|has|before|after):"[^"]*"/gi, "")
		.replace(/\b(?:from|to|subject|in|is|has|before|after):\S+/gi, "")
		.trim();
	if (!freeText) return text;
	try {
		const escaped = freeText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const regex = new RegExp(`(${escaped})`, "gi");
		const parts = text.split(regex);
		if (parts.length === 1) return text;
		const lowerEscaped = escaped.toLowerCase();
		return parts.map((part, i) =>
			part.toLowerCase() === lowerEscaped ? (
				<mark
					key={i}
					className="bg-[var(--craft-accent-soft)] text-[var(--craft-accent)] rounded-xs px-0.5 font-medium"
				>
					{part}
				</mark>
			) : (
				part
			),
		);
	} catch {
		return text;
	}
}

export default function SearchResultsRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const { selectedEmailId, isComposing, selectEmail, closePanel } = useUIStore();
	const updateEmail = useUpdateEmail();
	const urlQuery = searchParams.get("q") || "";
	const [page, setPage] = useState(1);
	const searchKey = useMemo(
		() => `${mailboxId ?? ""}::${urlQuery}`,
		[mailboxId, urlQuery],
	);
	const prevSearchKeyRef = useRef(searchKey);
	const searchChanged = prevSearchKeyRef.current !== searchKey;
	const currentPage = searchChanged ? 1 : page;

	useEffect(() => {
		if (!searchChanged) return;
		prevSearchKeyRef.current = searchKey;
		setPage(1);
		closePanel();
	}, [closePanel, searchChanged, searchKey]);

	const { data: searchData, isLoading } = useSearchEmails(
		mailboxId,
		urlQuery,
		currentPage,
	);
	const results = searchData?.results ?? [];
	const totalCount = searchData?.totalCount ?? 0;

	const handleRowClick = (email: Email) => {
		selectEmail(email.id);
		if (!email.read && mailboxId) {
			updateEmail.mutate({ mailboxId, id: email.id, data: { read: true } });
		}
	};

	const encodedMailboxId = mailboxId ? encodeURIComponent(mailboxId) : "";

	return (
		<MailboxSplitView
			selectedEmailId={selectedEmailId}
			isComposing={isComposing}
		>
			<>
				<div className="flex items-center gap-2.5 px-4 py-3 border-b border-kumo-line shrink-0">
					<Tooltip content="返回收件箱" side="bottom" asChild>
						<button
							type="button"
							onClick={() =>
								navigate(`/mailbox/${encodedMailboxId}/emails/inbox`)
							}
							aria-label="返回收件箱"
							className="flex h-7 w-7 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
						>
							<ArrowLeftIcon size={16} />
						</button>
					</Tooltip>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h1 className="text-[15px] font-semibold text-kumo-default truncate">
								搜索结果
							</h1>
							{!isLoading && (
								<span className="tabular-nums text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-kumo-recessed border border-kumo-line text-kumo-subtle">
									{totalCount} 条
								</span>
							)}
						</div>
						{urlQuery && (
							<span className="text-xs font-mono text-kumo-subtle truncate block">
								{urlQuery}
							</span>
						)}
					</div>
				</div>

				<div className="flex-1 overflow-y-auto px-2 py-2">
					{isLoading ? (
						<div className="flex justify-center py-20">
							<Loader size="lg" />
						</div>
					) : results.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-24 px-6 text-center">
							<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl craft-accent-badge">
								<MagnifyingGlassIcon size={26} weight="duotone" />
							</div>
							<h3 className="text-base font-semibold text-kumo-default mb-1.5">
								未找到相关邮件
							</h3>
							<p className="text-xs text-kumo-subtle max-w-xs leading-relaxed">
								{urlQuery
									? `没有找到与 “${urlQuery}” 匹配的邮件，可以尝试更换关键词或使用下方快捷筛选。`
									: "请输入关键词按主题、发件人或正文检索邮件。"}
							</p>
							<div className="flex flex-wrap items-center justify-center gap-2 mt-5">
								{QUICK_SEARCH_PRESETS.map((preset) => (
									<button
										key={preset.query}
										type="button"
										onClick={() =>
											navigate(
												`/mailbox/${encodedMailboxId}/search?q=${encodeURIComponent(preset.query)}`,
											)
										}
										className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-kumo-line bg-kumo-recessed/60 hover:bg-[var(--surface-hover)] text-xs text-kumo-strong hover:text-kumo-default transition-colors cursor-pointer"
									>
										<span>{preset.label}</span>
										<code className="font-mono text-[10.5px] text-[var(--craft-accent)]">
											{preset.query}
										</code>
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="space-y-0.5">
							{results.map((email) => {
								const isSelected = selectedEmailId === email.id;
								const snippet = getSnippetText(email.snippet, 120);
								const folderName = (email as Email & { folder_name?: string })
									.folder_name;
								const tone = getAvatarTone(email.sender);
								const catchAllAlias = getCatchAllAlias(
									mailboxId,
									email.recipient,
									email.bcc,
								);

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
										className={`group relative flex items-start gap-3 w-full text-left cursor-pointer rounded-xl px-3 py-2.5 transition-all ${
											isSelected
												? "craft-row-selected ring-1 ring-[var(--craft-accent-ring)]"
												: "craft-row-hover"
										}`}
									>
										<div
											className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
										>
											{getInitials(email.sender)}
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-1.5">
												<span
													className={`truncate text-[13.5px] ${
														!email.read
															? "font-semibold text-kumo-default"
															: "font-medium text-kumo-strong"
													}`}
												>
													{highlightTerms(email.sender.split("@")[0], urlQuery)}
												</span>
												{folderName && (
													<span className="shrink-0 text-[10.5px] px-1.5 py-0.5 rounded-md bg-kumo-recessed border border-kumo-line text-kumo-subtle">
														{getFolderDisplayName(folderName)}
													</span>
												)}
												{catchAllAlias && (
													<span className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded-md craft-accent-badge">
														→ {catchAllAlias.split("@")[0]}
													</span>
												)}
												<span className="text-[11.5px] tabular-nums text-kumo-subtle shrink-0 ml-auto">
													{formatListDate(email.date)}
												</span>
											</div>
											<div
												className={`truncate text-[13px] mt-0.5 ${
													!email.read
														? "font-medium text-kumo-default"
														: "text-kumo-strong/90"
												}`}
											>
												{highlightTerms(email.subject || "（无主题）", urlQuery)}
											</div>
											{snippet && (
												<div className="truncate text-xs text-kumo-subtle mt-0.5">
													{highlightTerms(snippet, urlQuery)}
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{totalCount > SEARCH_PAGE_SIZE && (
					<div className="flex justify-center py-2.5 border-t border-kumo-line shrink-0">
						<Pagination
							page={currentPage}
							setPage={setPage}
							perPage={SEARCH_PAGE_SIZE}
							totalCount={totalCount}
						/>
					</div>
				)}
			</>
		</MailboxSplitView>
	);
}
