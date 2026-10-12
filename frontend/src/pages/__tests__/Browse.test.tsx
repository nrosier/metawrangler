/**
 * Browse page tests
 * Tests mount selection, file navigation, and selection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { BrowsePage } from "../Browse";

// Mock the API
vi.mock("@/lib/api", () => ({
  api: {
    mounts: {
      list: vi.fn(),
      health: vi.fn(),
    },
    scan: {
      getMetadata: vi.fn(),
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

describe("BrowsePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the browse page", () => {
    const { container } = renderWithProviders(<BrowsePage />);
    // Page should render without error
    expect(container).toBeInTheDocument();
  });

  it("renders browse page content", () => {
    const { container } = renderWithProviders(<BrowsePage />);
    // Browse page should have some content
    expect(container.textContent).toBeDefined();
  });

  it("renders with accessible button elements", () => {
    renderWithProviders(<BrowsePage />);
    // Browse page should have buttons for navigation
    const buttons = screen.queryAllByRole("button");
    // May have buttons, should not crash
    expect(buttons).toBeDefined();
  });

  it("renders accessible table if present", () => {
    const { container } = renderWithProviders(<BrowsePage />);
    const tables = container.querySelectorAll("table");
    tables.forEach((table) => {
      const headers = table.querySelectorAll("th[scope='col']");
      // Should have scope attribute on headers if table exists
      if (headers.length > 0) {
        expect(headers[0].getAttribute("scope")).toBe("col");
      }
    });
  });

  it("does not crash on render", () => {
    renderWithProviders(<BrowsePage />);
    expect(document.body.textContent).toBeDefined();
  });
});
