import { sanitizedHtml } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/** Shows text saved by the rich text editor (or older plain text). */
export function RichText({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  return <div className={cn("rich-text text-sm", className)} dangerouslySetInnerHTML={{ __html: sanitizedHtml(value) }} />;
}
