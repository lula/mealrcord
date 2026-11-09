import { useCallback, useRef } from "react";
import { useBlocker } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Asks for confirmation before leaving a page with unsaved changes.
 * Render `dialog` in the page and call `allowNavigation()` right before
 * navigating away after a save.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  // Refs keep `shouldBlockFn` stable, so the blocker isn't re-registered on every render.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const allowedRef = useRef(false);

  const shouldBlockFn = useCallback(
    ({ current, next }: { current: { pathname: string }; next: { pathname: string } }) =>
      dirtyRef.current && !allowedRef.current && current.pathname !== next.pathname,
    [],
  );
  const blocker = useBlocker({ shouldBlockFn, withResolver: true, enableBeforeUnload: false });

  const dialog = (
    <AlertDialog open={blocker.status === "blocked"} onOpenChange={(open) => !open && blocker.reset?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Uscire senza salvare?</AlertDialogTitle>
          <AlertDialogDescription>Hai modifiche non salvate. Se procedi, i dati inseriti andranno persi.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { dialog, allowNavigation: () => (allowedRef.current = true) };
}
