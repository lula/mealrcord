import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { toHtml } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Small rich text editor (bold, italic, lists) built on Tiptap.
 * `value` is HTML; an empty editor gives "". Plain text from older data is accepted too.
 */
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  readOnly = false,
  minRows = 3,
  id,
  "aria-label": ariaLabel,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  /** Minimum height, in lines of text. */
  minRows?: number;
  id?: string;
  "aria-label"?: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false, link: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: toHtml(value),
    editable: !readOnly,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        class: "rich-text min-h-full px-3 py-2 text-sm outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
    onBlur: () => onBlur?.(),
  });

  // Follow outside changes (form reset when data loads), without fighting the user's typing.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (toHtml(value) !== current && value !== current) editor.commands.setContent(toHtml(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
    }),
  });

  return (
    <div
      className={cn(
        "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex w-full flex-col rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]",
        readOnly && "opacity-80",
        className,
      )}
    >
      {!readOnly && editor && (
        <div className="flex gap-0.5 border-b p-1">
          <Toggle size="sm" pressed={active?.bold} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Grassetto">
            <Bold />
          </Toggle>
          <Toggle size="sm" pressed={active?.italic} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Corsivo">
            <Italic />
          </Toggle>
          <Toggle size="sm" pressed={active?.bulletList} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Elenco puntato">
            <List />
          </Toggle>
          <Toggle size="sm" pressed={active?.orderedList} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Elenco numerato">
            <ListOrdered />
          </Toggle>
        </div>
      )}
      <EditorContent editor={editor} className="flex-1 cursor-text" style={{ minHeight: `${minRows * 1.5 + 1}rem` }} onClick={() => editor?.commands.focus()} />
    </div>
  );
}
