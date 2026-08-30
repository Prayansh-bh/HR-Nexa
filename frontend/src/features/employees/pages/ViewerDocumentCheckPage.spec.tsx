import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ViewerDocumentCheckPage } from './ViewerDocumentCheckPage';
import * as docsQueryHooks from '../../../hooks/useDocumentsQuery';

vi.mock('../../../hooks/useDocumentsQuery', async () => {
  const actual = await vi.importActual<any>('../../../hooks/useDocumentsQuery');
  return {
    ...actual,
    usePendingDocumentsQuery: vi.fn(),
    useVerifyDocumentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRejectDocumentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    downloadDocumentFile: vi.fn(),
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

describe('ViewerDocumentCheckPage — Document Verification Queue Pagination Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Passes default pagination options (page=1, limit=25) to usePendingDocumentsQuery', () => {
    vi.mocked(docsQueryHooks.usePendingDocumentsQuery).mockReturnValue({
      documents: [],
      data: { data: [], total: 0, page: 1, limit: 25, totalPages: 0 },
      total: 0,
      totalPages: 0,
      page: 1,
      limit: 25,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithClient(<ViewerDocumentCheckPage />);

    expect(docsQueryHooks.usePendingDocumentsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 25,
        search: '',
      })
    );
  });

  it('2. Renders pending documents and PaginationControls with total count', () => {
    vi.mocked(docsQueryHooks.usePendingDocumentsQuery).mockReturnValue({
      documents: [
        {
          id: 'doc-verify-1',
          title: 'Aadhaar Card - Jane Doe',
          docType: 'Aadhaar Card',
          fileName: 'aadhaar_jane.pdf',
          size: '1.5MB',
          employee: { name: 'Jane Doe', email: 'jane@example.com' },
        },
      ],
      total: 75,
      totalPages: 3,
      page: 1,
      limit: 25,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithClient(<ViewerDocumentCheckPage />);

    expect(screen.getByText('Aadhaar Card - Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/jane@example.com/i)).toBeInTheDocument();
    expect(screen.getByTestId('pagination-summary')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('3. Navigates to next page on clicking Next', async () => {
    let capturedOptions: any = null;
    vi.mocked(docsQueryHooks.usePendingDocumentsQuery).mockImplementation((opts: any) => {
      capturedOptions = opts;
      return {
        documents: [{ id: 'doc-1', title: 'PAN Card', docType: 'PAN Card' }],
        total: 50,
        totalPages: 2,
        page: opts?.page || 1,
        limit: opts?.limit || 25,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any;
    });

    renderWithClient(<ViewerDocumentCheckPage />);

    const nextBtn = screen.getByLabelText(/Go to next page/i);
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(capturedOptions.page).toBe(2);
    });
  });

  it('4. Debounces search and resets page to 1', async () => {
    let capturedOptions: any = null;
    vi.mocked(docsQueryHooks.usePendingDocumentsQuery).mockImplementation((opts: any) => {
      capturedOptions = opts;
      return {
        documents: [],
        total: 0,
        totalPages: 0,
        page: opts?.page || 1,
        limit: opts?.limit || 25,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any;
    });

    renderWithClient(<ViewerDocumentCheckPage />);

    const searchInput = screen.getByPlaceholderText('Search by employee or document...');
    fireEvent.change(searchInput, { target: { value: 'Passport' } });

    expect(capturedOptions.search).toBe('');

    await waitFor(() => {
      expect(capturedOptions.search).toBe('Passport');
      expect(capturedOptions.page).toBe(1);
    }, { timeout: 1000 });
  });

  it('5. Renders empty queue placeholder when no documents are pending', () => {
    vi.mocked(docsQueryHooks.usePendingDocumentsQuery).mockReturnValue({
      documents: [],
      total: 0,
      totalPages: 0,
      page: 1,
      limit: 25,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderWithClient(<ViewerDocumentCheckPage />);

    expect(screen.getByText('Queue is clear')).toBeInTheDocument();
  });
});
