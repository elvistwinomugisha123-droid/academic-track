"use client";

import { useEffect, useState } from "react";

export function PwaRuntime() {
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    setOffline(!navigator.onLine);
    const online = () => setOffline(false); const offlineHandler = () => setOffline(true);
    window.addEventListener("online", online); window.addEventListener("offline", offlineHandler);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      const observe = () => { if (registration.waiting) setWaiting(registration.waiting); };
      observe(); registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", observe));
    }).catch(() => { /* the app remains online-first without a worker */ });
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offlineHandler); };
  }, []);
  useEffect(() => { if (!("serviceWorker" in navigator)) return; const reload = () => window.location.reload(); navigator.serviceWorker.addEventListener("controllerchange", reload); return () => navigator.serviceWorker.removeEventListener("controllerchange", reload); }, []);
  return <>{offline && <div className="connectivity-banner" role="status">You are offline. Saved school records remain unchanged; reconnect before submitting work.</div>}{waiting && <div className="update-banner" role="status"><span>An ATE update is ready.</span><button type="button" onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}>Update now</button></div>}</>;
}
