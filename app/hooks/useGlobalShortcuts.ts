// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { Folders } from "shared/folders";
import { useUIStore } from "~/hooks/useUIStore";
import { isEditableEventTarget } from "~/lib/ui-helpers";

/**
 * 全局快捷键引擎：
 * - ⌘K / Ctrl+K：命令面板
 * - C：写信
 * - /：聚焦搜索框
 * - [：折叠/展开侧边栏
 * - F：切换专注阅读模式（读信时）
 * - ?：快捷键帮助
 * - Esc：逐层关闭浮层 / 面板 / 清除多选
 * - G + I/S/D/A/T/M：极速跳转文件夹或设置
 */
export function useGlobalShortcuts(mailboxId: string | undefined) {
	const navigate = useNavigate();
	const location = useLocation();
	const pendingGRef = useRef<number | null>(null);

	useEffect(() => {
		if (!mailboxId) return;
		const encoded = encodeURIComponent(mailboxId);

		const onKeyDown = (e: KeyboardEvent) => {
			const state = useUIStore.getState();

			// ⌘K / Ctrl+K 全局呼出命令面板（即使焦点在输入框中也生效）
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				state.toggleCommandPalette();
				return;
			}

			// Escape 逐层退出
			if (e.key === "Escape") {
				if (state.isCommandPaletteOpen) {
					e.preventDefault();
					state.setCommandPaletteOpen(false);
					return;
				}
				if (state.isShortcutsOpen) {
					e.preventDefault();
					state.setShortcutsOpen(false);
					return;
				}
				if (isEditableEventTarget(e.target)) return;
				if (state.isComposing) {
					e.preventDefault();
					state.closeCompose();
					return;
				}
				if (state.isFocusMode) {
					e.preventDefault();
					state.setFocusMode(false);
					return;
				}
				if (state.selectedEmailId) {
					e.preventDefault();
					state.closePanel();
					return;
				}
				if (state.selectedIds.length > 0) {
					e.preventDefault();
					state.clearSelection();
					return;
				}
				return;
			}

			// 当弹窗打开或焦点在输入框/富文本编辑器时，不响应单键快捷键
			if (
				state.isCommandPaletteOpen ||
				state.isShortcutsOpen ||
				state.isComposeModalOpen ||
				isEditableEventTarget(e.target) ||
				e.metaKey ||
				e.ctrlKey ||
				e.altKey
			) {
				return;
			}

			const key = e.key.toLowerCase();

			// 处理 G 组合跳转键（800ms 内有效）
			if (pendingGRef.current && Date.now() - pendingGRef.current < 800) {
				pendingGRef.current = null;
				const targetMap: Record<string, string> = {
					i: `/mailbox/${encoded}/emails/${Folders.INBOX}`,
					s: `/mailbox/${encoded}/emails/${Folders.SENT}`,
					d: `/mailbox/${encoded}/emails/${Folders.DRAFT}`,
					a: `/mailbox/${encoded}/emails/${Folders.ARCHIVE}`,
					t: `/mailbox/${encoded}/emails/${Folders.TRASH}`,
					m: `/mailbox/${encoded}/settings`,
				};
				if (targetMap[key]) {
					e.preventDefault();
					navigate(targetMap[key]);
					return;
				}
			}

			if (key === "g" && !e.shiftKey) {
				pendingGRef.current = Date.now();
				return;
			}

			if (e.key === "?") {
				e.preventDefault();
				state.toggleShortcuts();
				return;
			}

			if (key === "[" && !e.shiftKey) {
				e.preventDefault();
				state.toggleSidebarCollapsed();
				return;
			}

			if (e.key === "/" && !e.shiftKey) {
				const searchInput = document.getElementById(
					"craft-global-search",
				) as HTMLInputElement | null;
				if (searchInput) {
					e.preventDefault();
					searchInput.focus();
					searchInput.select();
				}
				return;
			}

			if (key === "c" && !e.shiftKey) {
				e.preventDefault();
				const isSplitPage =
					location.pathname.includes("/emails/") ||
					location.pathname.includes("/search");
				if (isSplitPage) state.startCompose();
				else state.openComposeModal();
				return;
			}

			if (key === "f" && !e.shiftKey && state.selectedEmailId && !state.isComposing) {
				e.preventDefault();
				state.toggleFocusMode();
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [mailboxId, location.pathname, navigate]);
}
