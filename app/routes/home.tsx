// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Loader } from "@cloudflare/kumo";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthStatus, useCurrentUser } from "~/queries/auth";

export function meta() {
	return [{ title: "智能体邮箱 · Agentic Inbox" }];
}

/**
 * 根入口路由：根据系统初始化状态与登录态自动跳转
 * - 未初始化管理员 -> /setup
 * - 未登录 -> /login
 * - 已登录 -> 直接进入当前账户唯一对应的收件箱
 */
export default function HomeRoute() {
	const navigate = useNavigate();
	const { data: authStatus, isLoading: statusLoading } = useAuthStatus();
	const { data: user, isLoading: userLoading } = useCurrentUser();

	useEffect(() => {
		if (statusLoading) return;
		if (authStatus && !authStatus.initialized) {
			navigate("/setup", { replace: true });
			return;
		}
		if (userLoading) return;
		if (user) {
			navigate(`/mailbox/${encodeURIComponent(user.email)}/emails/inbox`, {
				replace: true,
			});
		} else {
			navigate("/login", { replace: true });
		}
	}, [authStatus, statusLoading, user, userLoading, navigate]);

	return (
		<div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-kumo-recessed">
			<Loader size="lg" />
			<span className="text-sm text-kumo-subtle">正在加载邮箱...</span>
		</div>
	);
}
