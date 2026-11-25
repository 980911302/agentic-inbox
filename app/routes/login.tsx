// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Banner,
	Button,
	Input,
	Loader,
	useKumoToastManager,
} from "@cloudflare/kumo";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import AuthLayout from "~/components/AuthLayout";
import { useAuthStatus, useCurrentUser, useLogin } from "~/queries/auth";

export function meta() {
	return [{ title: "登录 · 智能体邮箱" }];
}

export default function LoginRoute() {
	const navigate = useNavigate();
	const toastManager = useKumoToastManager();
	const { data: authStatus, isLoading: statusLoading } = useAuthStatus();
	const { data: user, isLoading: userLoading } = useCurrentUser();
	const loginMutation = useLogin();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (statusLoading) return;
		if (authStatus && !authStatus.initialized) {
			navigate("/setup", { replace: true });
			return;
		}
		if (!userLoading && user) {
			navigate(`/mailbox/${encodeURIComponent(user.email)}/emails/inbox`, {
				replace: true,
			});
		}
	}, [authStatus, statusLoading, user, userLoading, navigate]);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!email.trim() || !password) {
			setError("请输入邮箱地址和密码");
			return;
		}
		try {
			const res = await loginMutation.mutateAsync({
				email: email.trim(),
				password,
			});
			toastManager.add({ title: `欢迎回来，${res.user.displayName}` });
			navigate(`/mailbox/${encodeURIComponent(res.user.email)}/emails/inbox`, {
				replace: true,
			});
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "登录失败，请检查邮箱和密码");
		}
	};

	if (statusLoading || userLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen craft-canvas">
				<Loader size="lg" />
			</div>
		);
	}

	const adminEmail = authStatus?.adminEmail || "admin@zll300.com";

	return (
		<AuthLayout
			icon={<EnvelopeSimpleIcon size={24} weight="duotone" />}
			title="登录邮箱"
			subtitle="输入邮箱地址和密码，进入专属收件箱与 MCP 密钥管理"
			footer={
				authStatus?.allowRegistration ? (
					<span className="text-sm text-kumo-subtle">
						还没有邮箱账户？{" "}
						<Link
							to="/register"
							className="text-kumo-link hover:text-kumo-link-hover font-medium"
						>
							立即注册
						</Link>
					</span>
				) : (
					<span className="text-xs text-kumo-subtle">
						当前未开放自助注册，如需开通邮箱请联系管理员
					</span>
				)
			}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				{error && <Banner variant="error" text={error} />}

				<Input
					label="邮箱地址"
					className="w-full"
					type="text"
					placeholder={`如 ${adminEmail}（管理员可填 admin）`}
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					autoComplete="username"
				/>

				<Input
					label="登录密码"
					className="w-full"
					type="password"
					placeholder="请输入密码"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					autoComplete="current-password"
				/>

				<div className="pt-1">
					<Button
						type="submit"
						variant="primary"
						className="w-full justify-center"
						loading={loginMutation.isPending}
					>
						登录
					</Button>
				</div>
			</form>
		</AuthLayout>
	);
}
