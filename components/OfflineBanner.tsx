"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useOptionalMessages } from "@/lib/i18n/client";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** True when the browser reports no connection. On the server it is always online. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

// Shown at the top of the field portals while the phone has no signal, so a
// failed save is understood rather than mysterious. It is a polite live region:
// it announces when the connection drops and when it returns.
export default function OfflineBanner() {
  const online = useIsOnline();
  const text = useOptionalMessages("common")?.offlineBanner ?? "You're offline. Changes can't be saved until your connection is back.";
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <p
          data-testid="offline-banner"
          className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-utility text-sm text-amber-900"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {text}
        </p>
      )}
    </div>
  );
}
