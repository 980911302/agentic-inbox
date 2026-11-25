// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Banner, Button, Dialog } from "@cloudflare/kumo";
import {
	FloppyDiskIcon,
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
} from "@phosphor-icons/react";
import { useRef } from "react";
import { useParams } from "react-router";
import { useComposeForm } from "~/hooks/useComposeForm";
import { useUIStore } from "~/hooks/useUIStore";
import RichTextEditor from "./RichTextEditor";

export default function ComposeEmail() {
	const { mailboxId, folder } = useParams<{
		mailboxId: string;
		folder: string;
	}>();
	const formRef = useRef<HTMLFormElement>(null);

	const { isComposeModalOpen, closeComposeModal } = useUIStore();

	const {
		to,
		setTo,
		cc,
		setCc,
		bcc,
		setBcc,
		showCcBcc,
		setShowCcBcc,
		subject,
		setSubject,
		body,
		setBody,
		error,
		isSavingDraft,
		isSending,
		formTitle,
		handleSaveDraft,
		handleSend,
	} = useComposeForm(mailboxId, folder);

	const handleFormKeyDown = (e: React.KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isSending && !isSavingDraft) {
			e.preventDefault();
			formRef.current?.requestSubmit();
		}
	};

	return (
		<Dialog.Root
			open={isComposeModalOpen}
			onOpenChange={(open) => !open && !isSending && closeComposeModal()}
		>
			<Dialog size="lg" className="p-6 max-h-[85vh] overflow-y-auto">
				<Dialog.Title className="flex items-center gap-2 text-base font-semibold mb-4">
					<span className="flex h-7 w-7 items-center justify-center rounded-lg craft-accent-badge">
						<PencilSimpleIcon size={14} weight="duotone" />
					</span>
					<span>{formTitle}</span>
				</Dialog.Title>

				<form
					ref={formRef}
					onSubmit={(e) => handleSend(e, closeComposeModal)}
					onKeyDown={handleFormKeyDown}
					className="space-y-4"
				>
					{error && <Banner variant="error" text={error} />}

					<div className="rounded-xl border border-kumo-line bg-kumo-recessed/40 divide-y divide-kumo-line overflow-hidden">
						<div className="flex items-center gap-3 px-3.5 h-10">
							<label className="text-xs font-medium text-kumo-subtle w-12 shrink-0">
								收件人
							</label>
							<input
								type="text"
								placeholder="收件人邮箱，多个地址用逗号分隔"
								value={to}
								onChange={(e) => setTo(e.target.value)}
								required
								className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13.5px] text-kumo-default placeholder:text-kumo-subtle/75 font-mono"
							/>
							{!showCcBcc && (
								<button
									type="button"
									onClick={() => setShowCcBcc(true)}
									className="shrink-0 text-xs text-[var(--craft-accent)] hover:underline font-medium cursor-pointer bg-transparent border-0"
								>
									抄送 / 密送
								</button>
							)}
						</div>

						{showCcBcc && (
							<div className="flex items-center gap-3 px-3.5 h-10">
								<label className="text-xs font-medium text-kumo-subtle w-12 shrink-0">
									抄送
								</label>
								<input
									type="text"
									value={cc}
									onChange={(e) => setCc(e.target.value)}
									placeholder="多个地址请用英文逗号分隔"
									className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13.5px] text-kumo-default placeholder:text-kumo-subtle/75 font-mono"
								/>
							</div>
						)}

						{showCcBcc && (
							<div className="flex items-center gap-3 px-3.5 h-10">
								<label className="text-xs font-medium text-kumo-subtle w-12 shrink-0">
									密送
								</label>
								<input
									type="text"
									value={bcc}
									onChange={(e) => setBcc(e.target.value)}
									placeholder="多个地址请用英文逗号分隔"
									className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13.5px] text-kumo-default placeholder:text-kumo-subtle/75 font-mono"
								/>
							</div>
						)}

						<div className="flex items-center gap-3 px-3.5 h-10">
							<label className="text-xs font-medium text-kumo-subtle w-12 shrink-0">
								主题
							</label>
							<input
								type="text"
								placeholder="请输入邮件主题"
								value={subject}
								onChange={(e) => setSubject(e.target.value)}
								required
								className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13.5px] font-medium text-kumo-default placeholder:text-kumo-subtle/75"
							/>
						</div>
					</div>

					<RichTextEditor value={body} onChange={setBody} />

					<div className="flex justify-between items-center pt-1">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={closeComposeModal}
							disabled={isSending}
						>
							放弃
						</Button>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								loading={isSavingDraft}
								disabled={isSending}
								icon={<FloppyDiskIcon size={14} />}
								onClick={handleSaveDraft}
							>
								{isSavingDraft ? "保存中..." : "存为草稿"}
							</Button>
							<button
								type="submit"
								disabled={isSavingDraft || isSending}
								className="inline-flex items-center gap-2 h-8 px-3.5 rounded-lg text-[13px] font-medium text-white bg-[var(--craft-accent)] hover:bg-[var(--craft-accent-hover)] disabled:opacity-50 active:scale-[0.985] transition-all cursor-pointer border-0 shadow-[0_4px_14px_-4px_var(--craft-accent-ring)]"
							>
								<PaperPlaneTiltIcon size={14} weight="bold" />
								<span>{isSending ? "发送中..." : "发送"}</span>
								<kbd className="hidden sm:inline-flex items-center justify-center h-4.5 px-1 rounded bg-white/18 text-[10px] font-mono text-white/90 border border-white/20">
									⌘↵
								</kbd>
							</button>
						</div>
					</div>
				</form>
			</Dialog>
		</Dialog.Root>
	);
}
