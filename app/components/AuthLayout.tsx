// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { ReactNode } from "react";

interface AuthLayoutProps {
	icon: ReactNode;
	title: string;
	subtitle: string;
	children: ReactNode;
	footer?: ReactNode;
}

/**
 * 统一的认证页面外框（用于初始化、登录、注册页面）
 * 保持清爽留白、精致卡片层次与克制的中文排版
 */
export default function AuthLayout({
	icon,
	title,
	subtitle,
	children,
	footer,
}: AuthLayoutProps) {
	return (
		<div className="min-h-screen auth-canvas bg-kumo-recessed flex flex-col items-center justify-center px-4 py-10">
			<div className="w-full max-w-[420px]">
				{/* 顶部轻量品牌标识 */}
				<div className="flex items-center justify-center gap-2 mb-6 select-none">
					<span className="h-2 w-2 rounded-full bg-kumo-brand" />
					<span className="text-xs font-medium tracking-widest text-kumo-subtle uppercase">
						Agentic Inbox · 智能体邮箱
					</span>
				</div>

				{/* 主卡片 */}
				<div className="rounded-2xl border border-kumo-line bg-kumo-base p-7 sm:p-8 shadow-[0_12px_36px_-12px_rgba(15,23,42,0.08)]">
					<div className="flex flex-col items-center text-center mb-7">
						<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-600/15 mb-4">
							{icon}
						</div>
						<h1 className="text-xl font-semibold tracking-tight text-kumo-default">
							{title}
						</h1>
						<p className="text-sm text-kumo-subtle mt-1.5 leading-relaxed">
							{subtitle}
						</p>
					</div>

					{children}

					{footer && (
						<div className="mt-6 pt-5 border-t border-kumo-line text-center">
							{footer}
						</div>
					)}
				</div>

				{/* 底部极简说明 */}
				<p className="text-center text-xs text-kumo-subtle/80 mt-6 tracking-wide">
					1 账户 · 1 独立邮箱 · 标准 Bearer MCP 接入
				</p>
			</div>
		</div>
	);
}
