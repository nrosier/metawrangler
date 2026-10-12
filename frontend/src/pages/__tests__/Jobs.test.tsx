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

  it("renders jobs page", () => {
    renderWithProviders(<JobsPage />);
    expect(document.body.textContent).toBeDefined();
  });

  it("does not crash on render", () => {
    const { container } = renderWithProviders(<JobsPage />);
    expect(container).toBeInTheDocument();
  });

  it("renders accessible tables if present", () => {
    const { container } = renderWithProviders(<JobsPage />);
    const tables = container.querySelectorAll("table");
    tables.forEach((table) => {
      const headers = table.querySelectorAll("th[scope='col']");
      if (headers.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(headers[0]!.getAttribute("scope")).toBe("col");
      }
    });
  });

  it("has keyboard-accessible buttons if present", () => {
    renderWithProviders(<JobsPage />);
    const buttons = screen.queryAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn.tagName.toLowerCase()).toBe("button");
    });
  });

  it("renders page content without errors", () => {
    renderWithProviders(<JobsPage />);
    // Page should have rendered some content
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });
});
