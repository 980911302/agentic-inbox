// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * 2026 视觉与交互辅助工具：
 * - 发件人确定性色标头像
 * - 智能中文时间分组（今天 / 昨天 / 近 7 天 / 更早）
 * - Catch-all 原始收件地址提取
 * - 键盘快捷键输入焦点安全检测
 */

export interface AvatarTone {
	bg: string;
	text: string;
	ring: string;
}

const AVATAR_TONES: AvatarTone[] = [
	{ bg: "bg-indigo-500/14", text: "text-indigo-400", ring: "ring-indigo-500/25" },
	{ bg: "bg-violet-500/14", text: "text-violet-400", ring: "ring-violet-500/25" },
	{ bg: "bg-sky-500/14", text: "text-sky-400", ring: "ring-sky-500/25" },
	{ bg: "bg-emerald-500/14", text: "text-emerald-400", ring: "ring-emerald-500/25" },
	{ bg: "bg-amber-500/14", text: "text-amber-500", ring: "ring-amber-500/25" },
	{ bg: "bg-rose-500/14", text: "text-rose-400", ring: "ring-rose-500/25" },
	{ bg: "bg-cyan-500/14", text: "text-cyan-400", ring: "ring-cyan-500/25" },
	{ bg: "bg-fuchsia-500/14", text: "text-fuchsia-400", ring: "ring-fuchsia-500/25" },
];

export function getAvatarTone(seed: string): AvatarTone {
	const str = (seed || "mail").toLowerCase();
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 31 + str.charCodeAt(i)) | 0;
	}
	return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

export function getInitials(text: string): string {
	const cleaned = (text || "?").trim();
	if (!cleaned) return "?";
	const local = cleaned.includes("@") ? cleaned.split("@")[0] : cleaned;
	return (local.charAt(0) || "?").toUpperCase();
}

export type TimeBucket = "今天" | "昨天" | "近 7 天" | "更早";

export function getTimeBucket(dateStr: string): TimeBucket {
	const d = new Date(dateStr);
	if (Number.isNaN(d.getTime())) return "更早";
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const diffDays = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));
	if (diffDays <= 0) return "今天";
	if (diffDays === 1) return "昨天";
	if (diffDays <= 7) return "近 7 天";
	return "更早";
}

/**
 * 提取 Catch-all 兜底投递时的原始收件前缀/地址
 * 例如管理员邮箱为 admin@zll300.com，收到发往 zll-abc@zll300.com 的邮件时返回 "zll-abc@zll300.com"
 */
export function getCatchAllAlias(
	mailboxEmail: string | undefined,
	recipient?: string | null,
	bcc?: string | null,
): string | null {
	if (!mailboxEmail) return null;
	const own = mailboxEmail.trim().toLowerCase();
	const ownDomain = own.split("@")[1];
	if (!ownDomain) return null;

	const candidates = [
		...(recipient || "").split(","),
		...(bcc || "").split(","),
	]
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

	if (candidates.length === 0) return null;
	// 如果收件列表里已经包含当前邮箱本身，则属于直投邮件
	if (candidates.includes(own)) return null;

	// 优先找同域名下的原始投递地址
	const sameDomain = candidates.find((addr) => addr.endsWith(`@${ownDomain}`));
	return sameDomain || candidates[0] || null;
}

/**
 * 判断当前键盘事件是否处于可编辑元素内，避免单键快捷键干扰用户输入
 */
export function isEditableEventTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	if (target.isContentEditable) return true;
	return Boolean(target.closest('[contenteditable="true"], .ProseMirror, [role="textbox"]'));
}
