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
    const error = new Error("Failed to load data");
    render(<QueryError error={error} onRetry={onRetry} />);

    expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls onRetry when retry button clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    const error = new Error("Network error");
    render(<QueryError error={error} onRetry={onRetry} />);

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("displays error message from Error object", () => {
    const onRetry = vi.fn();
    const error = new Error("ECONNREFUSED: Connection refused");
    render(<QueryError error={error} onRetry={onRetry} />);

    expect(screen.getByText(/ECONNREFUSED/i)).toBeInTheDocument();
  });

  it("renders with accessible retry button", async () => {
    const onRetry = vi.fn();
    const { container } = render(<QueryError error={new Error("Error")} onRetry={onRetry} />);
    const button = container.querySelector("button");

    expect(button).toBeTruthy();
    expect(button?.tagName).toBe("BUTTON");
    expect(button).toBeVisible();
  });
});
