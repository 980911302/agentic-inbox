// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Banner,
	Button,
	Input,
	Loader,
	Select,
	useKumoToastManager,
} from "@cloudflare/kumo";
import { LockSimpleIcon, UserPlusIcon } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import AuthLayout from "~/components/AuthLayout";
import { useAuthStatus, useCurrentUser, useRegister } from "~/queries/auth";

export function meta() {
	return [{ title: "注册账号 · 智能体邮箱" }];
}

export default function RegisterRoute() {
	const navigate = useNavigate();
	const toastManager = useKumoToastManager();
	const { data: authStatus, isLoading: statusLoading } = useAuthStatus();
	const { data: user, isLoading: userLoading } = useCurrentUser();
	const registerMutation = useRegister();

	const domains = authStatus?.domains ?? [];
	const [prefix, setPrefix] = useState("");
	const [selectedDomain, setSelectedDomain] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (domains.length > 0 && !selectedDomain) {
			setSelectedDomain(domains[0]);
		}
	}, [domains, selectedDomain]);

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
		if (!prefix.trim() || !selectedDomain) {
			setError("请填写完整的邮箱地址");
			return;
		}
		if (password.length < 6) {
			setError("密码至少需要 6 位");
			return;
		}
		if (password !== confirmPassword) {
			setError("两次输入的密码不一致");
			return;
		}
		try {
			const res = await registerMutation.mutateAsync({
				prefix: prefix.trim(),
				domain: selectedDomain,
				displayName: displayName.trim() || undefined,
				password,
			});
			toastManager.add({ title: "注册成功，已自动登录" });
			navigate(`/mailbox/${encodeURIComponent(res.user.email)}/emails/inbox`, {
				replace: true,
			});
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "注册失败，请重试");
		}
	};

	if (statusLoading || userLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen craft-canvas">
				<Loader size="lg" />
			</div>
		);
	}

	if (!authStatus?.allowRegistration) {
		return (
			<AuthLayout
				icon={<LockSimpleIcon size={24} weight="duotone" />}
				title="暂未开放公开注册"
				subtitle="管理员当前已关闭自助注册功能，请联系管理员为你开通邮箱账户。"
			>
				<Button
					variant="primary"
					className="w-full justify-center"
					onClick={() => navigate("/login")}
				>
					返回登录页
				</Button>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			icon={<UserPlusIcon size={24} weight="duotone" />}
			title="注册专属邮箱"
			subtitle="创建 1 对 1 专属邮箱，独立管理你的收件箱与 MCP 密钥"
			footer={
				<span className="text-sm text-kumo-subtle">
					已有账户？{" "}
					<Link
						to="/login"
						className="text-kumo-link hover:text-kumo-link-hover font-medium"
					>
						直接登录
					</Link>
				</span>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				{error && <Banner variant="error" text={error} />}

				<div>
					<span className="text-sm font-medium text-kumo-default mb-1.5 block">
						邮箱地址
					</span>
					<div className="flex items-stretch gap-1.5">
						<div className="flex-1 min-w-0">
							<Input
								aria-label="邮箱前缀"
								className="w-full"
								placeholder="例如 alice"
								value={prefix}
								onChange={(e) => setPrefix(e.target.value)}
								required
							/>
						</div>
						{domains.length > 1 ? (
							<>
								<span className="text-sm text-kumo-subtle self-center">@</span>
								<div className="flex-1 min-w-0">
									<Select
										aria-label="选择域名"
										value={selectedDomain}
										onValueChange={(value) => {
											if (value) setSelectedDomain(value);
										}}
									>
										{domains.map((d) => (
											<Select.Option key={d} value={d}>
												{d}
											</Select.Option>
										))}
									</Select>
								</div>
							</>
						) : (
							<div className="shrink-0 px-3 rounded-lg border border-kumo-line bg-kumo-recessed flex items-center text-sm font-mono text-kumo-strong select-none">
								@{selectedDomain || "未配置域名"}
							</div>
						)}
					</div>
				</div>

				<Input
					label="显示名称（选填）"
					className="w-full"
					placeholder="发件时对方看到的名称"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
				/>

				<Input
					label="登录密码"
					className="w-full"
					type="password"
					placeholder="至少 6 位字符"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					autoComplete="new-password"
				/>

				<Input
					label="确认密码"
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
						loading={registerMutation.isPending}
						disabled={!selectedDomain}
					>
						注册并登录
					</Button>
				</div>
			</form>
		</AuthLayout>
	);
}
