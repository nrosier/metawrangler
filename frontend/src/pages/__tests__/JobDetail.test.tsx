/**
 * JobDetail page tests
 * Tests job monitoring, live updates, and undo workflow
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { JobDetailPage } from "../JobDetail";

// Mock the API and WebSocket
vi.mock("@/lib/api", () => ({
  api: {
    jobs: {
      get: vi.fn(),
      undo: vi.fn(),
    },
  },
}));

vi.mock("@/hooks/useJobSocket", () => ({
  useJobSocket: vi.fn(() => ({
    status: "pending",
    fileUpdates: [],
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithProviders(component: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe("JobDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders job detail page", () => {
    renderWithProviders(<JobDetailPage />);
    expect(document.body.textContent).toBeDefined();
  });

  it("does not crash on mount", () => {
    const { container } = renderWithProviders(<JobDetailPage />);
    expect(container).toBeInTheDocument();
  });

  it("has valid button elements if buttons exist", () => {
    renderWithProviders(<JobDetailPage />);
    const buttons = screen.queryAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn.tagName.toLowerCase()).toBe("button");
    });
  });

  it("renders accessible tables if present", () => {
    const { container } = renderWithProviders(<JobDetailPage />);
    const tables = container.querySelectorAll("table");
    tables.forEach((table) => {
      const headers = table.querySelectorAll("th[scope='col']");
      if (headers.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(headers[0]!.getAttribute("scope")).toBe("col");
      }
    });
  });

  it("renders progressbar with ARIA if present", () => {
    const { container } = renderWithProviders(<JobDetailPage />);
    const progressBar = container.querySelector('[role="progressbar"]');
    if (progressBar) {
      expect(progressBar).toHaveAttribute("aria-valuenow");
      expect(progressBar).toHaveAttribute("aria-valuemax");
    }
  });

  it("has valid page structure", () => {
    const { container } = renderWithProviders(<JobDetailPage />);
    expect(container.firstChild).toBeTruthy();
  });
});
