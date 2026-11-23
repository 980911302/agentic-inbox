// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Loader } from "@cloudflare/kumo";
import { useEffect, useRef } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import ComposeEmail from "~/components/ComposeEmail";
import Header from "~/components/Header";
import MCPPanel from "~/components/MCPPanel";
import Sidebar from "~/components/Sidebar";
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

	const prevMailboxIdRef = useRef<string | undefined>(undefined);
	const {
		selectedEmailId,
		isComposing,
		isSidebarOpen,
		closeSidebar,
		isMcpPanelOpen,
		closeMcpPanel,
		closePanel,
		closeComposeModal,
	} = useUIStore();

	// 当处于分栏写信或阅读邮件状态时，MCP 面板采用浮层抽屉展示，避免挤压正文/编辑器宽度
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
		}

		prevMailboxIdRef.current = decodedMailboxId;
	}, [decodedMailboxId, closeComposeModal, closePanel, closeSidebar]);

	if (userLoading || !user || !isOwner) {
		return (
			<div className="flex items-center justify-center h-screen bg-kumo-recessed">
				<Loader size="lg" />
			</div>
		);
	}

	return (
		<div className="flex h-screen overflow-hidden">
			{/* 移动端左侧栏遮罩 */}
			{isSidebarOpen && (
				<div
					className="fixed inset-0 z-30 bg-black/30 md:hidden"
					onClick={closeSidebar}
					onKeyDown={(e) => e.key === "Escape" && closeSidebar()}
					role="button"
					tabIndex={-1}
					aria-label="关闭侧边栏"
				/>
			)}

			{/* 左侧文件夹导航栏 */}
			<div
				className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 md:z-0 ${
					isSidebarOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<Sidebar />
			</div>

			{/* 中间主区域 */}
			<div className="flex-1 flex flex-col min-w-0 bg-kumo-base">
				<Header />
				<main className="flex-1 overflow-hidden">
					<Outlet />
				</main>
			</div>

			{/* 右侧 MCP 接入指南面板：常规状态在桌面端常驻分栏，写信/读信或中小屏时采用优雅抽屉避免挤压 */}
			{isMcpPanelOpen && (
				<>
					<div
						className={`fixed inset-0 z-30 bg-black/25 ${useOverlayMcp ? "" : "lg:hidden"}`}
						onClick={closeMcpPanel}
						onKeyDown={(e) => e.key === "Escape" && closeMcpPanel()}
						role="button"
						tabIndex={-1}
						aria-label="关闭 MCP 面板"
					/>
					<div
						className={`fixed inset-y-0 right-0 z-40 w-[380px] max-w-[90vw] shrink-0 border-l border-kumo-line flex flex-col bg-kumo-base overflow-hidden shadow-2xl ${
							useOverlayMcp ? "" : "lg:static lg:z-0 lg:shadow-none"
						}`}
					>
						<MCPPanel />
					</div>
				</>
			)}

			<ComposeEmail />
		</div>
	);
}
