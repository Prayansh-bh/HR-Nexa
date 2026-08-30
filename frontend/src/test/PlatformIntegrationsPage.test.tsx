import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlatformIntegrationsPage } from "../../../owner/src/features/settings/pages/PlatformIntegrationsPage";
import {
  platformIntegrationsService,
  IntegrationProvider,
  IntegrationStatus,
} from "../../../owner/src/services/integrations.service";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../../owner/src/services/integrations.service", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    platformIntegrationsService: {
      listCredentials: vi.fn(),
      getCredential: vi.fn(),
      createCredential: vi.fn(),
      updateCredential: vi.fn(),
      setStatus: vi.fn(),
      deleteCredential: vi.fn(),
    },
  };
});

describe("PlatformIntegrationsPage Owner UI Security & Scope (Phase 6)", () => {
  let queryClient: QueryClient;

  const mockPlatformRazorpay = {
    id: 'ic_plat_rzp_123',
    provider: IntegrationProvider.RAZORPAY,
    name: 'Platform Razorpay',
    enabled: true,
    companyId: null, // Platform Scope!
    status: IntegrationStatus.CONNECTED,
    config: { keyId: 'rzp_live_plat999' },
    maskedSecrets: { keySecret: '••••••••', webhookSecret: '••••••••' },
    lastTestedAt: null,
    lastError: null,
    createdById: 'superadmin_1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PlatformIntegrationsPage />
      </QueryClientProvider>,
    );

  it('1. Renders Platform Integrations header and cards with companyId = null verification', async () => {
    vi.mocked(platformIntegrationsService.listCredentials).mockResolvedValue([mockPlatformRazorpay]);
    renderComponent();

    expect(await screen.findByText('Platform Integrations')).toBeInTheDocument();
    expect(await screen.findByText('SuperAdmin Platform Authority')).toBeInTheDocument();
    expect(await screen.findByText('rzp_live_plat999')).toBeInTheDocument();
  });

  it('2. GET response NEVER populates secret fields in edit modal', async () => {
    vi.mocked(platformIntegrationsService.listCredentials).mockResolvedValue([mockPlatformRazorpay]);
    renderComponent();

    const editButtons = await screen.findAllByText('Configure');
    fireEvent.click(editButtons[0]);

    const secretInputs = screen.getAllByPlaceholderText('Leave blank to keep existing platform secret');
    expect(secretInputs.length).toBeGreaterThan(0);
    expect((secretInputs[0] as HTMLInputElement).value).toBe('');
    expect((secretInputs[1] as HTMLInputElement).value).toBe('');
  });

  it('3. Blank secret is omitted from update payload and companyId is NEVER included', async () => {
    vi.mocked(platformIntegrationsService.listCredentials).mockResolvedValue([mockPlatformRazorpay]);
    vi.mocked(platformIntegrationsService.updateCredential).mockResolvedValue(mockPlatformRazorpay);
    renderComponent();

    const editButtons = await screen.findAllByText('Configure');
    fireEvent.click(editButtons[0]);

    const saveButton = screen.getByText('Save Platform Integration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(platformIntegrationsService.updateCredential).toHaveBeenCalledWith('ic_plat_rzp_123', {
        name: 'Platform Razorpay',
        config: { keyId: 'rzp_live_plat999' },
      });
    });

    const callPayload = vi.mocked(platformIntegrationsService.updateCredential).mock.calls[0][1];
    expect(callPayload.secrets).toBeUndefined();
    expect((callPayload as any).companyId).toBeUndefined();
  });

  it('4. Enable/Disable toggle triggers platform setStatus API call', async () => {
    vi.mocked(platformIntegrationsService.listCredentials).mockResolvedValue([mockPlatformRazorpay]);
    vi.mocked(platformIntegrationsService.setStatus).mockResolvedValue({ ...mockPlatformRazorpay, enabled: false });
    renderComponent();

    const disableButton = await screen.findByText('Disable');
    fireEvent.click(disableButton);

    await waitFor(() => {
      expect(platformIntegrationsService.setStatus).toHaveBeenCalledWith('ic_plat_rzp_123', false);
    });
  });

  it('5. Delete confirmation modal triggers platform delete API call', async () => {
    vi.mocked(platformIntegrationsService.listCredentials).mockResolvedValue([mockPlatformRazorpay]);
    vi.mocked(platformIntegrationsService.deleteCredential).mockResolvedValue({ success: true, message: 'Deleted' });
    renderComponent();

    const deleteButtons = await screen.findAllByRole('button');
    const trashBtn = deleteButtons.find((btn) => btn.querySelector('.lucide-trash-2'));
    if (trashBtn) fireEvent.click(trashBtn);

    const confirmDeleteBtn = await screen.findByText('Confirm Delete');
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(platformIntegrationsService.deleteCredential).toHaveBeenCalledWith('ic_plat_rzp_123');
    });
  });
});
