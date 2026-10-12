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
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("displays form labels paired with inputs", () => {
    renderWithProviders(<SettingsPage />);
    const inputs = screen.queryAllByRole("textbox");
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement) {
        // If input has id, should be associated with a label
        if (input.id) {
          const label = screen.queryByLabelText(
            new RegExp(input.placeholder || input.id, "i")
          );
          // Label should exist or input should have aria-label
          expect(label || input.hasAttribute("aria-label")).toBeTruthy();
        }
      }
    });
  });

  it("shows mount list section", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText(/mounts?/i)).toBeInTheDocument();
  });

  it("provides add mount form with labeled fields", () => {
    renderWithProviders(<SettingsPage />);
    expect(
      screen.getByRole("heading", { name: /add mount|new mount/i })
    ).toBeInTheDocument();
  });

  it("renders form buttons with descriptive text", () => {
    renderWithProviders(<SettingsPage />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn.textContent).toMatch(/submit|add|save|cancel|delete/i);
    });
  });

  it("displays mount list table with scope", () => {
    renderWithProviders(<SettingsPage />);
    const tables = screen.queryAllByRole("table");
    if (tables.length > 0) {
      tables.forEach((table) => {
        const headers = table.querySelectorAll("th[scope='col']");
        expect(headers.length).toBeGreaterThan(0);
      });
    }
  });
});
