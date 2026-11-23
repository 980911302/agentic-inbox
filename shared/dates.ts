// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * 前后端共享日期格式化工具（统一简体中文展示）
 */

function safeParse(dateStr: string | undefined | null): Date | null {
	if (!dateStr) return null;
	try {
		const d = new Date(dateStr);
		return Number.isNaN(d.getTime()) ? null : d;
	} catch {
		return null;
	}
}

/** 邮件列表行日期展示 */
export function formatListDate(dateStr: string): string {
	const date = safeParse(dateStr);
	if (!date) return dateStr;

	const now = new Date();
	if (date.toDateString() === now.toDateString()) {
		return date.toLocaleTimeString("zh-CN", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
	}
	if (date.getFullYear() === now.getFullYear()) {
		return date.toLocaleDateString("zh-CN", {
			month: "numeric",
			day: "numeric",
		});
	}
	return date.toLocaleDateString("zh-CN", {
		year: "numeric",
		month: "numeric",
		day: "numeric",
	});
}

/** 邮件详情头部日期展示 */
export function formatDetailDate(dateStr: string): string {
	const date = safeParse(dateStr);
	if (!date) return dateStr;

	return date.toLocaleString("zh-CN", {
		month: "numeric",
		day: "numeric",
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

/** 会话内单封消息简短时间展示 */
export function formatShortDate(dateStr: string): string {
	const date = safeParse(dateStr);
	if (!date) return dateStr;

	return date.toLocaleTimeString("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

/** 引用回复与后台管理等完整时间展示 */
export function formatQuotedDate(dateStr: string | undefined): string {
	if (!dateStr) return "";
	const date = safeParse(dateStr);
	if (!date) return dateStr;

	return date.toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}
