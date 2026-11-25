// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Tooltip } from "@cloudflare/kumo";
import {
	CommandIcon,
	GearSixIcon,
	KeyboardIcon,
	ListIcon,
	MagnifyingGlassIcon,
	MoonIcon,
	PlugsIcon,
	ShieldCheckIcon,
	SunIcon,
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
import { useApiKeys, useCurrentUser } from "~/queries/auth";

export default function Header() {
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearchExpanded, setIsSearchExpanded] = useState(false);
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const { data: user } = useCurrentUser();
	const { data: apiKeys = [] } = useApiKeys();
	const {
		toggleSidebar,
		toggleMcpPanel,
		isMcpPanelOpen,
		toggleCommandPalette,
		toggleShortcuts,
		theme,
		toggleTheme,
	} = useUIStore();

	const encodedMailboxId = mailboxId ? encodeURIComponent(mailboxId) : "";

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
				(e.currentTarget as HTMLInputElement).blur();
			}
		}
	};

	const isSettingsActive = location.pathname.includes("/settings");
	const isAdminActive = location.pathname.includes("/admin");

	return (
		<header className="h-[54px] flex items-center gap-2 px-3 md:px-4 bg-kumo-base/90 backdrop-blur-md border-b border-kumo-line sticky top-0 z-10 shrink-0">
			{/* 移动端菜单按钮 */}
			<button
				type="button"
				onClick={toggleSidebar}
				aria-label="展开侧边栏"
				className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-kumo-strong hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
			>
				<ListIcon size={19} />
			</button>

			{/* 整合式 Spotlight 搜索框 + ⌘K 命令面板入口 */}
			<div
				className={`flex-1 max-w-xl items-center gap-2 ${
					isSearchExpanded ? "flex" : "hidden md:flex"
				}`}
			>
				<div className="relative flex-1 flex items-center group">
					<MagnifyingGlassIcon
						size={15}
						className="absolute left-3 text-kumo-subtle group-focus-within:text-[var(--craft-accent)] transition-colors pointer-events-none"
					/>
					<input
						id="craft-global-search"
						type="text"
						aria-label="搜索邮件"
						placeholder="搜索邮件...（支持 from:、is:unread、has:attachment）"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						className="w-full h-9 pl-9 pr-10 rounded-xl border border-kumo-line bg-kumo-recessed/70 text-[13.5px] text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:bg-kumo-base focus:border-[var(--craft-accent)] focus:ring-3 focus:ring-[var(--craft-accent-soft)] transition-all"
					/>
					{searchQuery ? (
						<button
							type="button"
							onClick={clearSearch}
							className="absolute right-2 p-1 rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
							aria-label="清除搜索"
						>
							<XIcon size={13} />
						</button>
					) : (
						<kbd className="craft-kbd absolute right-2.5 pointer-events-none">/</kbd>
					)}
				</div>

				<Tooltip content="打开全局命令面板 (⌘K)" side="bottom" asChild>
					<button
						type="button"
						onClick={toggleCommandPalette}
						className="hidden lg:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-kumo-line bg-kumo-recessed/60 hover:bg-[var(--surface-hover)] text-xs text-kumo-subtle hover:text-kumo-default transition-all cursor-pointer shrink-0"
					>
						<CommandIcon size={14} />
						<span>命令</span>
						<kbd className="craft-kbd">⌘K</kbd>
					</button>
				</Tooltip>
			</div>

			{/* 移动端快捷搜索与命令触发 */}
			{!isSearchExpanded && (
				<div className="flex items-center gap-1 md:hidden">
					<button
						type="button"
						onClick={() => setIsSearchExpanded(true)}
						aria-label="搜索"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-kumo-strong hover:text-kumo-default hover:bg-[var(--surface-hover)] cursor-pointer bg-transparent border-0"
					>
						<MagnifyingGlassIcon size={18} />
					</button>
					<button
						type="button"
						onClick={toggleCommandPalette}
						aria-label="命令面板"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-kumo-strong hover:text-kumo-default hover:bg-[var(--surface-hover)] cursor-pointer bg-transparent border-0"
					>
						<CommandIcon size={17} />
					</button>
				</div>
			)}

			{/* 右侧状态与功能区 */}
			<div className="flex items-center gap-1 ml-auto shrink-0">
				{/* MCP 接入状态胶囊 */}
				<Tooltip
					content={isMcpPanelOpen ? "收起 MCP 接入面板" : "展开 MCP 接入指南"}
					side="bottom"
					asChild
				>
					<button
						type="button"
						onClick={toggleMcpPanel}
						className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
							isMcpPanelOpen
								? "craft-accent-badge"
								: "border-kumo-line bg-kumo-recessed/50 text-kumo-strong hover:text-kumo-default hover:bg-[var(--surface-hover)]"
						}`}
					>
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
						<PlugsIcon size={14} weight={isMcpPanelOpen ? "fill" : "regular"} />
						<span className="hidden sm:inline">MCP</span>
						{apiKeys.length > 0 && (
							<span className="tabular-nums text-[10.5px] opacity-75">
								{apiKeys.length}
							</span>
						)}
					</button>
				</Tooltip>

				<Tooltip content="键盘快捷键 (?)" side="bottom" asChild>
					<button
						type="button"
						onClick={toggleShortcuts}
						aria-label="快捷键"
						className="hidden sm:flex h-8 w-8 items-center justify-center rounded-xl text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
					>
						<KeyboardIcon size={17} />
					</button>
				</Tooltip>

				<Tooltip content={theme === "dark" ? "切换暖白浅色" : "切换黑曜石深色"} side="bottom" asChild>
					<button
						type="button"
						onClick={toggleTheme}
						aria-label="切换主题"
						className="flex h-8 w-8 items-center justify-center rounded-xl text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] transition-colors cursor-pointer bg-transparent border-0"
					>
						{theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
					</button>
				</Tooltip>

				{user?.role === "admin" && (
					<Tooltip content="管理员控制台" side="bottom" asChild>
						<button
							type="button"
							onClick={() =>
								navigate(
									isAdminActive
										? `/mailbox/${encodedMailboxId}/emails/inbox`
										: `/mailbox/${encodedMailboxId}/admin`,
								)
							}
							aria-label="管理员控制台"
							className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors cursor-pointer border ${
								isAdminActive
									? "craft-accent-badge"
									: "border-transparent text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] bg-transparent"
							}`}
						>
							<ShieldCheckIcon
								size={17}
								weight={isAdminActive ? "fill" : "regular"}
							/>
						</button>
					</Tooltip>
				)}

				<Tooltip content="账户与密钥设置 (G M)" side="bottom" asChild>
					<button
						type="button"
						onClick={() =>
							navigate(
								isSettingsActive
									? `/mailbox/${encodedMailboxId}/emails/inbox`
									: `/mailbox/${encodedMailboxId}/settings`,
							)
						}
						aria-label="设置"
						className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors cursor-pointer border ${
							isSettingsActive
								? "craft-accent-badge"
								: "border-transparent text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)] bg-transparent"
						}`}
					>
						<GearSixIcon
							size={17}
							weight={isSettingsActive ? "fill" : "regular"}
						/>
					</button>
				</Tooltip>
			</div>
		</header>
	);
}
