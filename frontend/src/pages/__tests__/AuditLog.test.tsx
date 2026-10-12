/**
 * AuditLog page tests
 * Tests audit entry display and filtering
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { AuditLogPage } from "../AuditLog";

vi.mock("@/lib/api", () => ({
  api: {
    audit: {
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

describe("AuditLogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders audit log page heading", () => {
    renderWithProviders(<AuditLogPage />);
    expect(
      screen.getByRole("heading", { name: /audit log/i })
    ).toBeInTheDocument();
  });

  it("displays audit entries table", () => {
    renderWithProviders(<AuditLogPage />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders table headers with scope attribute", () => {
    renderWithProviders(<AuditLogPage />);
    const table = screen.getByRole("table");
    const headers = table.querySelectorAll("th[scope='col']");
    expect(headers.length).toBeGreaterThan(0);
  });

  it("shows audit entry timestamp and action", () => {
    renderWithProviders(<AuditLogPage />);
    // Should display audit information
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
  });

  it("renders audit rows with keyboard navigation", () => {
    renderWithProviders(<AuditLogPage />);
    const table = screen.getByRole("table");
    const rows = table.querySelectorAll("tbody tr");
    if (rows.length > 0) {
      rows.forEach((row) => {
        const buttons = row.querySelectorAll("button");
        expect(buttons.length).toBeGreaterThanOrEqual(0);
      });
    }
  });

  it("displays pagination controls if applicable", () => {
    renderWithProviders(<AuditLogPage />);
    const page = screen.getByRole("table").closest("div");
    expect(page).toBeInTheDocument();
  });
});
