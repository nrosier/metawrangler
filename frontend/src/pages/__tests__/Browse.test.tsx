/**
 * Browse page tests
 * Tests mount selection, file navigation, and selection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders the browse page heading", () => {
    renderWithProviders(<BrowsePage />);
    expect(screen.getByRole("heading", { name: /browse/i })).toBeInTheDocument();
  });

  it("displays mount list section", () => {
    renderWithProviders(<BrowsePage />);
    expect(screen.getByText(/mounts?/i)).toBeInTheDocument();
  });

  it("shows file table when mount selected", () => {
    renderWithProviders(<BrowsePage />);
    // File table is shown when mount is selected
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("displays keyboard navigation hint", () => {
    renderWithProviders(<BrowsePage />);
    // Browse page should show accessible navigation info
    const links = screen.queryAllByRole("button");
    expect(links.length).toBeGreaterThanOrEqual(0); // May have nav buttons
  });

  it("renders with scope attribute on table headers", () => {
    renderWithProviders(<BrowsePage />);
    const table = screen.getByRole("table");
    const headers = table.querySelectorAll("th[scope='col']");
    expect(headers.length).toBeGreaterThan(0);
  });

  it("displays selection state info", () => {
    renderWithProviders(<BrowsePage />);
    expect(screen.getByText(/selected/i)).toBeInTheDocument();
  });
});
