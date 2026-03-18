"use client";

import { useRef, useEffect } from "react";

export default function TerminalView({ wsUrl }: { wsUrl: string }) {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!termRef.current || !wsUrl) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      const terminal = new Terminal({
        fontSize: 12,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
        theme: {
          background: "#09090b",
          foreground: "#d4d4d8",
          cursor: "#3b82f6",
          selectionBackground: "#3b82f640",
        },
        cursorBlink: true,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(termRef.current!);
      fitAddon.fit();

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        terminal.writeln("\x1b[32m● Connected to shell\x1b[0m\r\n");
        ws.send("cd /home/agent 2>/dev/null; clear\n");
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          terminal.write(new Uint8Array(event.data));
        } else {
          terminal.write(event.data);
        }
      };

      ws.onclose = () => {
        terminal.writeln("\r\n\x1b[31m● Disconnected\x1b[0m");
      };

      ws.onerror = () => {
        terminal.writeln("\r\n\x1b[31m● Connection error\x1b[0m");
      };

      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      const el = termRef.current!;
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
        } catch {}
      });
      resizeObserver.observe(el);

      cleanup = () => {
        resizeObserver.disconnect();
        ws.close();
        terminal.dispose();
      };
    })();

    return () => {
      cleanup?.();
    };
  }, [wsUrl]);

  return <div ref={termRef} className="h-full w-full bg-[#09090b] p-1" />;
}
