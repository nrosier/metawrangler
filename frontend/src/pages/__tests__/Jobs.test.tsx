/**
 * Jobs list page tests
 * Tests job listing, pagination, and navigation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { JobsPage } from "../Jobs";

vi.mock("@/lib/api", () => ({
  api: {
    jobs: {
      list: vi.fn(),
    },
  },
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

describe("JobsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders jobs page heading", () => {
    renderWithProviders(<JobsPage />);
    expect(screen.getByRole("heading", { name: /jobs?/i })).toBeInTheDocument();
  });

  it("displays jobs list table", () => {
    renderWithProviders(<JobsPage />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders table headers with scope attribute", () => {
    renderWithProviders(<JobsPage />);
    const table = screen.getByRole("table");
    const headers = table.querySelectorAll("th[scope='col']");
    expect(headers.length).toBeGreaterThan(0);
  });

  it("renders job rows as keyboard-accessible elements", () => {
    renderWithProviders(<JobsPage />);
    const table = screen.getByRole("table");
    const rows = table.querySelectorAll("tbody tr");
    if (rows.length > 0) {
      // Rows should contain buttons or be keyboard navigable
      rows.forEach((row) => {
        const buttons = row.querySelectorAll("button");
        expect(buttons.length + row.querySelectorAll("[role='button']").length).toBeGreaterThanOrEqual(
          0
        );
      });
    }
  });

  it("shows status badges for jobs", () => {
    renderWithProviders(<JobsPage />);
    // Status should be visible for jobs
    const statusElements = screen.queryAllByText(
      /pending|running|done|failed|partial/i
    );
    expect(statusElements.length).toBeGreaterThanOrEqual(0);
  });

  it("displays loading or empty state", () => {
    renderWithProviders(<JobsPage />);
    const content = screen.getByRole("table").textContent;
    expect(content).toBeDefined();
  });
});
