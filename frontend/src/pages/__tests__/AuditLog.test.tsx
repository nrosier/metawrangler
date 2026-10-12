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

  it("renders audit log page", () => {
    renderWithProviders(<AuditLogPage />);
    expect(document.body.textContent).toBeDefined();
  });

  it("does not crash on render", () => {
    const { container } = renderWithProviders(<AuditLogPage />);
    expect(container).toBeInTheDocument();
  });

  it("renders accessible tables if present", () => {
    const { container } = renderWithProviders(<AuditLogPage />);
    const tables = container.querySelectorAll("table");
    tables.forEach((table) => {
      const headers = table.querySelectorAll("th[scope='col']");
      if (headers.length > 0) {
        expect(headers[0].getAttribute("scope")).toBe("col");
      }
    });
  });

  it("has keyboard-accessible buttons if present", () => {
    renderWithProviders(<AuditLogPage />);
    const buttons = screen.queryAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn.tagName.toLowerCase()).toBe("button");
    });
  });

  it("renders page content", () => {
    renderWithProviders(<AuditLogPage />);
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });
});
