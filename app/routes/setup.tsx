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
import { ShieldCheckIcon } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import AuthLayout from "~/components/AuthLayout";
import { useAuthStatus, useSetupAdmin } from "~/queries/auth";

export function meta() {
	return [{ title: "初始化管理员 · 智能体邮箱" }];
}

export default function SetupRoute() {
	const navigate = useNavigate();
	const toastManager = useKumoToastManager();
	const { data: authStatus, isLoading } = useAuthStatus();
	const setupMutation = useSetupAdmin();

	const [displayName, setDisplayName] = useState("管理员");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isLoading && authStatus?.initialized) {
			navigate("/login", { replace: true });
		}
	}, [authStatus, isLoading, navigate]);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		if (password.length < 6) {
			setError("管理员密码至少需要 6 位");
			return;
		}
		if (password !== confirmPassword) {
			setError("两次输入的密码不一致");
			return;
		}
		try {
			const res = await setupMutation.mutateAsync({
				password,
				displayName: displayName.trim() || "管理员",
			});
			toastManager.add({ title: "管理员账户初始化成功" });
			navigate(`/mailbox/${encodeURIComponent(res.user.email)}/emails/inbox`, {
				replace: true,
			});
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "初始化失败，请重试");
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen craft-canvas">
				<Loader size="lg" />
			</div>
		);
	}

	const adminEmail = authStatus?.adminEmail || "admin@zll300.com";

	return (
		<AuthLayout
			icon={<ShieldCheckIcon size={24} weight="duotone" />}
			title="初始化管理员账户"
			subtitle="首次使用请设置管理员密码，完成后可在控制台管理用户与注册策略"
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				{error && <Banner variant="error" text={error} />}

				<div className="rounded-xl bg-kumo-recessed/80 border border-kumo-line px-3.5 py-2.5 flex items-center justify-between">
					<span className="text-xs text-kumo-subtle">管理员邮箱</span>
					<span className="text-sm font-mono font-medium text-kumo-default">
						{adminEmail}
					</span>
				</div>

				<Input
					label="显示名称"
					className="w-full"
					placeholder="管理员"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
				/>

				<Input
					label="设置登录密码"
					className="w-full"
					type="password"
					placeholder="至少 6 位字符"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					autoComplete="new-password"
				/>

				<Input
					label="确认登录密码"
					className="w-full"
					type="password"
					placeholder="再次输入密码"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					required
					autoComplete="new-password"
				/>

				<div className="pt-1">
					<Button
						type="submit"
						variant="primary"
						className="w-full justify-center"
						loading={setupMutation.isPending}
					>
						完成初始化并进入邮箱
					</Button>
				</div>
			</form>
		</AuthLayout>
	);
}
