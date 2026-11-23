// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Badge,
	Banner,
	Button,
	Dialog,
	Input,
	Loader,
	Select,
	Switch,
	Tooltip,
	useKumoToastManager,
} from "@cloudflare/kumo";
import {
	KeyIcon,
	LockKeyIcon,
	PlusIcon,
	ProhibitIcon,
	ShieldCheckIcon,
	TrashIcon,
	UserCheckIcon,
	UsersIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { formatQuotedDate } from "shared/dates";
import {
	useAdminCreateUser,
	useAdminDeleteUser,
	useAdminSettings,
	useAdminUpdateUser,
	useAdminUsers,
	useAuthStatus,
	useCurrentUser,
	useUpdateAdminSettings,
} from "~/queries/auth";
import type { AdminUserItem } from "~/types";

export default function AdminRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const toastManager = useKumoToastManager();

	const { data: currentUser } = useCurrentUser();
	const { data: authStatus } = useAuthStatus();
	const isAdmin = currentUser?.role === "admin";

	const { data: adminSettings, isLoading: settingsLoading } =
		useAdminSettings(isAdmin);
	const updateSettingsMutation = useUpdateAdminSettings();

	const { data: usersData, isLoading: usersLoading } = useAdminUsers(isAdmin);
	const createUserMutation = useAdminCreateUser();
	const updateUserMutation = useAdminUpdateUser();
	const deleteUserMutation = useAdminDeleteUser();

	const domains = authStatus?.domains ?? [];

	// 新建 / 认领账户弹窗
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [adoptEmail, setAdoptEmail] = useState<string | null>(null);
	const [prefix, setPrefix] = useState("");
	const [selectedDomain, setSelectedDomain] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [createError, setCreateError] = useState<string | null>(null);

	// 重置密码弹窗
	const [resetTarget, setResetTarget] = useState<AdminUserItem | null>(null);
	const [resetPassword, setResetPassword] = useState("");
	const [resetError, setResetError] = useState<string | null>(null);

	useEffect(() => {
		if (domains.length > 0 && !selectedDomain) {
			setSelectedDomain(domains[0]);
		}
	}, [domains, selectedDomain]);

	useEffect(() => {
		if (currentUser && currentUser.role !== "admin" && mailboxId) {
			navigate(`/mailbox/${encodeURIComponent(mailboxId)}/emails/inbox`, {
				replace: true,
			});
		}
	}, [currentUser, mailboxId, navigate]);

	if (!isAdmin) {
		return (
			<div className="flex justify-center py-20">
				<Loader size="lg" />
			</div>
		);
	}

	const users = usersData?.users ?? [];
	const orphanMailboxes = usersData?.orphanMailboxes ?? [];
	const totalKeys = users.reduce((sum, u) => sum + u.keyCount, 0);
	const activeUsers = users.filter((u) => !u.disabled).length;

	const handleToggleRegistration = async (checked: boolean) => {
		try {
			await updateSettingsMutation.mutateAsync({ allowRegistration: checked });
			toastManager.add({
				title: checked ? "已开启公开注册" : "已关闭公开注册",
			});
		} catch (err: unknown) {
			toastManager.add({
				title: err instanceof Error ? err.message : "更新设置失败",
				variant: "error",
			});
		}
	};

	const openCreateDialog = (orphan?: string) => {
		setCreateError(null);
		setPassword("");
		if (orphan) {
			setAdoptEmail(orphan);
			setPrefix(orphan.split("@")[0] || "");
			setDisplayName(orphan.split("@")[0] || "");
		} else {
			setAdoptEmail(null);
			setPrefix("");
			setDisplayName("");
		}
		setIsCreateOpen(true);
	};

	const handleCreateUser = async (e: FormEvent) => {
		e.preventDefault();
		setCreateError(null);
		if (password.length < 6) {
			setCreateError("初始密码至少需要 6 位");
			return;
		}
		try {
			await createUserMutation.mutateAsync(
				adoptEmail
					? {
							email: adoptEmail,
							displayName: displayName.trim() || undefined,
							password,
						}
					: {
							prefix: prefix.trim(),
							domain: selectedDomain,
							displayName: displayName.trim() || undefined,
							password,
						},
			);
			toastManager.add({
				title: adoptEmail ? "历史邮箱已成功绑定账户" : "账户创建成功",
			});
			setIsCreateOpen(false);
		} catch (err: unknown) {
			setCreateError(err instanceof Error ? err.message : "创建账户失败");
		}
	};

	const handleToggleDisabled = async (target: AdminUserItem) => {
		const nextDisabled = !target.disabled;
		try {
			await updateUserMutation.mutateAsync({
				email: target.email,
				data: { disabled: nextDisabled },
			});
			toastManager.add({
				title: nextDisabled
					? `已禁用 ${target.email}`
					: `已启用 ${target.email}`,
			});
		} catch (err: unknown) {
			toastManager.add({
				title: err instanceof Error ? err.message : "操作失败",
				variant: "error",
			});
		}
	};

	const handleResetPassword = async (e: FormEvent) => {
		e.preventDefault();
		if (!resetTarget) return;
		setResetError(null);
		if (resetPassword.length < 6) {
			setResetError("新密码至少需要 6 位");
			return;
		}
		try {
			await updateUserMutation.mutateAsync({
				email: resetTarget.email,
				data: { password: resetPassword },
			});
			toastManager.add({ title: `已重置 ${resetTarget.email} 的登录密码` });
			setResetTarget(null);
			setResetPassword("");
		} catch (err: unknown) {
			setResetError(err instanceof Error ? err.message : "重置密码失败");
		}
	};

	const handleDeleteUser = async (target: AdminUserItem) => {
		if (
			!window.confirm(
				`确定要永久删除账户「${target.email}」吗？\n该操作会同时清除该邮箱中的所有邮件、附件以及所有 MCP 密钥，且不可恢复！`,
			)
		) {
			return;
		}
		try {
			await deleteUserMutation.mutateAsync(target.email);
			toastManager.add({ title: `已删除账户 ${target.email}` });
		} catch (err: unknown) {
			toastManager.add({
				title: err instanceof Error ? err.message : "删除账户失败",
				variant: "error",
			});
		}
	};

	return (
		<div className="h-full overflow-y-auto bg-kumo-recessed/35">
			<div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6 pb-14">
				{/* 标题区 */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<ShieldCheckIcon
								size={22}
								weight="duotone"
								className="text-blue-600"
							/>
							<h1 className="text-xl font-semibold tracking-tight text-kumo-default">
								管理员控制台
							</h1>
						</div>
						<p className="text-sm text-kumo-subtle mt-1">
							控制系统注册策略，集中管理域名下的独立邮箱账户
						</p>
					</div>
					<Button
						variant="primary"
						size="sm"
						icon={<PlusIcon size={14} />}
						onClick={() => openCreateDialog()}
					>
						新建邮箱账户
					</Button>
				</div>

				{/* 概览指标卡 */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<div className="rounded-xl border border-kumo-line bg-kumo-base p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
						<span className="text-xs text-kumo-subtle">邮箱账户总数</span>
						<div className="mt-1.5 flex items-baseline gap-2">
							<span className="text-2xl font-semibold tabular-nums text-kumo-default">
								{users.length}
							</span>
							<span className="text-xs text-kumo-subtle">
								正常 {activeUsers} 个
							</span>
						</div>
					</div>
					<div className="rounded-xl border border-kumo-line bg-kumo-base p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
						<span className="text-xs text-kumo-subtle">已签发 MCP 密钥</span>
						<div className="mt-1.5 flex items-baseline gap-2">
							<span className="text-2xl font-semibold tabular-nums text-kumo-default">
								{totalKeys}
							</span>
							<span className="text-xs text-kumo-subtle">个有效密钥</span>
						</div>
					</div>
					<div className="rounded-xl border border-kumo-line bg-kumo-base p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
						<span className="text-xs text-kumo-subtle">公开注册状态</span>
						<div className="mt-2 flex items-center gap-2">
							<span
								className={`h-2.5 w-2.5 rounded-full ${
									adminSettings?.allowRegistration
										? "bg-emerald-500"
										: "bg-slate-400"
								}`}
							/>
							<span className="text-base font-semibold text-kumo-default">
								{adminSettings?.allowRegistration ? "已开放注册" : "仅管理员开通"}
							</span>
						</div>
					</div>
				</div>

				{/* 开放注册设置 */}
				<section className="rounded-xl border border-kumo-line bg-kumo-base p-5 md:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="space-y-1 max-w-xl">
							<h2 className="text-base font-semibold text-kumo-default">
								开放自助注册
							</h2>
							<p className="text-xs text-kumo-subtle leading-relaxed">
								开启后，登录页将显示注册入口，访客可自行注册{" "}
								<span className="font-mono text-kumo-default">
									@{domains[0] || "zll300.com"}
								</span>{" "}
								独立邮箱；关闭后，仅管理员可手动创建账户。
							</p>
						</div>
						{settingsLoading ? (
							<Loader size="sm" />
						) : (
							<Switch
								label={adminSettings?.allowRegistration ? "已开启" : "已关闭"}
								checked={Boolean(adminSettings?.allowRegistration)}
								onCheckedChange={handleToggleRegistration}
								disabled={updateSettingsMutation.isPending}
							/>
						)}
					</div>
				</section>

				{/* 旧版未认领邮箱提示（兼容线上已有部署） */}
				{orphanMailboxes.length > 0 && (
					<section className="rounded-xl border border-amber-500/35 bg-kumo-base p-5 md:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
						<div className="flex items-start gap-2.5 mb-3">
							<WarningCircleIcon
								size={18}
								weight="fill"
								className="text-amber-500 shrink-0 mt-0.5"
							/>
							<div>
								<h2 className="text-sm font-semibold text-kumo-default">
									发现 {orphanMailboxes.length} 个旧版历史邮箱尚未绑定登录账户
								</h2>
								<p className="text-xs text-kumo-subtle mt-0.5">
									这些邮箱来自此前部署的数据，为其设置初始密码后即可正常登录并使用 MCP 密钥，原有邮件完整保留。
								</p>
							</div>
						</div>
						<div className="divide-y divide-kumo-line border border-kumo-line rounded-xl overflow-hidden">
							{orphanMailboxes.map((email) => (
								<div
									key={email}
									className="flex items-center justify-between gap-3 px-4 py-2.5 bg-kumo-recessed/30"
								>
									<span className="text-sm font-mono text-kumo-default">
										{email}
									</span>
									<Button
										variant="secondary"
										size="sm"
										onClick={() => openCreateDialog(email)}
									>
										设置密码并启用
									</Button>
								</div>
							))}
						</div>
					</section>
				)}

				{/* 账户列表 */}
				<section className="rounded-xl border border-kumo-line bg-kumo-base p-5 md:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
					<div className="flex items-center justify-between gap-4 mb-4">
						<div className="flex items-center gap-2">
							<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-kumo-recessed border border-kumo-line text-kumo-subtle">
								<UsersIcon size={16} weight="duotone" />
							</div>
							<h2 className="text-base font-semibold text-kumo-default">
								账户列表
							</h2>
							<Badge variant="secondary">{users.length} 人</Badge>
						</div>
					</div>

					{usersLoading ? (
						<div className="flex justify-center py-8">
							<Loader size="base" />
						</div>
					) : (
						<div className="border border-kumo-line rounded-xl divide-y divide-kumo-line overflow-hidden">
							{users.map((u) => {
								const isSelf =
									u.email.toLowerCase() === currentUser.email.toLowerCase();
								const initial = (u.displayName || u.email)
									.trim()
									.charAt(0)
									.toUpperCase();
								return (
									<div
										key={u.email}
										className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 bg-kumo-base hover:bg-kumo-recessed/40 transition-colors"
									>
										<div className="flex items-center gap-3 min-w-0">
											<div
												className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
													u.disabled
														? "bg-kumo-recessed text-kumo-subtle"
														: u.role === "admin"
															? "bg-blue-50 text-blue-600 ring-1 ring-blue-600/15"
															: "bg-kumo-recessed border border-kumo-line text-kumo-default"
												}`}
											>
												{initial}
											</div>
											<div className="min-w-0">
												<div className="flex items-center gap-2 flex-wrap">
													<span className="text-sm font-medium text-kumo-default">
														{u.displayName}
													</span>
													<span className="text-xs font-mono text-kumo-subtle">
														{u.email}
													</span>
													{u.role === "admin" && (
														<Badge variant="primary">管理员</Badge>
													)}
													{u.disabled && (
														<Badge variant="outline">已禁用</Badge>
													)}
												</div>
												<div className="flex items-center gap-3 text-xs tabular-nums text-kumo-subtle mt-1">
													<span className="inline-flex items-center gap-1">
														<KeyIcon size={12} />
														{u.keyCount} 个密钥
													</span>
													<span>创建于 {formatQuotedDate(u.createdAt)}</span>
												</div>
											</div>
										</div>

										<div className="flex items-center gap-1 shrink-0">
											<Tooltip content="重置密码" asChild>
												<Button
													variant="ghost"
													shape="square"
													size="sm"
													icon={<LockKeyIcon size={16} />}
													onClick={() => {
														setResetTarget(u);
														setResetPassword("");
														setResetError(null);
													}}
													aria-label="重置密码"
												/>
											</Tooltip>
											{!isSelf && (
												<>
													<Tooltip
														content={u.disabled ? "启用账户" : "禁用账户"}
														asChild
													>
														<Button
															variant="ghost"
															shape="square"
															size="sm"
															icon={
																u.disabled ? (
																	<UserCheckIcon
																		size={16}
																		className="text-kumo-success"
																	/>
																) : (
																	<ProhibitIcon
																		size={16}
																		className="text-kumo-warning"
																	/>
																)
															}
															onClick={() => handleToggleDisabled(u)}
															aria-label={u.disabled ? "启用账户" : "禁用账户"}
														/>
													</Tooltip>
													<Tooltip content="删除账户及邮箱数据" asChild>
														<Button
															variant="ghost"
															shape="square"
															size="sm"
															icon={
																<TrashIcon
																	size={16}
																	className="text-kumo-destructive"
																/>
															}
															onClick={() => handleDeleteUser(u)}
															aria-label="删除账户"
														/>
													</Tooltip>
												</>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</section>
			</div>

			{/* 新建/认领账户弹窗 */}
			<Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-4">
						{adoptEmail ? "启用历史邮箱账户" : "新建邮箱账户"}
					</Dialog.Title>
					<form onSubmit={handleCreateUser} className="space-y-4">
						{createError && <Banner variant="error" text={createError} />}

						{adoptEmail ? (
							<Input
								label="邮箱地址"
								className="w-full"
								value={adoptEmail}
								disabled
							/>
						) : (
							<div>
								<span className="text-sm font-medium text-kumo-default mb-1.5 block">
									邮箱地址
								</span>
								<div className="flex items-stretch gap-1.5">
									<div className="flex-1 min-w-0">
										<Input
											aria-label="邮箱前缀"
											className="w-full"
											placeholder="例如 bot"
											size="sm"
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
													aria-label="域名"
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
										<div className="shrink-0 px-2.5 rounded-lg border border-kumo-line bg-kumo-recessed flex items-center text-xs font-mono text-kumo-strong select-none">
											@{selectedDomain || "未配置域名"}
										</div>
									)}
								</div>
							</div>
						)}

						<Input
							label="显示名称（选填）"
							className="w-full"
							placeholder="发件人名称"
							size="sm"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
						/>

						<Input
							label="初始登录密码"
							className="w-full"
							type="password"
							placeholder="至少 6 位字符"
							size="sm"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>

						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										取消
									</Button>
								)}
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={createUserMutation.isPending}
							>
								确认创建
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* 重置密码弹窗 */}
			<Dialog.Root
				open={resetTarget !== null}
				onOpenChange={(open) => {
					if (!open) setResetTarget(null);
				}}
			>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-4">
						重置登录密码
					</Dialog.Title>
					<form onSubmit={handleResetPassword} className="space-y-4">
						{resetError && <Banner variant="error" text={resetError} />}
						<Input
							label="目标账户"
							className="w-full"
							value={resetTarget?.email || ""}
							disabled
						/>
						<Input
							label="新密码"
							className="w-full"
							type="password"
							placeholder="至少 6 位字符"
							value={resetPassword}
							onChange={(e) => setResetPassword(e.target.value)}
							required
						/>
						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										取消
									</Button>
								)}
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={updateUserMutation.isPending}
							>
								确认重置
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
