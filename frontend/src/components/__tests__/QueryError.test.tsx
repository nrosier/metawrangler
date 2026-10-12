/**
 * QueryError component tests
 * Tests error display and recovery
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryError } from "../QueryError";

describe("QueryError", () => {
  it("renders error message and retry button", () => {
    const onRetry = vi.fn();
    render(<QueryError error="Failed to load data" onRetry={onRetry} />);

    expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onRetry when retry button clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<QueryError error="Network error" onRetry={onRetry} />);

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("displays error with technical details when available", () => {
    const onRetry = vi.fn();
    const technicalError = "ECONNREFUSED: Connection refused";
    render(
      <QueryError error="Failed to connect" onRetry={onRetry} technical={technicalError} />
    );

    expect(screen.getByText(/failed to connect/i)).toBeInTheDocument();
    expect(screen.getByText(technicalError)).toBeInTheDocument();
  });

  it("renders with accessible retry button", async () => {
    const onRetry = vi.fn();
    const { container } = render(<QueryError error="Error" onRetry={onRetry} />);
    const button = container.querySelector("button");

    expect(button).toHaveAttribute("type", "button");
    expect(button).toBeVisible();
  });
});
