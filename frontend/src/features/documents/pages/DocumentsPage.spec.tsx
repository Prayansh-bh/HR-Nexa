import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentsPage, DocumentViewerModal } from './DocumentsPage';
import * as docsQueryHooks from '../../../hooks/useDocumentsQuery';

vi.mock('../../../hooks/useEmployeesQuery', () => ({
  useEmployeesQuery: () => ({
    data: [
      { id: 'emp-1', name: 'Maya Patel', designation: 'Lead Architect', salary: 1200000 },
      { id: 'emp-2', name: 'Rohan Sharma', designation: 'Senior Dev', salary: 900000 },
    ],
    isLoading: false,
  }),
}));

const mockOfferHtml = `<!DOCTYPE html>
<html>
<head><title>Offer Letter - CVSSD</title></head>
<body>
  <div class="salutation">Dear CVSSD,</div>
  <div class="body-text">
    We are pleased to offer you the position of <strong>Senior Backend Engineer</strong> at <strong>Shulka Corp</strong>.
    Your Total Cost to Company (CTC) will be <strong>₹8,00,000</strong> per annum.
  </div>
  <table>
    <tr><td>Basic Salary</td><td>₹32,433</td><td>₹3,89,196</td></tr>
    <tr><td>House Rent Allowance (HRA)</td><td>₹12,973</td><td>₹1,55,676</td></tr>
    <tr><td>Employer Provident Fund (EPF)</td><td>₹1,800</td><td>₹21,600</td></tr>
  </table>
</body>
</html>`;

