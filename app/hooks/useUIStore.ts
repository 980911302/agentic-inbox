// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { create } from "zustand";
import type { Email } from "~/types";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

export interface ComposeOptions {
	mode: ComposeMode;
	originalEmail?: Email | null;
	/** 编辑草稿时传入对应草稿邮件对象 */
	draftEmail?: Email | null;
}

interface UIState {
	// 邮件详情与写信侧栏状态
	selectedEmailId: string | null;
	isComposing: boolean;
	_previousEmailId: string | null;
	selectEmail: (id: string | null) => void;
	startCompose: (options?: ComposeOptions) => void;
	closePanel: () => void;
	closeCompose: () => void;

	// 写信配置
	composeOptions: ComposeOptions;

	// 移动端左侧边栏
	isSidebarOpen: boolean;
	openSidebar: () => void;
	closeSidebar: () => void;
	toggleSidebar: () => void;

	// 右侧 MCP 接入面板
	isMcpPanelOpen: boolean;
	toggleMcpPanel: () => void;
	openMcpPanel: () => void;
	closeMcpPanel: () => void;

	// 写信弹窗（用于非分栏视图）
	isComposeModalOpen: boolean;
	openComposeModal: (options?: ComposeOptions) => void;
	closeComposeModal: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
	selectedEmailId: null,
	isComposing: false,
	_previousEmailId: null,
	composeOptions: { mode: "new", originalEmail: null },
	isComposeModalOpen: false,
	isSidebarOpen: false,
	isMcpPanelOpen: false,

	selectEmail: (id) => set({ selectedEmailId: id, isComposing: false }),

	startCompose: (options) =>
		set((state) => {
			const mode = options?.mode || "new";
			const isReplyOrForward =
				mode === "reply" || mode === "reply-all" || mode === "forward";
			return {
				isComposing: true,
				_previousEmailId: state.selectedEmailId,
				selectedEmailId: isReplyOrForward ? state.selectedEmailId : null,
				composeOptions: options || { mode: "new", originalEmail: null },
				isSidebarOpen: false,
				isMcpPanelOpen: false,
			};
		}),

	closePanel: () =>
		set({
			selectedEmailId: null,
			isComposing: false,
			_previousEmailId: null,
			composeOptions: { mode: "new" as const, originalEmail: null },
		}),

	closeCompose: () =>
		set((state) => ({
			isComposing: false,
			selectedEmailId: state._previousEmailId,
			_previousEmailId: null,
			composeOptions: { mode: "new" as const, originalEmail: null },
		})),

	openSidebar: () => set({ isSidebarOpen: true }),
	closeSidebar: () => set({ isSidebarOpen: false }),
	toggleSidebar: () => set({ isSidebarOpen: !get().isSidebarOpen }),

	toggleMcpPanel: () => set({ isMcpPanelOpen: !get().isMcpPanelOpen }),
	openMcpPanel: () => set({ isMcpPanelOpen: true }),
	closeMcpPanel: () => set({ isMcpPanelOpen: false }),

	openComposeModal: (options) =>
		set({
			composeOptions: options || { mode: "new", originalEmail: null },
			isComposeModalOpen: true,
		}),

	closeComposeModal: () =>
		set({
			isComposeModalOpen: false,
			composeOptions: { mode: "new", originalEmail: null },
		}),
}));
