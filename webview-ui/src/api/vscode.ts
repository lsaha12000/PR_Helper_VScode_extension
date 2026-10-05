// Acquire the VS Code API once and cache it.
// In a browser dev environment this falls back to a no-op stub so Vite HMR still works.
const vscode = (() => {
  if (typeof acquireVsCodeApi !== "undefined") {
    return acquireVsCodeApi();
  }
  return { postMessage: (_msg: unknown) => console.log("[stub postMessage]", _msg) };
})();

declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void };

type Listener = (payload: unknown) => void;
const listeners: Record<string, Listener[]> = {};

window.addEventListener("message", (event) => {
  const { type, payload } = event.data as { type: string; payload: unknown };
  listeners[type]?.forEach((fn) => fn(payload));
});

export function send(type: string, payload?: unknown) {
  vscode.postMessage({ type, payload });
}

export function on(type: string, fn: Listener): () => void {
  listeners[type] = listeners[type] ?? [];
  listeners[type].push(fn);
  return () => {
    listeners[type] = listeners[type].filter((f) => f !== fn);
  };
}

/** Fire-and-forget RPC: send a message, wait for the paired response. */
export function rpc<T>(sendType: string, receiveType: string, payload?: unknown): Promise<T> {
  return new Promise((resolve) => {
    const off = on(receiveType, (data) => {
      off();
      resolve(data as T);
    });
    send(sendType, payload);
  });
}
