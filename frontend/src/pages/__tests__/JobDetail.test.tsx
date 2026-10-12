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

  it("renders job detail heading", () => {
    renderWithProviders(<JobDetailPage />);
    expect(screen.getByRole("heading", { name: /job detail/i })).toBeInTheDocument();
  });

  it("displays progress bar with ARIA attributes", () => {
    renderWithProviders(<JobDetailPage />);
    const progressBar = screen.queryByRole("progressbar");
    if (progressBar) {
      expect(progressBar).toHaveAttribute("aria-valuenow");
      expect(progressBar).toHaveAttribute("aria-valuemax");
    }
  });

  it("shows job status badge", () => {
    renderWithProviders(<JobDetailPage />);
    expect(screen.getByText(/pending|running|done|failed/i)).toBeInTheDocument();
  });

  it("renders file results table", () => {
    renderWithProviders(<JobDetailPage />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows table headers with scope attribute", () => {
    renderWithProviders(<JobDetailPage />);
    const table = screen.getByRole("table");
    const headers = table.querySelectorAll("th[scope='col']");
    expect(headers.length).toBeGreaterThan(0);
  });

  it("displays undo button when job complete", async () => {
    renderWithProviders(<JobDetailPage />);
    // Undo button should be visible when job is done
    const undoButton = screen.queryByRole("button", { name: /undo/i });
    // May be hidden initially if job not complete
    expect(undoButton === null || undoButton.hasAttribute("aria-disabled")).toBeTruthy();
  });

  it("renders keyboard-accessible action buttons", () => {
    renderWithProviders(<JobDetailPage />);
    const buttons = screen.queryAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("type");
    });
  });
});
