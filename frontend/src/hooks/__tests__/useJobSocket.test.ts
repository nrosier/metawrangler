/**
 * useJobSocket hook tests
 * Tests WebSocket subscription and event handling
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useJobSocket } from "../useJobSocket";

describe("useJobSocket", () => {
  let wsInstance: WebSocket | null = null;
  let listeners: Record<string, Function[]> = {};

  beforeEach(() => {
    listeners = {};

    // Mock WebSocket globally
    const mockWebSocket = class {
      url: string;
      readyState: number = 1; // OPEN
      onopen: ((ev: Event) => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      onclose: ((ev: CloseEvent) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        wsInstance = this as unknown as WebSocket;
      }

      addEventListener(event: string, handler: Function) {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(handler);
      }

      removeEventListener(event: string, handler: Function) {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      }

      send() {
        // Mock implementation
      }

      close() {
        this.readyState = 3; // CLOSED
      }
    };

    (globalThis as any).WebSocket = mockWebSocket;
  });

  afterEach(() => {
    wsInstance = null;
    listeners = {};
  });

  it("establishes WebSocket connection with correct URL", () => {
    const jobId = "test-job-123";
    renderHook(() => useJobSocket(jobId));

    expect(wsInstance).not.toBeNull();
    if (wsInstance) {
      expect((wsInstance as any).url).toMatch(
        /ws:\/\/|wss:\/\//
      );
    }
  });

  it("returns initial disconnected state", () => {
    const { result } = renderHook(() => useJobSocket("test-job-123"));

    expect(result.current.connected).toBe(false);
    expect(result.current.job).toBeNull();
    expect(result.current.files).toBeInstanceOf(Map);
  });

  it("handles job update messages", async () => {
    const { result } = renderHook(() => useJobSocket("test-job-123"));

    // Simulate WebSocket connection opening
    if (wsInstance && (wsInstance as any).onopen) {
      (wsInstance as any).onopen(new Event("open"));
    }

    const mockJob: any = { id: "test-job-123", status: "running", totalFiles: 5, processedFiles: 2 };

    if (wsInstance && (wsInstance as any).onmessage) {
      (wsInstance as any).onmessage(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "job_update",
            job: mockJob,
          }),
        })
      );
    }

    await waitFor(() => {
      expect(result.current.job).not.toBeNull();
      expect(result.current.job?.status).toBe("running");
    });
  });

  it("accumulates file updates in map", async () => {
    const { result } = renderHook(() => useJobSocket("test-job-123"));

    const mockFile: any = { id: "f1", jobId: "test-job-123", filePath: "test.mkv", status: "success" };

    if (wsInstance && (wsInstance as any).onmessage) {
      (wsInstance as any).onmessage(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "file_update",
            file: mockFile,
          }),
        })
      );
    }

    await waitFor(() => {
      expect(result.current.files.size).toBeGreaterThan(0);
      expect(result.current.files.get("test.mkv")).not.toBeUndefined();
    });
  });

  it("cleans up WebSocket on unmount", () => {
    const { unmount } = renderHook(() => useJobSocket("test-job-123"));

    unmount();

    // WebSocket should be closed after unmount
    expect(wsInstance?.readyState).toBe(3); // 3 = CLOSED
  });
});
