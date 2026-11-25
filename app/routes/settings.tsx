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
	Switch,
	Tooltip,
	useKumoToastManager,
} from "@cloudflare/kumo";
import {
	CheckIcon,
	CopyIcon,
	KeyIcon,
	LockSimpleIcon,
	MoonIcon,
	PlugsIcon,
	PlusIcon,
	SunIcon,
	TrashIcon,
	UserCircleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router";
import { formatQuotedDate } from "shared/dates";
import { useUIStore } from "~/hooks/useUIStore";
import {
	useApiKeys,
	useChangePassword,
	useCreateApiKey,
	useDeleteApiKey,
} from "~/queries/auth";
import { useMailbox, useUpdateMailbox } from "~/queries/mailboxes";
import type { CreatedApiKey } from "~/types";

function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// 剪贴板不可用时静默忽略
		}
	};

	return (
		<Tooltip content={copied ? "已复制到剪贴板" : label} asChild>
			<Button
				variant="secondary"
				size="sm"
				icon={
					copied ? (
						<CheckIcon size={14} weight="bold" className="text-kumo-success" />
					) : (
						<CopyIcon size={14} />
					)
				}
				onClick={handleCopy}
			>
				{copied ? "已复制" : label}
			</Button>
		</Tooltip>
	);
}

