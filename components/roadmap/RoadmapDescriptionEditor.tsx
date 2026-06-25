"use client";

import {
  BoldOutlined,
  ClearOutlined,
  CodeOutlined,
  DisconnectOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, type ReactNode } from "react";

type RoadmapDescriptionEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
};

export function RoadmapDescriptionEditor({
  value,
  onChange,
}: RoadmapDescriptionEditorProps) {
  const editor = useEditor({
    content: value || "",
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [3],
        },
      }),
      Link.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
      }),
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextValue = value || "";
    if (editor.getHTML() !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL", previousUrl ?? "https://");

    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }, [editor]);

  if (!editor) {
    return <div className="roadmap-rich-editor roadmap-rich-editor-loading" />;
  }

  const styleTools = [
    {
      active: editor.isActive("bold"),
      icon: <BoldOutlined />,
      label: "Bold",
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      active: editor.isActive("italic"),
      icon: <ItalicOutlined />,
      label: "Italic",
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      active: editor.isActive("strike"),
      icon: <StrikethroughOutlined />,
      label: "Strike",
      onClick: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      active: editor.isActive("code"),
      icon: <CodeOutlined />,
      label: "Inline code",
      onClick: () => editor.chain().focus().toggleCode().run(),
    },
    {
      active: editor.isActive("link"),
      icon: <LinkOutlined />,
      label: "Link",
      onClick: setLink,
    },
    {
      active: false,
      icon: <DisconnectOutlined />,
      label: "Unlink",
      onClick: () => editor.chain().focus().extendMarkRange("link").unsetLink().run(),
    },
  ];

  const blockTools = [
    {
      active: editor.isActive("heading", { level: 3 }),
      label: "Heading",
      text: "H",
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      active: editor.isActive("blockquote"),
      label: "Quote",
      text: "❝",
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      active: editor.isActive("codeBlock"),
      icon: <CodeOutlined />,
      label: "Code block",
      onClick: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ];

  const listTools = [
    {
      active: editor.isActive("bulletList"),
      icon: <UnorderedListOutlined />,
      label: "Bullet list",
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      active: editor.isActive("orderedList"),
      icon: <OrderedListOutlined />,
      label: "Numbered list",
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  const renderTool = (tool: {
    active: boolean;
    icon?: ReactNode;
    label: string;
    onClick: () => void;
    text?: string;
  }) => (
    <Tooltip key={tool.label} title={tool.label}>
      <Button
        aria-label={tool.label}
        className={tool.active ? "is-active" : ""}
        icon={tool.icon}
        size="small"
        type="text"
        onClick={tool.onClick}
      >
        {tool.text}
      </Button>
    </Tooltip>
  );

  return (
    <div className="roadmap-rich-editor">
      <div className="roadmap-rich-editor-toolbar">
        {styleTools.map(renderTool)}
        <span className="roadmap-rich-editor-divider" />
        {blockTools.map(renderTool)}
        <span className="roadmap-rich-editor-divider" />
        {listTools.map(renderTool)}
        <span className="roadmap-rich-editor-divider" />
        <Tooltip title="Undo">
          <Button
            aria-label="Undo"
            disabled={!editor.can().undo()}
            icon={<UndoOutlined />}
            size="small"
            type="text"
            onClick={() => editor.chain().focus().undo().run()}
          />
        </Tooltip>
        <Tooltip title="Redo">
          <Button
            aria-label="Redo"
            disabled={!editor.can().redo()}
            icon={<RedoOutlined />}
            size="small"
            type="text"
            onClick={() => editor.chain().focus().redo().run()}
          />
        </Tooltip>
        <span className="roadmap-rich-editor-divider" />
        <Tooltip title="Clear format">
          <Button
            aria-label="Clear format"
            icon={<ClearOutlined />}
            size="small"
            type="text"
            onClick={() =>
              editor.chain().focus().clearNodes().unsetAllMarks().run()
            }
          />
        </Tooltip>
      </div>
      <EditorContent className="roadmap-rich-editor-content" editor={editor} />
    </div>
  );
}
