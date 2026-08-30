import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { Broadcast } from "../../../types";

const mockCreateAnnouncement = vi.fn();
const mockFetchAnnouncements = vi.fn();

vi.mock("../../../store", () => ({
  useMessagingStore: (selector: any) =>
    selector({
      fetchAnnouncements: mockFetchAnnouncements,
      createAnnouncement: mockCreateAnnouncement,
    }),
}));

describe("AnnouncementsPage — Category & Maintenance Schedule Rendering Suite", () => {
  let queryClient: QueryClient;
  const mockToast = vi.fn();
  const mockSetBroadcasts = vi.fn();

  const mockUser = {
    id: "user-1",
    name: "HR Admin User",
    role: "HRAdmin",
    permissions: ["system:announcement:create"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = (broadcasts: Broadcast[]) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AnnouncementsPage
          toast={mockToast}
          broadcasts={broadcasts}
          setBroadcasts={mockSetBroadcasts}
          user={mockUser}
        />
      </QueryClientProvider>,
    );
  };

  it("1. Renders Platform Maintenance category badge and structured schedule box", () => {
    const broadcasts: Broadcast[] = [
      {
        id: "ann-1",
        t: "Planned System Downtime",
        d: "Routine server upgrades and database optimization.",
        type: "Maintenance",
        scheduledFor: "2026-08-30T02:00:00.000Z",
        duration: "2 Hours",
        date: "2026-08-28",
        author: "SuperAdmin",
        read: 15,
      },
    ];

    renderComponent(broadcasts);

    // Verify Title & Author
    expect(screen.getByText("Planned System Downtime")).toBeInTheDocument();
    expect(screen.getByText(/Broadcast by SuperAdmin/i)).toBeInTheDocument();

    // Verify Category Badge
    expect(screen.getByText("Platform Maintenance")).toBeInTheDocument();

    // Verify Scheduled Start and Duration
    expect(screen.getByText("Scheduled Start:")).toBeInTheDocument();
    expect(screen.getByText("Duration:")).toBeInTheDocument();
    expect(screen.getByText("2 Hours")).toBeInTheDocument();

    // Verify Message Body
    expect(
      screen.getByText("Routine server upgrades and database optimization."),
    ).toBeInTheDocument();
  });

  it("2. Renders Security Advisory and Release Updates badges correctly", () => {
    const broadcasts: Broadcast[] = [
      {
        id: "ann-sec",
        t: "Critical Security Patch",
        d: "Please rotate your passwords.",
        type: "Security",
        date: "2026-08-28",
        author: "Security Team",
        read: 40,
      },
      {
        id: "ann-rel",
        t: "Version 2.5 Released",
        d: "Check out the new analytics features.",
        type: "Release",
        date: "2026-08-28",
        author: "Product Team",
        read: 22,
      },
    ];

    renderComponent(broadcasts);

    expect(screen.getByText("Security Advisory")).toBeInTheDocument();
    expect(screen.getByText("Critical Security Patch")).toBeInTheDocument();

    expect(screen.getByText("Release Updates")).toBeInTheDocument();
    expect(screen.getByText("Version 2.5 Released")).toBeInTheDocument();
  });

  it("3. Handles legacy announcements cleanly without empty schedule containers or undefined text", () => {
    const legacyBroadcasts: Broadcast[] = [
      {
        id: "ann-legacy",
        t: "Legacy Company Notice",
        d: "This announcement was created before metadata migration.",
        date: "2025-01-01",
        author: "Old Admin",
        read: 5,
        // Null / undefined metadata
        type: undefined,
        scheduledFor: null,
        duration: null,
      },
    ];

    renderComponent(legacyBroadcasts);

    expect(screen.getByText("Legacy Company Notice")).toBeInTheDocument();
    expect(screen.getByText("General Notice")).toBeInTheDocument();

    // Should NOT render empty Scheduled Start or Duration boxes
    expect(screen.queryByText("Scheduled Start:")).not.toBeInTheDocument();
    expect(screen.queryByText("Duration:")).not.toBeInTheDocument();
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  it("4. Composes and submits announcement with category, schedule, and duration", async () => {
    mockCreateAnnouncement.mockResolvedValueOnce({});

    renderComponent([]);

    // Open composer
    const composeBtn = screen.getByText(/Broadcast Composer/i);
    fireEvent.click(composeBtn);

    expect(screen.getByText("Compose Broadcast Bulletin")).toBeInTheDocument();

    // Select Maintenance from category select
    const categorySelect = screen.getByDisplayValue("General Notice");
    fireEvent.change(categorySelect, { target: { value: "Maintenance" } });

    // Enter title & message
    const titleInput = screen.getByPlaceholderText(/Strategic Plan 2027 Relaunch/i);
    fireEvent.change(titleInput, { target: { value: "Maintenance Window 2026" } });

    const messageInput = screen.getByPlaceholderText(/Please take note of the upcoming updates/i);
    fireEvent.change(messageInput, { target: { value: "Core platform downtime." } });

    // Enter schedule (datetime-local)
    const scheduleInputs = document.querySelectorAll('input[type="datetime-local"]');
    expect(scheduleInputs.length).toBeGreaterThan(0);
    fireEvent.change(scheduleInputs[0], { target: { value: "2026-08-30T02:00" } });

    // Click submit
    const submitBtn = screen.getByText("Broadcast Message");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Maintenance Window 2026",
          content: "Core platform downtime.",
          type: "Maintenance",
          scheduledFor: "2026-08-30T02:00",
          duration: "2 Hours",
        }),
      );
    });
  });
});
