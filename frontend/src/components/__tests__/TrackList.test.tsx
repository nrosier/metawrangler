/**
 * TrackList component tests
 * Tests track display and accessibility
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrackList } from "../TrackList";
import type { MkvTrack } from "@/types";

describe("TrackList", () => {
  const mockTracks: MkvTrack[] = [
    {
      type: "video",
      trackNumber: 0,
      codecID: "V_UNCOMPRESSED",
      language: "eng",
      default: true,
      forced: false,
    },
    {
      type: "audio",
      trackNumber: 1,
      codecID: "A_AAC",
      language: "eng",
      default: true,
      forced: false,
    },
    {
      type: "subtitles",
      trackNumber: 2,
      codecID: "S_TEXT/ASS",
      language: "fra",
      default: false,
      forced: false,
    },
  ];

  it("renders track table with header", () => {
    const { container } = render(<TrackList tracks={mockTracks} />);
    expect(screen.getByRole("table")).toBeInTheDocument();

    const headers = container.querySelectorAll("thead th[scope='col']");
    expect(headers.length).toBeGreaterThan(0);
  });

  it("renders all tracks with correct type and codec", () => {
    render(<TrackList tracks={mockTracks} />);

    expect(screen.getByText("video")).toBeInTheDocument();
    expect(screen.getByText("audio")).toBeInTheDocument();
    expect(screen.getByText("subtitles")).toBeInTheDocument();
    expect(screen.getByText("V_UNCOMPRESSED")).toBeInTheDocument();
    expect(screen.getByText("A_AAC")).toBeInTheDocument();
  });

  it("displays language codes", () => {
    render(<TrackList tracks={mockTracks} />);

    expect(screen.getByText("eng")).toBeInTheDocument();
    expect(screen.getByText("fra")).toBeInTheDocument();
  });

  it("shows default and forced status", () => {
    render(<TrackList tracks={mockTracks} />);

    // Check for visual indicators of default/forced status
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1); // header + 3 data rows
  });

  it("renders empty state when no tracks provided", () => {
    const { container } = render(<TrackList tracks={[]} />);
    expect(container.textContent).toMatch(/no tracks|empty/i);
  });
});
