// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Loader } from "@cloudflare/kumo";
import { useEffect, useRef } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import CommandPalette from "~/components/CommandPalette";
import ComposeEmail from "~/components/ComposeEmail";
import Header from "~/components/Header";
import MCPPanel from "~/components/MCPPanel";
import ShortcutsDialog from "~/components/ShortcutsDialog";
import Sidebar from "~/components/Sidebar";
import { useGlobalShortcuts } from "~/hooks/useGlobalShortcuts";
import { useUIStore } from "~/hooks/useUIStore";
import { useCurrentUser } from "~/queries/auth";
import { useMailbox } from "~/queries/mailboxes";

function safeDecode(value: string | undefined): string | undefined {
	if (!value) return undefined;
	try {
		return decodeURIComponent(value).toLowerCase();
	} catch {
		return value.toLowerCase();
	}
}

export default function MailboxRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const { data: user, isLoading: userLoading } = useCurrentUser();

	const decodedMailboxId = safeDecode(mailboxId);
	const isOwner = Boolean(
		user && decodedMailboxId && user.email.toLowerCase() === decodedMailboxId,
	);

	// 仅在归属匹配时预加载当前邮箱信息
	useMailbox(isOwner ? decodedMailboxId : undefined);

	// 启用全局键盘快捷键引擎（⌘K、C、/、[、G+I/S/D/A/T/M 等）
	useGlobalShortcuts(isOwner ? decodedMailboxId : undefined);

	const prevMailboxIdRef = useRef<string | undefined>(undefined);
	const {
		selectedEmailId,
		isComposing,
		isSidebarOpen,
		isSidebarCollapsed,
		closeSidebar,
		isMcpPanelOpen,
		closeMcpPanel,
		closePanel,
		closeComposeModal,
		clearSelection,
	} = useUIStore();

	// 分栏读信或写信时，MCP 面板采用悬浮抽屉展示以保证正文空间
	const useOverlayMcp = isComposing || selectedEmailId !== null;

	// 鉴权与 1:1 邮箱归属守卫
	useEffect(() => {
		if (userLoading) return;
		if (!user) {
			navigate("/login", { replace: true });
			return;
		}
		if (decodedMailboxId !== user.email.toLowerCase()) {
			navigate(`/mailbox/${encodeURIComponent(user.email)}/emails/inbox`, {
				replace: true,
			});
		}
	}, [user, userLoading, decodedMailboxId, navigate]);

	useEffect(() => {
		if (
			prevMailboxIdRef.current &&
			decodedMailboxId &&
			prevMailboxIdRef.current !== decodedMailboxId
		) {
			closePanel();
			closeComposeModal();
			closeSidebar();
			clearSelection();
		}

		prevMailboxIdRef.current = decodedMailboxId;
	}, [
		decodedMailboxId,
		closeComposeModal,
		closePanel,
		closeSidebar,
		clearSelection,
	]);

	if (userLoading || !user || !isOwner) {
		return (
			<div className="flex flex-col items-center justify-center h-screen gap-3 craft-canvas">
				<Loader size="lg" />
				<span className="text-xs tracking-widest text-kumo-subtle uppercase">
					正在载入工作台
				</span>
			</div>
		);
	}

	return (
		<div className="flex h-screen w-screen overflow-hidden craft-canvas md:p-2 md:gap-2">
			{/* 移动端左侧栏遮罩 */}
			{isSidebarOpen && (
				<div
					className="fixed inset-0 z-30 bg-black/55 backdrop-blur-xs md:hidden animate-craft-fade"
					onClick={closeSidebar}
					onKeyDown={(e) => e.key === "Escape" && closeSidebar()}
					role="button"
					tabIndex={-1}
					aria-label="关闭侧边栏"
				/>
			)}

			{/* 左侧悬浮导轨导航栏 */}
			<div
				className={`fixed inset-y-0 left-0 z-40 transform transition-all duration-200 ease-out md:relative md:translate-x-0 md:z-0 shrink-0 ${
					isSidebarOpen ? "translate-x-0" : "-translate-x-full"
				} ${isSidebarCollapsed ? "w-64 md:w-[68px]" : "w-64 md:w-[244px]"}`}
			>
				<Sidebar />
			</div>

			{/* 主工作台浮岛 */}
			<div className="flex-1 flex flex-col min-w-0 bg-kumo-base md:rounded-2xl md:craft-panel overflow-hidden">
				<Header />
				<main className="flex-1 overflow-hidden">
					<Outlet />
				</main>
			</div>

			{/* 右侧 MCP 接入抽屉 / 浮岛 */}
			{isMcpPanelOpen && (
				<>
					<div
						className={`fixed inset-0 z-30 bg-black/45 backdrop-blur-xs animate-craft-fade ${
							useOverlayMcp ? "" : "xl:hidden"
						}`}
						onClick={closeMcpPanel}
						onKeyDown={(e) => e.key === "Escape" && closeMcpPanel()}
						role="button"
						tabIndex={-1}
						aria-label="关闭 MCP 面板"
					/>
					<div
						className={`fixed inset-y-2 right-2 z-40 w-[372px] max-w-[calc(100vw-16px)] shrink-0 rounded-2xl craft-glass-strong flex flex-col overflow-hidden animate-craft-panel ${
							useOverlayMcp
								? ""
								: "xl:static xl:inset-auto xl:z-0 xl:craft-panel"
						}`}
					>
						<MCPPanel />
					</div>
				</>
			)}

			{/* 全局浮层：写信弹窗、命令面板 ⌘K、快捷键指南 ? */}
			<ComposeEmail />
			<CommandPalette />
			<ShortcutsDialog />
		</div>
	);
}
