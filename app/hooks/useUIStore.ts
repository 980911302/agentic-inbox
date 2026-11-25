// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { create } from "zustand";
import type { Email } from "~/types";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";
export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "agentic-inbox-theme";

export interface ComposeOptions {
	mode: ComposeMode;
	originalEmail?: Email | null;
	/** 编辑草稿时传入对应草稿邮件对象 */
	draftEmail?: Email | null;
}

function applyThemeToDom(theme: ThemeMode) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.setAttribute("data-theme", "kumo");
	root.setAttribute("data-mode", theme);
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// 隐私模式下忽略存储异常
	}
}

function getInitialTheme(): ThemeMode {
	if (typeof document !== "undefined") {
		const attr = document.documentElement.getAttribute("data-mode");
		if (attr === "light" || attr === "dark") return attr;
	}
	if (typeof window !== "undefined") {
		try {
			const stored = localStorage.getItem(THEME_STORAGE_KEY);
			if (stored === "light" || stored === "dark") return stored;
		} catch {
			// 忽略读取异常
		}
	}
	return "dark";
}

interface UIState {
	// 双主题（黑曜石深色 / 暖白浅色）
	theme: ThemeMode;
	setTheme: (theme: ThemeMode) => void;
	toggleTheme: () => void;

	// 桌面侧边栏折叠与专注阅读模式
	isSidebarCollapsed: boolean;
	toggleSidebarCollapsed: () => void;
	isFocusMode: boolean;
	setFocusMode: (val: boolean) => void;
	toggleFocusMode: () => void;

	// 全局命令面板 (⌘K) 与快捷键速查 (?)
	isCommandPaletteOpen: boolean;
	setCommandPaletteOpen: (open: boolean) => void;
	toggleCommandPalette: () => void;
	isShortcutsOpen: boolean;
	setShortcutsOpen: (open: boolean) => void;
	toggleShortcuts: () => void;

	// 邮件列表键盘光标与批量多选
	focusedEmailId: string | null;
	setFocusedEmailId: (id: string | null) => void;
	selectedIds: string[];
	toggleSelectId: (id: string) => void;
	setSelectedIds: (ids: string[]) => void;
	clearSelection: () => void;

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
	theme: getInitialTheme(),
	setTheme: (theme) => {
		applyThemeToDom(theme);
		set({ theme });
	},
	toggleTheme: () => {
		const next: ThemeMode = get().theme === "dark" ? "light" : "dark";
		applyThemeToDom(next);
		set({ theme: next });
	},

	isSidebarCollapsed: false,
	toggleSidebarCollapsed: () =>
		set({ isSidebarCollapsed: !get().isSidebarCollapsed }),

	isFocusMode: false,
	setFocusMode: (val) => set({ isFocusMode: val }),
	toggleFocusMode: () => set({ isFocusMode: !get().isFocusMode }),

	isCommandPaletteOpen: false,
	setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
	toggleCommandPalette: () =>
		set({
			isCommandPaletteOpen: !get().isCommandPaletteOpen,
			isShortcutsOpen: false,
		}),

	isShortcutsOpen: false,
	setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),
	toggleShortcuts: () =>
		set({
			isShortcutsOpen: !get().isShortcutsOpen,
			isCommandPaletteOpen: false,
		}),

	focusedEmailId: null,
	setFocusedEmailId: (id) => set({ focusedEmailId: id }),

	selectedIds: [],
	toggleSelectId: (id) =>
		set((state) => ({
			selectedIds: state.selectedIds.includes(id)
				? state.selectedIds.filter((item) => item !== id)
				: [...state.selectedIds, id],
		})),
	setSelectedIds: (ids) => set({ selectedIds: ids }),
	clearSelection: () => set({ selectedIds: [] }),

	selectedEmailId: null,
	isComposing: false,
	_previousEmailId: null,
	composeOptions: { mode: "new", originalEmail: null },
	isComposeModalOpen: false,
	isSidebarOpen: false,
	isMcpPanelOpen: false,

	selectEmail: (id) =>
		set({
			selectedEmailId: id,
			focusedEmailId: id,
			isComposing: false,
		}),

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
			isFocusMode: false,
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
