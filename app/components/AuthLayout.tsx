// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Tooltip } from "@cloudflare/kumo";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useUIStore } from "~/hooks/useUIStore";

interface AuthLayoutProps {
	icon: ReactNode;
	title: string;
	subtitle: string;
	children: ReactNode;
	footer?: ReactNode;
}

/**
 * 统一的 2026 极简工艺认证外框（用于初始化、登录、注册页面）
 * 配备黑曜石/暖白双主题切换、极光微光画布与镜面高光悬浮卡片
 */
export default function AuthLayout({
	icon,
	title,
	subtitle,
	children,
	footer,
}: AuthLayoutProps) {
	const { theme, toggleTheme } = useUIStore();

	return (
		<div className="relative min-h-screen auth-canvas flex flex-col items-center justify-center px-4 py-12">
			{/* 右上角主题切换悬浮按钮 */}
			<div className="fixed top-4 right-4 z-20">
				<Tooltip
					content={theme === "dark" ? "切换暖白浅色" : "切换黑曜石深色"}
					side="left"
					asChild
				>
					<button
						type="button"
						onClick={toggleTheme}
						aria-label="切换主题"
						className="flex h-9 w-9 items-center justify-center rounded-xl craft-card text-kumo-subtle hover:text-kumo-default transition-all cursor-pointer"
					>
						{theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
					</button>
				</Tooltip>
			</div>

			<div className="w-full max-w-[430px] animate-craft-scale">
				{/* 顶部克制品牌徽标 */}
				<div className="flex items-center justify-center gap-2.5 mb-7 select-none">
					<span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#6e7bf2] to-[#4f46e5] text-white text-[11px] font-bold shadow-[0_2px_12px_-2px_rgba(99,114,241,0.65)]">
						A
					</span>
					<span className="text-xs font-semibold tracking-[0.18em] text-kumo-strong uppercase">
						Agentic Inbox
					</span>
				</div>

				{/* 主悬浮卡片 */}
				<div className="rounded-2xl craft-panel p-7 sm:p-8">
					<div className="flex flex-col items-center text-center mb-7">
						<div className="flex h-12 w-12 items-center justify-center rounded-2xl craft-accent-badge mb-4 shadow-[0_6px_20px_-8px_var(--craft-accent-ring)]">
							{icon}
						</div>
						<h1 className="text-xl font-semibold tracking-tight text-kumo-default">
							{title}
						</h1>
						<p className="text-[13.5px] text-kumo-subtle mt-1.5 leading-relaxed max-w-[320px]">
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

				{/* 底部技术属性胶囊 */}
				<div className="flex items-center justify-center gap-2 mt-6 flex-wrap text-[11px] text-kumo-subtle/85">
					<span className="px-2 py-0.5 rounded-full border border-kumo-line bg-kumo-base/40">
						1:1 独立邮箱
					</span>
					<span className="px-2 py-0.5 rounded-full border border-kumo-line bg-kumo-base/40 font-mono">
						Bearer MCP
					</span>
					<span className="px-2 py-0.5 rounded-full border border-kumo-line bg-kumo-base/40">
						Cloudflare Edge
					</span>
				</div>
			</div>
		</div>
	);
}
