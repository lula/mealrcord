import { useRef, useState, type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="bg-background/95 sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b px-4 backdrop-blur">
      {/* <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5 data-vertical:self-center" /> */}
      <div className="min-w-0 flex-1">
        <PageTitle title={title} />
        {description && <p className="text-muted-foreground truncate text-xs">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Single-line title; when it is truncated, hovering shows the full text in a card. */
function PageTitle({ title }: { title: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const isTruncated = () => !!ref.current && ref.current.scrollWidth > ref.current.clientWidth;

  return (
    <HoverCard open={open} onOpenChange={(o) => setOpen(o && isTruncated())} openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <h1 ref={ref} className="truncate text-lg font-semibold">
          {title}
        </h1>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-auto max-w-md font-semibold break-words">
        {title}
      </HoverCardContent>
    </HoverCard>
  );
}

export function PageBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`flex-1 p-4 ${className}`}>{children}</main>;
}
