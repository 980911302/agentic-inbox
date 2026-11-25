// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Tooltip } from "@cloudflare/kumo";
import {
	ArrowClockwiseIcon,
	ArrowCounterClockwiseIcon,
	LinkBreakIcon,
	LinkSimpleIcon,
	ListBulletsIcon,
	ListNumbersIcon,
	MinusIcon,
	QuotesIcon,
	TextBIcon,
	TextItalicIcon,
	TextStrikethroughIcon,
	TextUnderlineIcon,
} from "@phosphor-icons/react";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TiptapImage from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect } from "react";

interface RichTextEditorProps {
	value: string;
	onChange: (value: string) => void;
}

function FormatBtn({
	label,
	active,
	disabled,
	onClick,
	icon,
}: {
	label: string;
	active?: boolean;
	disabled?: boolean;
	onClick: () => void;
	icon: React.ReactNode;
}) {
	return (
		<Tooltip content={label} side="bottom" asChild>
			<button
				type="button"
				onClick={onClick}
				disabled={disabled}
				aria-label={label}
				className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer border disabled:opacity-35 disabled:cursor-not-allowed ${
					active
						? "craft-accent-badge"
						: "border-transparent bg-transparent text-kumo-subtle hover:text-kumo-default hover:bg-[var(--surface-hover)]"
				}`}
			>
				{icon}
			</button>
		</Tooltip>
	);
}

export default function RichTextEditor({
	value,
	onChange,
}: RichTextEditorProps) {
	const editor = useEditor({
		extensions: [
			StarterKit,
			Underline,
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			LinkExtension.configure({ openOnClick: false }),
			TiptapImage,
			TextStyle,
			Color,
			Highlight.configure({ multicolor: true }),
		],
		content: value,
		editorProps: {
			attributes: {
				class:
					"prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3.5 text-[14px] leading-relaxed text-kumo-default [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--craft-accent-ring)] [&_blockquote]:pl-3 [&_blockquote]:text-kumo-subtle [&_blockquote]:bg-kumo-recessed/60 [&_blockquote]:py-1.5 [&_blockquote]:my-2 [&_blockquote]:text-xs [&_blockquote]:rounded-r-md",
			},
		},
		onUpdate: ({ editor }) => {
			onChange(editor.getHTML());
		},
	});

	useEffect(() => {
		if (editor && !editor.isDestroyed && value !== editor.getHTML()) {
			editor.commands.setContent(value);
			const rafId = requestAnimationFrame(() => {
				if (!editor.isDestroyed) {
					editor.commands.focus("start");
				}
			});
			return () => cancelAnimationFrame(rafId);
		}
	}, [value, editor]);

	const setLink = useCallback(() => {
		if (!editor) return;
		const previousUrl = editor.getAttributes("link").href;
		const url = window.prompt("请输入链接地址 (URL)", previousUrl);
		if (url === null) return;
		if (url === "") {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
	}, [editor]);

	if (!editor) return null;

	return (
		<div className="rounded-xl border border-kumo-line bg-kumo-base overflow-hidden flex flex-col flex-1 focus-within:border-[var(--craft-accent-ring)] transition-colors">
			{/* 紧凑格式化工具条 */}
			<div className="flex flex-wrap items-center gap-0.5 bg-kumo-recessed/50 px-2.5 py-1.5 border-b border-kumo-line shrink-0">
				<FormatBtn
					label="加粗"
					active={editor.isActive("bold")}
					onClick={() => editor.chain().focus().toggleBold().run()}
					icon={<TextBIcon size={15} />}
				/>
				<FormatBtn
					label="斜体"
					active={editor.isActive("italic")}
					onClick={() => editor.chain().focus().toggleItalic().run()}
					icon={<TextItalicIcon size={15} />}
				/>
				<FormatBtn
					label="下划线"
					active={editor.isActive("underline")}
					onClick={() => editor.chain().focus().toggleUnderline().run()}
					icon={<TextUnderlineIcon size={15} />}
				/>
				<FormatBtn
					label="删除线"
					active={editor.isActive("strike")}
					onClick={() => editor.chain().focus().toggleStrike().run()}
					icon={<TextStrikethroughIcon size={15} />}
				/>

				<div className="mx-1 h-4 w-px bg-kumo-line" />

				<FormatBtn
					label="无序列表"
					active={editor.isActive("bulletList")}
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					icon={<ListBulletsIcon size={15} />}
				/>
				<FormatBtn
					label="有序列表"
					active={editor.isActive("orderedList")}
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					icon={<ListNumbersIcon size={15} />}
				/>

				<div className="mx-1 h-4 w-px bg-kumo-line" />

				<FormatBtn
					label="引用"
					active={editor.isActive("blockquote")}
					onClick={() => editor.chain().focus().toggleBlockquote().run()}
					icon={<QuotesIcon size={15} />}
				/>
				<FormatBtn
					label="插入链接"
					active={editor.isActive("link")}
					onClick={setLink}
					icon={<LinkSimpleIcon size={15} />}
				/>
				{editor.isActive("link") && (
					<FormatBtn
						label="移除链接"
						onClick={() => editor.chain().focus().unsetLink().run()}
						icon={<LinkBreakIcon size={15} />}
					/>
				)}
				<FormatBtn
					label="分隔线"
					onClick={() => editor.chain().focus().setHorizontalRule().run()}
					icon={<MinusIcon size={15} />}
				/>

				<div className="mx-1 h-4 w-px bg-kumo-line" />

				<FormatBtn
					label="撤销"
					disabled={!editor.can().undo()}
					onClick={() => editor.chain().focus().undo().run()}
					icon={<ArrowCounterClockwiseIcon size={15} />}
				/>
				<FormatBtn
					label="重做"
					disabled={!editor.can().redo()}
					onClick={() => editor.chain().focus().redo().run()}
					icon={<ArrowClockwiseIcon size={15} />}
				/>
			</div>

			<div className="flex-1 overflow-y-auto">
				<EditorContent editor={editor} />
			</div>
		</div>
	);
}
