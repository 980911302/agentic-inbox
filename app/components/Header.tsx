// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Tooltip } from "@cloudflare/kumo";
import {
	GearSixIcon,
	ListIcon,
	MagnifyingGlassIcon,
	PlugsIcon,
	ShieldCheckIcon,
	XIcon,
} from "@phosphor-icons/react";
import { type KeyboardEvent, useEffect, useState } from "react";
import {
	useLocation,
	useNavigate,
	useParams,
	useSearchParams,
} from "react-router";
import { useUIStore } from "~/hooks/useUIStore";
import { useCurrentUser } from "~/queries/auth";

export default function Header() {
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearchExpanded, setIsSearchExpanded] = useState(false);
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const { data: user } = useCurrentUser();
	const { toggleSidebar, toggleMcpPanel, isMcpPanelOpen } = useUIStore();

	const encodedMailboxId = mailboxId ? encodeURIComponent(mailboxId) : "";

	// 与 URL 查询参数保持同步
	const urlQuery = searchParams.get("q") || "";
	useEffect(() => {
		if (location.pathname.includes("/search") && urlQuery) {
			setSearchQuery(urlQuery);
		}
	}, [urlQuery, location.pathname]);

	const performSearch = () => {
		if (mailboxId && searchQuery.trim()) {
			const q = searchQuery.trim();
			navigate(`/mailbox/${encodedMailboxId}/search?q=${encodeURIComponent(q)}`);
			setIsSearchExpanded(false);
		}
	};

	const clearSearch = () => {
		setSearchQuery("");
		if (location.pathname.includes("/search") && mailboxId) {
			navigate(`/mailbox/${encodedMailboxId}/emails/inbox`);
		}
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			performSearch();
		}
		if (e.key === "Escape") {
			if (searchQuery) {
				clearSearch();
			} else {
				setIsSearchExpanded(false);
			}
		}
	};

	const isSettingsActive = location.pathname.includes("/settings");
	const isAdminActive = location.pathname.includes("/admin");

	return (
		<header className="h-14 flex items-center gap-2 px-3 bg-kumo-base border-b border-kumo-line sticky top-0 z-10 md:px-5 md:gap-4 shrink-0">
			{/* 移动端菜单按钮 */}
			<Button
				variant="ghost"
				shape="square"
				size="sm"
				icon={<ListIcon size={20} />}
				onClick={toggleSidebar}
				aria-label="展开侧边栏"
				className="md:hidden shrink-0"
			/>

			{/* 整合式搜索栏 */}
			<div
				className={`flex-1 max-w-xl transition-all items-center ${
					isSearchExpanded ? "flex" : "hidden md:flex"
				}`}
			>
				<div className="relative flex-1 flex items-center">
					<MagnifyingGlassIcon
						size={16}
						className="absolute left-3 text-kumo-subtle pointer-events-none"
					/>
					<input
						type="text"
						aria-label="搜索邮件"
						placeholder="搜索邮件...（支持 from:发件人、is:unread、has:attachment）"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						className="w-full h-9 pl-9 pr-8 rounded-lg border border-kumo-line bg-kumo-recessed/70 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:bg-kumo-base focus:ring-2 focus:ring-kumo-brand/25 focus:border-kumo-brand transition-all"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={clearSearch}
							className="absolute right-2 p-1 rounded text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors cursor-pointer bg-transparent border-0"
							aria-label="清除搜索"
						>
							<XIcon size={14} />
						</button>
					)}
				</div>
			</div>

			{/* 移动端搜索展开按钮 */}
			{!isSearchExpanded && (
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					icon={<MagnifyingGlassIcon size={20} />}
					onClick={() => setIsSearchExpanded(true)}
					aria-label="搜索"
					className="md:hidden shrink-0"
				/>
			)}

			{/* 右侧功能区 */}
			<div className="flex items-center gap-1.5 ml-auto shrink-0">
				<Tooltip
					content={isMcpPanelOpen ? "收起 MCP 接入指南" : "展开 MCP 接入指南"}
					side="bottom"
					asChild
				>
					<Button
						variant={isMcpPanelOpen ? "secondary" : "ghost"}
						size="sm"
						icon={<PlugsIcon size={16} weight={isMcpPanelOpen ? "fill" : "regular"} />}
						onClick={toggleMcpPanel}
						aria-label="切换 MCP 接入面板"
					>
						<span className="hidden sm:inline">MCP 接入</span>
					</Button>
				</Tooltip>
				{user?.role === "admin" && (
					<Tooltip content="管理员控制台" side="bottom" asChild>
						<Button
							variant={isAdminActive ? "secondary" : "ghost"}
							shape="square"
							size="sm"
							icon={<ShieldCheckIcon size={18} />}
							onClick={() =>
								navigate(
									isAdminActive
										? `/mailbox/${encodedMailboxId}/emails/inbox`
										: `/mailbox/${encodedMailboxId}/admin`,
								)
							}
							aria-label="管理员控制台"
						/>
					</Tooltip>
				)}
				<Tooltip content="账户与密钥设置" side="bottom" asChild>
					<Button
						variant={isSettingsActive ? "secondary" : "ghost"}
						shape="square"
						size="sm"
						icon={<GearSixIcon size={18} />}
						onClick={() =>
							navigate(
								isSettingsActive
									? `/mailbox/${encodedMailboxId}/emails/inbox`
									: `/mailbox/${encodedMailboxId}/settings`,
							)
						}
						aria-label="设置"
					/>
				</Tooltip>
			</div>
		</header>
	);
}
