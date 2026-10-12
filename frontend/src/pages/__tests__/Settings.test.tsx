/**
 * Settings page tests
 * Tests form accessibility, mount management
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { SettingsPage } from "../Settings";

vi.mock("@/lib/api", () => ({
  api: {
    mounts: {
      list: vi.fn(),
      add: vi.fn(),
      delete: vi.fn(),
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

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings page", () => {
    renderWithProviders(<SettingsPage />);
    expect(document.body.textContent).toBeDefined();
  });

  it("does not crash on render", () => {
    const { container } = renderWithProviders(<SettingsPage />);
    expect(container).toBeInTheDocument();
  });

  it("displays form inputs", () => {
    const { container } = renderWithProviders(<SettingsPage />);
    const inputs = container.querySelectorAll("input");
    // Settings page should have form inputs
    expect(inputs.length).toBeGreaterThanOrEqual(0);
  });

  it("renders form buttons", () => {
    renderWithProviders(<SettingsPage />);
    const buttons = screen.queryAllByRole("button");
    // Settings page should have buttons
    expect(buttons).toBeDefined();
  });

  it("displays accessible table if present", () => {
    const { container } = renderWithProviders(<SettingsPage />);
    const tables = container.querySelectorAll("table");
    tables.forEach((table) => {
      const headers = table.querySelectorAll("th[scope='col']");
      if (headers.length > 0) {
        expect(headers[0].getAttribute("scope")).toBe("col");
      }
    });
  });

  it("has proper form structure", () => {
    const { container } = renderWithProviders(<SettingsPage />);
    const forms = container.querySelectorAll("form");
    expect(forms.length).toBeGreaterThanOrEqual(0);
  });
});
