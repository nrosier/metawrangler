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
      id: 0,
      type: "video",
      codecId: "V_UNCOMPRESSED",
      language: "eng",
      languageIETF: "en",
      name: null,
      flagDefault: true,
      flagForced: false,
      flagEnabled: true,
    },
    {
      id: 1,
      type: "audio",
      codecId: "A_AAC",
      language: "eng",
      languageIETF: "en",
      name: null,
      channels: 2,
      flagDefault: true,
      flagForced: false,
      flagEnabled: true,
    },
    {
      id: 2,
      type: "subtitles",
      codecId: "S_TEXT/ASS",
      language: "fra",
      languageIETF: "fr",
      name: null,
      flagDefault: false,
      flagForced: false,
      flagEnabled: true,
    },
  ];

  it("renders track list container", () => {
    const { container } = render(<TrackList tracks={mockTracks} />);
    expect(container.querySelector(".track-list")).toBeInTheDocument();
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
    const { container } = render(<TrackList tracks={mockTracks} />);

    const content = container.textContent;
    // Language codes displayed from languageIETF field (en, fr)
    expect(content).toMatch(/en|fr/);
  });

  it("shows default and forced status", () => {
    render(<TrackList tracks={mockTracks} />);

    // Check for badges indicating default/forced status
    const defaultBadges = screen.queryAllByText("default");
    // First track has flagDefault: true, so "default" badge should exist
    expect(defaultBadges.length).toBeGreaterThan(0);
  });

  it("renders track rows for each track", () => {
    const { container } = render(<TrackList tracks={mockTracks} />);
    const rows = container.querySelectorAll(".track-row");
    expect(rows.length).toBe(3);
  });

  it("renders empty state when no tracks provided", () => {
    const { container } = render(<TrackList tracks={[]} />);
    expect(container.textContent).toMatch(/no tracks|empty/i);
  });
});
