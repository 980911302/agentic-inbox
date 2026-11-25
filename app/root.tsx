// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Button,
	Empty,
	LinkProvider,
	Loader,
	Toasty,
	TooltipProvider,
} from "@cloudflare/kumo";
import { WarningIcon } from "@phosphor-icons/react";
import {
	MutationCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { forwardRef, useEffect, useState } from "react";
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Link as RouterLink,
	Scripts,
	ScrollRestoration,
} from "react-router";
import { THEME_STORAGE_KEY, useUIStore } from "~/hooks/useUIStore";
import { ApiError } from "~/services/api";
import "./index.css";

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 15_000,
				refetchOnWindowFocus: true,
				retry: (failureCount, error) => {
					// 4xx 错误不自动重试
					if (
						error instanceof ApiError &&
						error.status >= 400 &&
						error.status < 500
					) {
						return false;
					}
					return failureCount < 2;
				},
			},
		},
		mutationCache: new MutationCache({
			onError: (error) => {
				console.error("请求执行失败:", error);
			},
		}),
	});
}

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
	if (typeof window === "undefined") {
		return makeQueryClient();
	}
	if (!browserQueryClient) browserQueryClient = makeQueryClient();
	return browserQueryClient;
}

const KumoLink = forwardRef<
	HTMLAnchorElement,
	React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }
>(function KumoLink({ href, ...props }, ref) {
	if (href && !href.startsWith("http")) {
		return (
			<RouterLink
				to={href}
				ref={ref}
				{...(props as Record<string, unknown>)}
			/>
		);
	}
	return <a href={href} ref={ref} {...props} />;
});

/** 首屏无闪烁主题初始化脚本（默认黑曜石深色，支持本地记忆） */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var m=(t==='light'||t==='dark')?t:'dark';document.documentElement.setAttribute('data-theme','kumo');document.documentElement.setAttribute('data-mode',m);}catch(e){document.documentElement.setAttribute('data-theme','kumo');document.documentElement.setAttribute('data-mode','dark');}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN" data-theme="kumo" data-mode="dark" suppressHydrationWarning>
			<head>
				<meta charSet="UTF-8" />
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
				<link
					rel="icon"
					type="image/x-icon"
					href="/favicon.ico"
					sizes="48x48 32x32 16x16"
				/>
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>智能体邮箱 · Agentic Inbox</title>
				<Meta />
				<Links />
			</head>
			<body className="craft-canvas text-kumo-default antialiased selection:bg-[var(--craft-accent-soft)] selection:text-[var(--craft-accent)]">
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export function HydrateFallback() {
	return (
		<div className="flex flex-col items-center justify-center h-screen gap-3 craft-canvas">
			<Loader size="lg" />
			<span className="text-xs tracking-wider text-kumo-subtle uppercase">
				Agentic Inbox
			</span>
		</div>
	);
}

export default function App() {
	const [queryClient] = useState(getQueryClient);
	const setTheme = useUIStore((s) => s.setTheme);

	// 客户端水合后同步本地存储的主题到 Zustand 状态
	useEffect(() => {
		try {
			const stored = localStorage.getItem(THEME_STORAGE_KEY);
			if (stored === "light" || stored === "dark") {
				setTheme(stored);
			} else {
				setTheme("dark");
			}
		} catch {
			setTheme("dark");
		}
	}, [setTheme]);

	return (
		<QueryClientProvider client={queryClient}>
			<LinkProvider component={KumoLink}>
				<TooltipProvider>
					<Toasty>
						<Outlet />
					</Toasty>
				</TooltipProvider>
			</LinkProvider>
		</QueryClientProvider>
	);
}

export function ErrorBoundary({ error }: { error: unknown }) {
	let title = "页面出现异常";
	let description = "发生了意外错误，请刷新重试。";
	let status: number | null = null;

	if (isRouteErrorResponse(error)) {
		status = error.status;
		if (error.status === 404) {
			title = "页面未找到";
			description = "你访问的页面不存在或已被移动。";
		} else {
			title = `错误 ${error.status}`;
			description = error.statusText || description;
		}
	} else if (error instanceof Error && import.meta.env.DEV) {
		description = error.message;
	}

	return (
		<div className="flex items-center justify-center min-h-screen p-8 craft-canvas">
			<div className="craft-panel rounded-2xl p-8 max-w-md w-full">
				<Empty
					icon={<WarningIcon size={44} className="text-kumo-subtle" />}
					title={status === 404 ? "404 — 页面未找到" : title}
					description={description}
					contents={
						<Button
							variant="primary"
							onClick={() => {
								window.location.href = "/";
							}}
						>
							返回首页
						</Button>
					}
				/>
			</div>
		</div>
	);
}
