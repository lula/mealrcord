import type { ComponentProps } from "react";
import { ChevronDown, FileText, NotebookText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** "Condividi" button with a choice of format: PDF or plain text note. */
export function ShareMenu({
  onPdf,
  onText,
  disabled,
  size,
}: {
  onPdf: () => void;
  onText: () => void;
  disabled?: boolean;
  size?: ComponentProps<typeof Button>["size"];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={disabled}>
          <Share2 /> Condividi <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      {/* As wide as the button, wider only if the text needs it. */}
      <DropdownMenuContent align="end" className="min-w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuItem onSelect={onPdf}>
          <FileText /> Condividi PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onText}>
          <NotebookText /> Condividi nota
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
