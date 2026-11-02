import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dbErrorMessage } from "@/db/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    // Data is local: no need to refetch on focus or retry failures.
    queries: { refetchOnWindowFocus: false, retry: false, staleTime: Infinity },
  },
});

/**
 * Mutation that refreshes every query on success (the DB is local and small,
 * so a full refresh is simpler than tracking keys) and toasts errors.
 */
export function useDbMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.invalidateQueries();
      if (opts.success) toast.success(opts.success);
    },
    onError: (e) => toast.error(dbErrorMessage(e)),
  });
}