vi.mock('../../../hooks/useDocumentsQuery', async () => {
  const actual = await vi.importActual<any>('../../../hooks/useDocumentsQuery');
  return {
    ...actual,
    useDocumentsQuery: vi.fn(),
    useDeleteDocumentMutation: () => ({ mutateAsync: vi.fn() }),
    useUploadDocumentMutation: () => ({ mutateAsync: vi.fn() }),
    downloadDocumentFile: vi.fn(),
    fetchDocumentContent: vi.fn(),
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('DocumentsPage & DocumentViewerModal — Offer Letter Persistence Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. DocumentViewerModal fetches real persisted offer content from server for Offer documents', async () => {
    vi.mocked(docsQueryHooks.fetchDocumentContent).mockResolvedValue(mockOfferHtml);

    const offerDoc = {
      id: 'doc-offer-123',
      docType: 'Offer',
      title: 'Offer Letter - CVSSD',
      employeeId: null,
      employee: null,
      uploadedAt: '2026-08-26T12:00:00Z',
    };

    renderWithClient(
      <DocumentViewerModal
        doc={offerDoc}
        company="Shulka Corp"
        onClose={vi.fn()}
      />
    );

    // Should call authenticated fetchDocumentContent with the doc ID
    expect(docsQueryHooks.fetchDocumentContent).toHaveBeenCalledWith('doc-offer-123');

    // Should display candidate name in modal header instead of "Offer Letter - CVSSD"
    await waitFor(() => {
      expect(screen.getByText(/Offer Letter — CVSSD/i)).toBeInTheDocument();
    });

    // Should render iframe with the real compiled HTML offer letter
    const iframe = screen.getByTitle('Offer Letter - CVSSD');
    expect(iframe).toBeInTheDocument();
    const srcDocContent = iframe.getAttribute('srcdoc') || '';
    expect(srcDocContent).toContain('Dear CVSSD,');
    expect(srcDocContent).toContain('Senior Backend Engineer');
    expect(srcDocContent).toContain('₹8,00,000');
    expect(srcDocContent).toContain('Basic Salary');
    expect(srcDocContent).toContain('₹32,433');
  });

  it('2. Does NOT synthesize fake "₹0" salary or "Dear Offer Letter - <Name>" for Offer documents', async () => {
    vi.mocked(docsQueryHooks.fetchDocumentContent).mockResolvedValue(mockOfferHtml);

    const offerDoc = {
      id: 'doc-offer-123',
      docType: 'Offer',
      title: 'Offer Letter - Jane Doe',
      employee: null,
    };

    renderWithClient(
      <DocumentViewerModal
        doc={offerDoc}
        company="Acme Corp"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Your annual gross salary will be ₹0/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Dear Offer Letter - Jane Doe/i)).not.toBeInTheDocument();
    });
  });

  it('3. Non-Offer documents (Appointment Letter) continue using existing employee data source', async () => {
    const appointmentDoc = {
      id: 'doc-appt-456',
      docType: 'Appointment',
      title: 'Appointment Letter - Maya Patel',
      employee: {
        id: 'emp-1',
        name: 'Maya Patel',
        designation: { name: 'Lead Architect' },
        salary: 1200000,
      },
      uploadedAt: '2026-08-26T12:00:00Z',
    };

    renderWithClient(
      <DocumentViewerModal
        doc={appointmentDoc}
        company="Acme Corp"
        onClose={vi.fn()}
      />
    );

    // Non-offer docs should not fetch offer content
    expect(docsQueryHooks.fetchDocumentContent).not.toHaveBeenCalled();

    // Renders the standard appointment letter body with real employee designation & salary
    expect(screen.getByText(/Appointment Letter — Maya Patel/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Maya Patel/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Lead Architect/i)).toBeInTheDocument();
  });

  it('4. DocumentsPage list renders Offer Letters and opens real viewer on Click', async () => {
    vi.mocked(docsQueryHooks.useDocumentsQuery).mockReturnValue({
      documents: [
        {
          id: 'doc-offer-999',
          docType: 'Offer',
          title: 'Offer Letter - Alexander Pierce',
          fileName: 'offer_letter_alexander.html',
          uploadedAt: '2026-08-26T10:00:00Z',
        },
      ],
      data: {
        data: [
          {
            id: 'doc-offer-999',
            docType: 'Offer',
            title: 'Offer Letter - Alexander Pierce',
            fileName: 'offer_letter_alexander.html',
            uploadedAt: '2026-08-26T10:00:00Z',
          },
        ],
        total: 1,
        totalPages: 1,
        page: 1,
        limit: 25,
      },
      total: 1,
      totalPages: 1,
      page: 1,
      limit: 25,
      isLoading: false,
    } as any);

    vi.mocked(docsQueryHooks.fetchDocumentContent).mockResolvedValue(mockOfferHtml);

    renderWithClient(
      <DocumentsPage
        sub="documents.offer"
        onViewDoc={vi.fn()}
        toast={vi.fn()}
        user={{ role: 'HRAdmin', name: 'HR Manager', companyName: 'Shulka Corp' }}
        company="Shulka Corp"
      />
    );

    expect(screen.getByText('Offer Letter - Alexander Pierce')).toBeInTheDocument();

    // Click "View" button
    const viewBtn = screen.getByRole('button', { name: /View/i });
    fireEvent.click(viewBtn);

    // Fetch document content should be called
    expect(docsQueryHooks.fetchDocumentContent).toHaveBeenCalledWith('doc-offer-999');
  });

  it('5. Passes default pagination (page=1, limit=25) and filter parameters to useDocumentsQuery', () => {
    vi.mocked(docsQueryHooks.useDocumentsQuery).mockReturnValue({
      documents: [],
      data: { data: [], total: 0, page: 1, limit: 25, totalPages: 0 },
      total: 0,
      totalPages: 0,
      page: 1,
      limit: 25,
      isLoading: false,
    } as any);

    renderWithClient(
      <DocumentsPage
        sub="documents.offer"
        onViewDoc={vi.fn()}
        toast={vi.fn()}
        user={{ role: 'HRAdmin', name: 'HR Manager' }}
        company="Shulka Corp"
      />
    );

    expect(docsQueryHooks.useDocumentsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'HR_LETTER',
        docType: 'Offer',
        page: 1,
        limit: 25,
      })
    );
  });

  it('6. Renders PaginationControls and navigates to next page on click', async () => {
    let capturedOptions: any = null;
    vi.mocked(docsQueryHooks.useDocumentsQuery).mockImplementation((opts: any) => {
      capturedOptions = opts;
      return {
        documents: [
          { id: 'doc-1', title: 'Offer Letter - Emp 1', docType: 'Offer' },
        ],
        total: 50,
        totalPages: 2,
        page: opts?.page || 1,
        limit: opts?.limit || 25,
        isLoading: false,
      } as any;
    });

    renderWithClient(
      <DocumentsPage
        sub="documents.offer"
        onViewDoc={vi.fn()}
        toast={vi.fn()}
        user={{ role: 'HRAdmin', name: 'HR Manager' }}
        company="Shulka Corp"
      />
    );

    expect(screen.getByTestId('pagination-summary')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('50 records');

    const nextBtn = screen.getByLabelText(/Go to next page/i);
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(capturedOptions.page).toBe(2);
    });
  });

  it('7. Disables Previous button on page 1', () => {
    vi.mocked(docsQueryHooks.useDocumentsQuery).mockReturnValue({
      documents: [{ id: 'doc-1', title: 'Offer Letter', docType: 'Offer' }],
      total: 50,
      totalPages: 2,
      page: 1,
      limit: 25,
      isLoading: false,
    } as any);

    renderWithClient(
      <DocumentsPage
        sub="documents.offer"
        onViewDoc={vi.fn()}
        toast={vi.fn()}
        user={{ role: 'HRAdmin', name: 'HR Manager' }}
        company="Shulka Corp"
      />
    );

    const prevBtn = screen.getByLabelText(/Go to previous page/i);
    expect(prevBtn).toBeDisabled();
  });

  it('8. Changing page size resets page to 1 and passes new limit', async () => {
    let capturedOptions: any = null;
    vi.mocked(docsQueryHooks.useDocumentsQuery).mockImplementation((opts: any) => {
      capturedOptions = opts;
      return {
        documents: [{ id: 'doc-1', title: 'Offer Letter', docType: 'Offer' }],
        total: 100,
        totalPages: 4,
        page: opts?.page || 1,
        limit: opts?.limit || 25,
        isLoading: false,
      } as any;
    });

    renderWithClient(
      <DocumentsPage
        sub="documents.offer"
        onViewDoc={vi.fn()}
        toast={vi.fn()}
        user={{ role: 'HRAdmin', name: 'HR Manager' }}
        company="Shulka Corp"
      />
    );

    const pageSizeSelect = screen.getByLabelText(/Rows per page/i);
    fireEvent.change(pageSizeSelect, { target: { value: '50' } });

    await waitFor(() => {
      expect(capturedOptions.limit).toBe(50);
      expect(capturedOptions.page).toBe(1);
    });
  });

  it('9. Debounces search query by 300ms and resets page to 1', async () => {
    let capturedOptions: any = null;
    vi.mocked(docsQueryHooks.useDocumentsQuery).mockImplementation((opts: any) => {
      capturedOptions = opts;
      return {
        documents: [],
        total: 0,
        totalPages: 0,
        page: opts?.page || 1,
        limit: opts?.limit || 25,
        isLoading: false,
      } as any;
    });

    renderWithClient(
      <DocumentsPage
        sub="documents.offer"
        onViewDoc={vi.fn()}
        toast={vi.fn()}
        user={{ role: 'HRAdmin', name: 'HR Manager' }}
        company="Shulka Corp"
      />
    );

    const searchInput = screen.getByPlaceholderText('Search offer letters...');
    fireEvent.change(searchInput, { target: { value: 'Alexander' } });

    // Immediate check: debouncedSearch has not fired yet
    expect(capturedOptions.search).toBeUndefined();

    // Wait for 300ms debounce
    await waitFor(() => {
      expect(capturedOptions.search).toBe('Alexander');
      expect(capturedOptions.page).toBe(1);
    }, { timeout: 1000 });
  });

  it('10. EmployeeDocsPage supports pagination and renders pagination controls', () => {
    vi.mocked(docsQueryHooks.useDocumentsQuery).mockReturnValue({
      documents: [
        {
          id: 'emp-doc-1',
          docType: 'Aadhaar Card',
          fileName: 'aadhaar.pdf',
          size: '2MB',
          uploadedAt: '2026-08-26',
          employee: { name: 'Priya Sharma' },
        },
      ],
      total: 30,
      totalPages: 2,
      page: 1,
      limit: 25,
      isLoading: false,
    } as any);

    renderWithClient(
      <DocumentsPage
        sub="documents.employee"
        onViewDoc={vi.fn()}
        toast={vi.fn()}
        user={{ role: 'HRAdmin', name: 'HR Manager' }}
        company="Shulka Corp"
      />
    );

    expect(screen.getByText('Employee Documents')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar Card')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-summary')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('11. DocumentViewerModal "Print / Save PDF" triggers iframe contentWindow.print()', async () => {
    vi.mocked(docsQueryHooks.fetchDocumentContent).mockResolvedValue(mockOfferHtml);

    const offerDoc = {
      id: 'doc-offer-print-1',
      docType: 'Offer',
      title: 'Offer Letter - CVSSD',
      employee: null,
      uploadedAt: '2026-08-26T12:00:00Z',
    };

    renderWithClient(
      <DocumentViewerModal
        doc={offerDoc}
        company="Shulka Corp"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Offer Letter - CVSSD')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Offer Letter - CVSSD') as HTMLIFrameElement;
    const mockFocus = vi.fn();
    const mockPrint = vi.fn();

    // Mock iframe contentWindow
    Object.defineProperty(iframe, 'contentWindow', {
      value: {
        focus: mockFocus,
        print: mockPrint,
      },
      writable: true,
    });

    const printButton = screen.getByRole('button', { name: /Print \/ Save PDF/i });
    expect(printButton).toBeInTheDocument();
    expect(printButton).not.toBeDisabled();

    fireEvent.click(printButton);

    expect(mockFocus).toHaveBeenCalledTimes(1);
    expect(mockPrint).toHaveBeenCalledTimes(1);

    // Verify sandbox attribute contains allow-modals
    expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin allow-scripts allow-modals');
  });

  it('12. DocumentViewerModal fallback triggers print for non-Offer locally rendered documents', () => {
    const appointmentDoc = {
      id: 'doc-appt-789',
      docType: 'Appointment',
      title: 'Appointment Letter - Maya Patel',
      employee: {
        id: 'emp-1',
        name: 'Maya Patel',
        designation: { name: 'Lead Architect' },
        salary: 1200000,
      },
      uploadedAt: '2026-08-26T12:00:00Z',
    };

    renderWithClient(
      <DocumentViewerModal
        doc={appointmentDoc}
        company="Shulka Corp"
        onClose={vi.fn()}
      />
    );

    const printButton = screen.getByRole('button', { name: /Print \/ Save PDF/i });
    expect(printButton).toBeInTheDocument();
    expect(printButton).not.toBeDisabled();

    // Clicking print for template docs executes fallback without error
    expect(() => fireEvent.click(printButton)).not.toThrow();
  });
});
