import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

/** Pages to show: first, last, and the ones around the current page; null = ellipsis. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
}

/** Page buttons for a client-side list. `page` starts at 1. Hidden when there is only one page. */
export function ListPagination({ page, pageCount, onChange, className }: { page: number; pageCount: number; onChange: (page: number) => void; className?: string }) {
  if (pageCount <= 1) return null;
  const go = (p: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (p >= 1 && p <= pageCount && p !== page) onChange(p);
  };
  const disabled = "pointer-events-none opacity-50";

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" text="Precedente" aria-disabled={page === 1} className={cn(page === 1 && disabled)} onClick={go(page - 1)} />
        </PaginationItem>
        {pageWindow(page, pageCount).map((p, i) => (
          <PaginationItem key={p ?? `gap-${i}`}>
            {p === null ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink href="#" isActive={p === page} onClick={go(p)}>
                {p}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext href="#" text="Successiva" aria-disabled={page === pageCount} className={cn(page === pageCount && disabled)} onClick={go(page + 1)} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
