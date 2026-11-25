// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import DOMPurify from "dompurify";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUIStore } from "~/hooks/useUIStore";

interface EmailIframeProps {
	body: string;
	/** When true, iframe auto-sizes to content height instead of filling parent */
	autoSize?: boolean;
	/** Optional paper mode override: "auto" adapts smartly, "light" forces crisp white paper, "dark" forces obsidian canvas */
	paperMode?: "auto" | "light" | "dark";
}

/**
 * 检测 HTML 邮件是否带有复杂自定义配色/表格排版（如营销邮件、验证码卡片等）
 * 在深色主题下自动用精致浅色纸面卡片承托，避免黑字黑底不可读
 */
function hasExplicitLightStyling(html: string): boolean {
	return (
		/\bbgcolor\s*=/i.test(html) ||
		/background(?:-color)?\s*:\s*(?:#[0-9a-f]{3,6}|rgb|white|hsl)/i.test(html) ||
		/style\s*=\s*["'][^"']*\bcolor\s*:\s*(?:#(?:0|1|2|3|4)|rgb\(\s*[0-8]?\d|black)/i.test(
			html,
		) ||
		/<table[\s>]/i.test(html)
	);
}

/**
 * Renders email HTML inside a sandboxed iframe.
 * Security model preserved: DOMPurify + opaque-origin sandbox (no allow-same-origin) + strict CSP.
 */
export default function EmailIframe({
	body,
	autoSize,
	paperMode = "auto",
}: EmailIframeProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [height, setHeight] = useState(autoSize ? 100 : 0);
	const appTheme = useUIStore((s) => s.theme);

	const useDarkCanvas = useMemo(() => {
		if (paperMode === "dark") return true;
		if (paperMode === "light") return false;
		if (appTheme !== "dark") return false;
		return !hasExplicitLightStyling(body || "");
	}, [paperMode, appTheme, body]);

	const handleMessage = useCallback(
		(event: MessageEvent) => {
			if (!autoSize) return;
			if (event.source !== iframeRef.current?.contentWindow) return;
			if (
				event.data &&
				typeof event.data === "object" &&
				event.data.__emailIframeHeight &&
				typeof event.data.height === "number" &&
				event.data.height > 0
			) {
				setHeight(event.data.height);
			}
		},
		[autoSize],
	);

	useEffect(() => {
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [handleMessage]);

	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe || !body) return;

		const cleanBody = DOMPurify.sanitize(body, {
			USE_PROFILES: { html: true },
			FORBID_TAGS: ["style"],
			ADD_ATTR: ["target"],
			FORCE_BODY: true,
		});

		const padding = autoSize ? (useDarkCanvas ? "4px 2px" : "18px 20px") : "24px 28px";
		const bg = useDarkCanvas ? "#11131b" : "#fcfcfa";
		const fg = useDarkCanvas ? "#e6eaf2" : "#181b24";
		const link = useDarkCanvas ? "#8c9aff" : "#4653db";
		const quoteBorder = useDarkCanvas ? "rgba(140, 154, 255, 0.35)" : "#d5d8e2";
		const quoteColor = useDarkCanvas ? "#98a2b8" : "#5e6678";
		const preBg = useDarkCanvas ? "#0b0d14" : "#f2f1ec";
		const preBorder = useDarkCanvas ? "rgba(255,255,255,0.08)" : "rgba(20,22,29,0.08)";

		const heightScript = autoSize
			? `<script>
				function reportHeight() {
					var h = document.body.scrollHeight;
					if (h > 0) parent.postMessage({ __emailIframeHeight: true, height: h }, "*");
				}
				reportHeight();
				setTimeout(reportHeight, 50);
				setTimeout(reportHeight, 160);
				setTimeout(reportHeight, 420);
			<\/script>`
			: "";

		iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: cid: https:; script-src 'unsafe-inline';">
<style>
* { box-sizing: border-box; }
html {
	background: ${bg};
	color-scheme: ${useDarkCanvas ? "dark" : "light"};
}
body {
	font-family: "Inter", -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif;
	font-size: 14.5px;
	line-height: 1.72;
	color: ${fg};
	background: ${bg};
	padding: ${padding};
	margin: 0;
	word-wrap: break-word;
	overflow-wrap: break-word;
	-webkit-font-smoothing: antialiased;
	${autoSize ? "overflow: hidden;" : ""}
}
[style*="position: fixed"], [style*="position:fixed"], [style*="position: absolute"], [style*="position:absolute"] {
	position: relative !important;
}
a { color: ${link}; text-underline-offset: 2px; }
img { max-width: 100%; height: auto; border-radius: 6px; }
blockquote {
	border-left: 2.5px solid ${quoteBorder};
	padding-left: 1em;
	margin: 12px 0;
	color: ${quoteColor};
}
pre {
	background: ${preBg};
	border: 1px solid ${preBorder};
	padding: 12px 14px;
	border-radius: 10px;
	overflow-x: auto;
	font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
	font-size: 12.5px;
	line-height: 1.6;
}
code {
	font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
	font-size: 0.9em;
}
table { border-collapse: collapse; max-width: 100%; }
td, th { padding: 4px 8px; }
p { margin: 6px 0; }
h1, h2, h3 { margin: 12px 0 6px; letter-spacing: -0.01em; }
ul, ol { padding-left: 20px; margin: 6px 0; }
hr { border: 0; border-top: 1px solid ${preBorder}; margin: 16px 0; }
</style>
</head>
<body>${cleanBody}${heightScript}</body>
</html>`;
	}, [body, autoSize, useDarkCanvas]);

	// 在深色主题下展示原色浅纸邮件时，用精致圆角纸片卡片承托，避免生硬的纯白切块
	const wrapAsLightSheet = appTheme === "dark" && !useDarkCanvas;

	return (
		<div
			className={
				wrapAsLightSheet
					? autoSize
						? "rounded-xl overflow-hidden ring-1 ring-white/12 shadow-sm"
						: "h-full p-4 md:p-5 bg-kumo-recessed/40"
					: autoSize
						? ""
						: "h-full"
			}
		>
			<iframe
				ref={iframeRef}
				className={`block w-full border-0 ${
					wrapAsLightSheet && !autoSize
						? "h-full rounded-xl ring-1 ring-white/12 shadow-md"
						: ""
				}`}
				style={autoSize ? { height: `${height}px` } : { height: "100%" }}
				sandbox="allow-scripts allow-popups allow-top-navigation-by-user-activation"
				title="Email content"
			/>
		</div>
	);
}
