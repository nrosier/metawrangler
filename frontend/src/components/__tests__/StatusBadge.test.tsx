/**
 * StatusBadge component tests
 * Tests status display and styling
 */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";
import type { JobStatus } from "@/types";

describe("StatusBadge", () => {
  const statuses: JobStatus[] = ["pending", "running", "done", "partial", "failed"];

  it("renders status text for each valid status", () => {
    statuses.forEach((status) => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = screen.getByText(/pending|running|done|partial|failed/i);
      expect(badge).toBeInTheDocument();
      unmount();
    });
  });

  it("applies appropriate CSS classes for status", () => {
    const { container } = render(<StatusBadge status="done" />);
    const badge = container.querySelector(".badge");
    expect(badge).toBeInTheDocument();
  });

  it("renders with ok badge class for done status", () => {
    const { container } = render(<StatusBadge status="done" />);
    const badge = container.querySelector(".badge--ok");
    expect(badge).toBeInTheDocument();
  });

  it("renders with alert badge class for failed status", () => {
    const { container } = render(<StatusBadge status="failed" />);
    const badge = container.querySelector(".badge--alert");
    expect(badge).toBeInTheDocument();
  });
});