export default function SettingsRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const toastManager = useKumoToastManager();
	const { theme, setTheme } = useUIStore();
	const { data: mailbox } = useMailbox(mailboxId);
	const updateMailboxMutation = useUpdateMailbox();

	// 个人资料与邮件签名
	const [displayName, setDisplayName] = useState("");
	const [signatureEnabled, setSignatureEnabled] = useState(false);
	const [signatureText, setSignatureText] = useState("");
	const [isSavingProfile, setIsSavingProfile] = useState(false);

	// MCP 密钥管理
	const { data: apiKeys = [], isLoading: keysLoading } = useApiKeys();
	const createKeyMutation = useCreateApiKey();
	const deleteKeyMutation = useDeleteApiKey();
	const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [newlyCreatedKey, setNewlyCreatedKey] = useState<CreatedApiKey | null>(
		null,
	);

	// 修改密码
	const changePasswordMutation = useChangePassword();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmNewPassword, setConfirmNewPassword] = useState("");
	const [passwordError, setPasswordError] = useState<string | null>(null);

	useEffect(() => {
		if (mailbox) {
			setDisplayName(mailbox.settings?.fromName || mailbox.name || "");
			setSignatureEnabled(Boolean(mailbox.settings?.signature?.enabled));
			setSignatureText(mailbox.settings?.signature?.text || "");
		}
	}, [mailbox]);

	const handleSaveProfile = async (e: FormEvent) => {
		e.preventDefault();
		if (!mailbox || !mailboxId) return;
		setIsSavingProfile(true);
		const settings = {
			...mailbox.settings,
			fromName: displayName.trim(),
			signature: {
				enabled: signatureEnabled,
				text: signatureText,
			},
		};
		try {
			await updateMailboxMutation.mutateAsync({ mailboxId, settings });
			toastManager.add({ title: "账户设置已保存" });
		} catch (err: unknown) {
			toastManager.add({
				title: err instanceof Error ? err.message : "保存失败",
				variant: "error",
			});
		} finally {
			setIsSavingProfile(false);
		}
	};

	const handleCreateKey = async (e: FormEvent) => {
		e.preventDefault();
		if (!newKeyName.trim()) return;
		try {
			const created = await createKeyMutation.mutateAsync(newKeyName.trim());
			setNewKeyName("");
			setIsCreateKeyOpen(false);
			setNewlyCreatedKey(created);
			toastManager.add({ title: "MCP 密钥已生成，请及时复制保存" });
		} catch (err: unknown) {
			toastManager.add({
				title: err instanceof Error ? err.message : "创建密钥失败",
				variant: "error",
			});
		}
	};

	const handleDeleteKey = async (keyId: string, keyName: string) => {
		if (
			!window.confirm(
				`确定要删除密钥「${keyName}」吗？删除后使用该密钥连接的 MCP 客户端将立即失效。`,
			)
		) {
			return;
		}
		try {
			await deleteKeyMutation.mutateAsync(keyId);
			toastManager.add({ title: "密钥已删除并吊销" });
		} catch (err: unknown) {
			toastManager.add({
				title: err instanceof Error ? err.message : "删除失败",
				variant: "error",
			});
		}
	};

	const handleChangePassword = async (e: FormEvent) => {
		e.preventDefault();
		setPasswordError(null);
		if (newPassword.length < 6) {
			setPasswordError("新密码至少需要 6 位");
			return;
		}
		if (newPassword !== confirmNewPassword) {
			setPasswordError("两次输入的新密码不一致");
			return;
		}
		try {
			await changePasswordMutation.mutateAsync({
				currentPassword,
				newPassword,
			});
			setCurrentPassword("");
			setNewPassword("");
			setConfirmNewPassword("");
			toastManager.add({ title: "登录密码已更新" });
		} catch (err: unknown) {
			setPasswordError(err instanceof Error ? err.message : "修改密码失败");
		}
	};

	if (!mailbox) {
		return (
			<div className="flex justify-center py-20">
				<Loader size="lg" />
			</div>
		);
	}

	const mcpUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/mcp`
			: "https://your-domain.com/mcp";

	const mcpConfigSnippet = newlyCreatedKey
		? JSON.stringify(
				{
					mcpServers: {
						"agentic-inbox": {
							type: "http",
							url: mcpUrl,
							headers: {
								Authorization: `Bearer ${newlyCreatedKey.key}`,
							},
						},
					},
				},
				null,
				2,
			)
		: "";

	return (
		<div className="h-full overflow-y-auto bg-kumo-recessed/25">
			<div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6 pb-16">
				{/* 页面标题 */}
				<div>
					<h1 className="text-xl font-semibold tracking-tight text-kumo-default">
						MCP 密钥与账户设置
					</h1>
					<p className="text-[13.5px] text-kumo-subtle mt-1">
						管理专属邮箱的 MCP 访问密钥、外观主题、发件人资料与登录安全
					</p>
				</div>

				{/* 外观主题选择（黑曜石深色 / 暖白浅色） */}
				<section className="rounded-2xl craft-card p-5 md:p-6 space-y-4">
					<div>
						<h2 className="text-[15px] font-semibold text-kumo-default">
							界面外观
						</h2>
						<p className="text-xs text-kumo-subtle mt-0.5">
							选择你偏好的工作台质感，设置会自动保存在本地浏览器
						</p>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<button
							type="button"
							onClick={() => setTheme("dark")}
							className={`group flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
								theme === "dark"
									? "border-[var(--craft-accent)] bg-[var(--craft-accent-soft)] ring-1 ring-[var(--craft-accent-ring)]"
									: "border-kumo-line bg-kumo-recessed/40 hover:bg-[var(--surface-hover)]"
							}`}
						>
							<div className="h-10 w-12 rounded-lg bg-[#0b0d13] border border-white/15 p-1.5 flex flex-col justify-between shrink-0">
								<div className="h-1.5 w-6 rounded-full bg-[#7382ff]" />
								<div className="space-y-1">
									<div className="h-1 w-8 rounded-full bg-white/25" />
									<div className="h-1 w-5 rounded-full bg-white/15" />
								</div>
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1.5 text-sm font-medium text-kumo-default">
									<MoonIcon size={14} weight="duotone" className="text-[var(--craft-accent)]" />
									<span>黑曜石深色</span>
								</div>
								<p className="text-[11.5px] text-kumo-subtle mt-0.5">
									低眩光深邃画布，专注高频阅读与开发
								</p>
							</div>
						</button>

						<button
							type="button"
							onClick={() => setTheme("light")}
							className={`group flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
								theme === "light"
									? "border-[var(--craft-accent)] bg-[var(--craft-accent-soft)] ring-1 ring-[var(--craft-accent-ring)]"
									: "border-kumo-line bg-kumo-recessed/40 hover:bg-[var(--surface-hover)]"
							}`}
						>
							<div className="h-10 w-12 rounded-lg bg-[#f3f2ee] border border-black/10 p-1.5 flex flex-col justify-between shrink-0">
								<div className="h-1.5 w-6 rounded-full bg-[#4f5ce6]" />
								<div className="space-y-1">
									<div className="h-1 w-8 rounded-full bg-black/25" />
									<div className="h-1 w-5 rounded-full bg-black/15" />
								</div>
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1.5 text-sm font-medium text-kumo-default">
									<SunIcon size={14} weight="duotone" className="text-amber-500" />
									<span>暖白浅色</span>
								</div>
								<p className="text-[11.5px] text-kumo-subtle mt-0.5">
									柔和暖石纸面，明亮通透的日间阅读体验
								</p>
							</div>
						</button>
					</div>
				</section>

				{/* MCP 密钥管理（核心卡片） */}
				<section className="rounded-2xl craft-card p-5 md:p-6 space-y-5">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1 flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<div className="flex h-7 w-7 items-center justify-center rounded-lg craft-accent-badge">
									<KeyIcon size={15} weight="duotone" />
								</div>
								<h2 className="text-[15px] font-semibold text-kumo-default">
									MCP 访问密钥
								</h2>
								<Badge variant="secondary">{apiKeys.length} 个</Badge>
							</div>
							<p className="text-xs text-kumo-subtle leading-relaxed">
								可为不同 MCP 客户端或 Agent 创建多个独立密钥。所有密钥仅限操作当前邮箱{" "}
								<span className="font-mono font-medium text-kumo-default">
									{mailbox.email}
								</span>
								，通过标准{" "}
								<code className="bg-kumo-recessed border border-kumo-line px-1.5 py-0.5 rounded text-[11px]">
									Authorization: Bearer &lt;密钥&gt;
								</code>{" "}
								接入。
							</p>
						</div>
						<Button
							variant="primary"
							size="sm"
							icon={<PlusIcon size={14} />}
							className="shrink-0"
							onClick={() => setIsCreateKeyOpen(true)}
						>
							新建密钥
						</Button>
					</div>

					{/* MCP 端点地址条 */}
					<div className="rounded-xl bg-kumo-recessed/65 border border-kumo-line px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-2.5 min-w-0 flex-1">
							<PlugsIcon size={16} className="text-[var(--craft-accent)] shrink-0" />
							<div className="min-w-0">
								<span className="text-[11px] text-kumo-subtle block">
									MCP 服务地址（Streamable HTTP）
								</span>
								<span className="font-mono text-xs text-kumo-default break-all">
									{mcpUrl}
								</span>
							</div>
						</div>
						<CopyButton text={mcpUrl} label="复制地址" />
					</div>

					{/* 密钥列表 */}
					{keysLoading ? (
						<div className="flex justify-center py-8">
							<Loader size="base" />
						</div>
					) : apiKeys.length === 0 ? (
						<div className="rounded-xl border border-dashed border-kumo-line bg-kumo-recessed/30 py-9 px-4 text-center space-y-1.5">
							<p className="text-sm font-medium text-kumo-default">
								尚未创建 MCP 密钥
							</p>
							<p className="text-xs text-kumo-subtle">
								点击右上角「新建密钥」生成后，即可接入 Claude Code、Cursor 或自研 Agent。
							</p>
						</div>
					) : (
						<div className="border border-kumo-line rounded-xl divide-y divide-kumo-line overflow-hidden">
							{apiKeys.map((item) => (
								<div
									key={item.id}
									className="flex items-center justify-between gap-3 px-4 py-3.5 bg-kumo-base/60 hover:bg-[var(--surface-hover)] transition-colors"
								>
									<div className="flex items-start gap-3 min-w-0">
										<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-kumo-recessed border border-kumo-line text-kumo-subtle">
											<KeyIcon size={15} />
										</div>
										<div className="min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<span className="text-sm font-medium text-kumo-default truncate">
													{item.name}
												</span>
												<code className="text-[11px] font-mono text-kumo-strong bg-kumo-recessed border border-kumo-line px-1.5 py-0.5 rounded">
													{item.keyPrefix}
												</code>
											</div>
											<div className="text-xs tabular-nums text-kumo-subtle mt-1">
												创建于 {formatQuotedDate(item.createdAt)}
												{" · "}
												{item.lastUsedAt
													? `最近使用 ${formatQuotedDate(item.lastUsedAt)}`
													: "尚未使用"}
											</div>
										</div>
									</div>
									<Tooltip content="删除并吊销此密钥" asChild>
										<button
											type="button"
											onClick={() => handleDeleteKey(item.id, item.name)}
											aria-label="删除密钥"
											className="flex h-8 w-8 items-center justify-center rounded-lg text-kumo-subtle hover:text-kumo-danger hover:bg-rose-500/10 transition-colors cursor-pointer bg-transparent border-0"
										>
											<TrashIcon size={16} />
										</button>
									</Tooltip>
								</div>
							))}
						</div>
					)}
				</section>

				{/* 账户信息与邮件签名 */}
				<form
					onSubmit={handleSaveProfile}
					className="rounded-2xl craft-card p-5 md:p-6 space-y-5"
				>
					<div className="flex items-center gap-2">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-kumo-recessed border border-kumo-line text-kumo-subtle">
							<UserCircleIcon size={16} weight="duotone" />
						</div>
						<h2 className="text-[15px] font-semibold text-kumo-default">
							账户资料与邮件签名
						</h2>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<Input
							label="发件人显示名称"
							className="w-full"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="发件时对方看到的名称"
						/>
						<Input
							label="绑定邮箱地址"
							className="w-full"
							type="email"
							value={mailbox.email}
							disabled
						/>
					</div>

					<div className="pt-2 border-t border-kumo-line space-y-3">
						<div className="flex items-center justify-between gap-4">
							<div>
								<span className="text-sm font-medium text-kumo-default block">
									邮件签名
								</span>
								<span className="text-xs text-kumo-subtle">
									开启后，撰写新邮件、回复或转发时将自动附带签名
								</span>
							</div>
							<Switch
								label={signatureEnabled ? "已开启" : "已关闭"}
								checked={signatureEnabled}
								onCheckedChange={setSignatureEnabled}
							/>
						</div>
						{signatureEnabled && (
							<textarea
								value={signatureText}
								onChange={(e) => setSignatureText(e.target.value)}
								placeholder="输入你的发件签名，例如：此致敬礼，张三"
								rows={3}
								className="w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed/60 px-3 py-2 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:bg-kumo-base focus:ring-2 focus:ring-kumo-brand/25 focus:border-kumo-brand transition-all"
							/>
						)}
					</div>

					<div className="flex justify-end">
						<Button
							type="submit"
							variant="primary"
							size="sm"
							loading={isSavingProfile}
						>
							保存资料
						</Button>
					</div>
				</form>

				{/* 修改密码 */}
				<form
					onSubmit={handleChangePassword}
					className="rounded-2xl craft-card p-5 md:p-6 space-y-4"
				>
					<div className="flex items-center gap-2">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-kumo-recessed border border-kumo-line text-kumo-subtle">
							<LockSimpleIcon size={16} weight="duotone" />
						</div>
						<h2 className="text-[15px] font-semibold text-kumo-default">
							修改登录密码
						</h2>
					</div>
					{passwordError && <Banner variant="error" text={passwordError} />}
					<div className="space-y-3.5">
						<Input
							label="当前密码"
							className="w-full"
							type="password"
							placeholder="请输入当前登录密码"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							required
							autoComplete="current-password"
						/>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Input
								label="新密码"
								className="w-full"
								type="password"
								placeholder="至少 6 位字符"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								required
								autoComplete="new-password"
							/>
							<Input
								label="确认新密码"
								className="w-full"
								type="password"
								placeholder="再次输入新密码"
								value={confirmNewPassword}
								onChange={(e) => setConfirmNewPassword(e.target.value)}
								required
								autoComplete="new-password"
							/>
						</div>
					</div>
					<div className="flex justify-end pt-1">
						<Button
							type="submit"
							variant="secondary"
							size="sm"
							loading={changePasswordMutation.isPending}
						>
							更新密码
						</Button>
					</div>
				</form>
			</div>

			{/* 新建密钥弹窗 */}
			<Dialog.Root open={isCreateKeyOpen} onOpenChange={setIsCreateKeyOpen}>
				<Dialog size="base" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-1.5">
						新建 MCP 密钥
					</Dialog.Title>
					<p className="text-xs text-kumo-subtle mb-4">
						建议按使用场景命名，便于后续按需单独吊销。
					</p>
					<form onSubmit={handleCreateKey} className="space-y-4">
						<Input
							label="密钥备注名称"
							className="w-full"
							placeholder="例如：Claude Code、Cursor、客服 Agent"
							value={newKeyName}
							onChange={(e) => setNewKeyName(e.target.value)}
							required
						/>
						<div className="flex justify-end gap-2 pt-1">
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
								loading={createKeyMutation.isPending}
								disabled={!newKeyName.trim()}
							>
								生成密钥
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* 一次性展示新生成的密钥与 MCP 配置 */}
			<Dialog.Root
				open={newlyCreatedKey !== null}
				onOpenChange={(open) => {
					if (!open) setNewlyCreatedKey(null);
				}}
			>
				<Dialog size="lg" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-3">
						MCP 密钥已生成
					</Dialog.Title>

					<div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-2.5 text-xs text-kumo-default mb-5">
						<WarningCircleIcon
							size={16}
							weight="fill"
							className="text-amber-500 shrink-0 mt-0.5"
						/>
						<span>
							出于安全考虑，完整密钥<strong>仅在此处展示一次</strong>，关闭窗口后将无法再次查看，请立即复制并妥善保存。
						</span>
					</div>

					{newlyCreatedKey && (
						<div className="space-y-4">
							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium text-kumo-strong">
										Bearer 密钥（{newlyCreatedKey.name}）
									</span>
									<CopyButton text={newlyCreatedKey.key} label="复制密钥" />
								</div>
								<div className="bg-kumo-recessed border border-kumo-line rounded-lg px-3.5 py-2.5 font-mono text-xs text-kumo-default break-all select-all">
									{newlyCreatedKey.key}
								</div>
							</div>

							<div className="space-y-1.5">
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium text-kumo-strong">
										标准 MCP 客户端配置（可直接粘贴使用）
									</span>
									<CopyButton text={mcpConfigSnippet} label="复制配置" />
								</div>
								<pre className="bg-kumo-recessed border border-kumo-line rounded-lg p-3.5 font-mono text-[11.5px] text-kumo-default overflow-x-auto leading-relaxed m-0">
									{mcpConfigSnippet}
								</pre>
							</div>
						</div>
					)}

					<div className="flex justify-end mt-5">
						<Button
							variant="primary"
							size="sm"
							onClick={() => setNewlyCreatedKey(null)}
						>
							我已保存，关闭
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
