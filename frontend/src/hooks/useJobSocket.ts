/**
 * WebSocket hook — connects to /ws/jobs/:id and streams progress messages.
 */
import { useEffect, useRef, useState } from "react";
import type { Job, JobFile, WsMessage } from "@/types";

export interface JobProgress {
  job: Job | null;
  files: Map<string, JobFile>;
  connected: boolean;
  complete: boolean;
  error: string | null;
}

export function useJobSocket(jobId: string | null): JobProgress {
  const [state, setState] = useState<JobProgress>({
    job: null,
    files: new Map(),
    connected: false,
    complete: false,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/jobs/${jobId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true }));
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(event.data) as WsMessage;
      } catch {
        return;
      }

      setState((s) => {
        const files = new Map(s.files);

        switch (msg.type) {
          case "job_update":
            return { ...s, job: msg.job };
          case "file_update":
            files.set(msg.file.filePath, msg.file);
            return { ...s, files };
          case "job_complete":
            return { ...s, job: msg.job, complete: true, connected: false };
          case "error":
            return { ...s, error: msg.message, connected: false };
          default:
            return s;
        }
      });
    };

    ws.onerror = () => {
      setState((s) => ({ ...s, error: "WebSocket connection error", connected: false }));
    };

    ws.onclose = () => {
      setState((s) => ({ ...s, connected: false }));
    };

    return () => {
      ws.close();
    };
  }, [jobId]);

  return state;
}
