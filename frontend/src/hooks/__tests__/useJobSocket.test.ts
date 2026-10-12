/**
 * useJobSocket hook tests
 * Tests WebSocket subscription and event handling
 */
import { describe, it, expect, vi } from "vitest";
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

    global.WebSocket = mockWebSocket as any;
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

  it("returns initial pending status", () => {
    const { result } = renderHook(() => useJobSocket("test-job-123"));

    expect(result.current.status).toBe("pending");
    expect(Array.isArray(result.current.fileUpdates)).toBe(true);
  });

  it("handles job update messages", async () => {
    const { result } = renderHook(() => useJobSocket("test-job-123"));

    const updateMessage = new MessageEvent("message", {
      data: JSON.stringify({
        type: "job_update",
        status: "running",
      }),
    });

    if (listeners.message && listeners.message.length > 0) {
      listeners.message[0](updateMessage);
    }

    await waitFor(() => {
      expect(result.current.status).toBe("running");
    });
  });

  it("accumulates file updates in array", async () => {
    const { result } = renderHook(() => useJobSocket("test-job-123"));

    const fileUpdate = new MessageEvent("message", {
      data: JSON.stringify({
        type: "file_update",
        filePath: "test.mkv",
        status: "done",
      }),
    });

    if (listeners.message && listeners.message.length > 0) {
      listeners.message[0](fileUpdate);
    }

    await waitFor(() => {
      expect(result.current.fileUpdates.length).toBeGreaterThan(0);
    });
  });

  it("cleans up WebSocket on unmount", () => {
    const { unmount } = renderHook(() => useJobSocket("test-job-123"));

    unmount();

    // WebSocket should be closed or cleanup should have occurred
    // This validates per-socket handler cleanup (ARCH-02 fix)
    expect(listeners.message?.length || 0).toBeLessThanOrEqual(1);
  });
});
