// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * 标准文件夹 ID 常量与中文展示名称映射
 * 内部数据库与 API 均保持英文 ID，前端展示统一使用中文名称
 */

export const Folders = {
	INBOX: "inbox",
	SENT: "sent",
	DRAFT: "draft",
	ARCHIVE: "archive",
	TRASH: "trash",
	SPAM: "spam",
} as const;

export type FolderId = (typeof Folders)[keyof typeof Folders];

/** 侧边栏展示的系统文件夹顺序（不含垃圾邮件） */
export const SYSTEM_FOLDER_IDS: readonly FolderId[] = [
	Folders.INBOX,
	Folders.SENT,
	Folders.DRAFT,
	Folders.ARCHIVE,
	Folders.TRASH,
];

/** 系统文件夹中文展示名称 */
export const FOLDER_DISPLAY_NAMES: Record<string, string> = {
	[Folders.INBOX]: "收件箱",
	[Folders.SENT]: "已发送",
	[Folders.DRAFT]: "草稿箱",
	[Folders.ARCHIVE]: "归档",
	[Folders.TRASH]: "回收站",
	[Folders.SPAM]: "垃圾邮件",
};

/** MCP 工具参数描述 */
export const FOLDER_TOOL_DESCRIPTION =
	"Folder to list: inbox, sent, draft, archive, trash";

export const MOVE_FOLDER_TOOL_DESCRIPTION =
	"Target folder: inbox, sent, draft, archive, trash";

/** 将文件夹 ID 或英文名转换为友好的中文展示名 */
export function getFolderDisplayName(folderId: string): string {
	const lower = folderId.toLowerCase();
	if (FOLDER_DISPLAY_NAMES[lower]) return FOLDER_DISPLAY_NAMES[lower];
	if (lower === "drafts") return "草稿箱";
	return folderId;
}
