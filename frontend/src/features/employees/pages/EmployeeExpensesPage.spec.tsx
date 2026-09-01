import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmployeeExpensesPage } from './EmployeeExpensesPage';
import * as reimbursementQueryModule from '../../../hooks/useReimbursementsQuery';
import * as fiscalQueryModule from '../../../hooks/useFiscalYearsQuery';
import * as documentsQueryModule from '../../../hooks/useDocumentsQuery';
import * as authPermissionModule from '../../../auth/useHasPermission';
import { useAuthStore } from '../../../store/authStore';

vi.mock('../../../hooks/useReimbursementsQuery', () => ({
  useMyExpenseClaimsQuery: vi.fn(),
  useExpenseCategoriesQuery: vi.fn(),
  useExpenseClaimMutations: vi.fn(),
}));

vi.mock('../../../hooks/useFiscalYearsQuery', () => ({
  useFiscalYearsQuery: vi.fn(),
}));

vi.mock('../../../hooks/useDocumentsQuery', () => ({
  useUploadDocumentMutation: vi.fn(),
  downloadDocumentFile: vi.fn(),
}));

vi.mock('../../../auth/useHasPermission', () => ({
  useHasPermission: vi.fn(),
}));

describe('EmployeeExpensesPage - Receipt Attachment & P0 Reimbursement Workflow Specs', () => {
  const mockToast = vi.fn();
  const mockCreateMyClaim = { mutateAsync: vi.fn() };
  const mockSubmitMyClaim = { mutateAsync: vi.fn() };
  const mockUploadDocument = vi.fn();

  const mockCategories = [
    {
      id: 'cat-travel',
      name: 'Travel & Conveyance',
      code: 'TRAVEL',
      maxLimit: 5000,
      requireReceipt: true,
      isActive: true,
    },
    {
      id: 'cat-meals',
      name: 'Client Meals',
      code: 'MEALS',
      maxLimit: 1500,
      requireReceipt: false,
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();

    useAuthStore.setState({
      user: {
        id: 'usr-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'Employee',
        companyId: 'comp-1',
        employee: { id: 'emp-1', firstName: 'John', lastName: 'Doe' },
      } as any,
    });

    vi.mocked(fiscalQueryModule.useFiscalYearsQuery).mockReturnValue({
      data: [{ id: 'fy-2026', name: 'FY 2026-27', status: 'ACTIVE' }],
    } as any);

    vi.mocked(authPermissionModule.useHasPermission).mockReturnValue(true);

    vi.mocked(reimbursementQueryModule.useExpenseCategoriesQuery).mockReturnValue({
      data: mockCategories,
    } as any);

    vi.mocked(reimbursementQueryModule.useMyExpenseClaimsQuery).mockReturnValue({
      data: [],
      claims: [],
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(reimbursementQueryModule.useExpenseClaimMutations).mockReturnValue({
      createMyClaim: mockCreateMyClaim,
      submitMyClaim: mockSubmitMyClaim,
      reviewClaim: { mutateAsync: vi.fn() },
      payClaim: { mutateAsync: vi.fn() },
    } as any);

    vi.mocked(documentsQueryModule.useUploadDocumentMutation).mockReturnValue({
      mutateAsync: mockUploadDocument,
    } as any);
  });

  it('1. Renders Reimbursements & Claims page and opens new claim modal with receipt controls', async () => {
    render(<EmployeeExpensesPage toast={mockToast} />);

    expect(screen.getByText('Reimbursements & Claims')).toBeInTheDocument();
    expect(screen.getByText('File New Claim')).toBeInTheDocument();

    fireEvent.click(screen.getByText('File New Claim'));

    expect(screen.getByText('File Reimbursement Claim')).toBeInTheDocument();
    expect(screen.getByText('Attach Receipt')).toBeInTheDocument();
    expect(screen.getByText('Receipt Document:')).toBeInTheDocument();
  });

  it('2. Shows Required badge when a receipt-mandatory category is selected', async () => {
    render(<EmployeeExpensesPage toast={mockToast} />);
    fireEvent.click(screen.getByText('File New Claim'));

    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'cat-travel' } });

    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('3. Successfully attaches a receipt file and displays attached file badge', async () => {
    mockUploadDocument.mockResolvedValueOnce({
      id: 'doc-uploaded-123',
      fileName: 'cab_fare_receipt.pdf',
    });

    render(<EmployeeExpensesPage toast={mockToast} />);
    fireEvent.click(screen.getByText('File New Claim'));

    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'cat-travel' } });

    const file = new File(['dummy receipt content'], 'cab_fare_receipt.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUploadDocument).toHaveBeenCalledTimes(1);
      expect(screen.getByText('cab_fare_receipt.pdf')).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith('Receipt "cab_fare_receipt.pdf" uploaded successfully!');
    });
  });

  it('4. Submits claim with receiptDocumentId included in the payload', async () => {
    mockUploadDocument.mockResolvedValueOnce({
      id: 'doc-uploaded-123',
      fileName: 'cab_fare_receipt.pdf',
    });

    mockCreateMyClaim.mutateAsync.mockResolvedValueOnce({
      id: 'claim-123',
      claimNumber: 'CLM-202607-000001',
    });

    render(<EmployeeExpensesPage toast={mockToast} />);
    fireEvent.click(screen.getByText('File New Claim'));

    // Fill Title
    const titleInput = screen.getByPlaceholderText('e.g. Mumbai Onsite Client Visit Expenses');
    fireEvent.change(titleInput, { target: { value: 'Client Visit Transport' } });

    // Select Category
    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'cat-travel' } });

    // Set Amount
    const amountInputs = document.querySelectorAll('input[type="number"]');
    fireEvent.change(amountInputs[0], { target: { value: '1450' } });

    // Upload receipt
    const file = new File(['dummy pdf'], 'cab_fare_receipt.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('cab_fare_receipt.pdf')).toBeInTheDocument();
    });

    // Click Save & Submit
    const submitBtn = screen.getByText('Save & Submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateMyClaim.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          fiscalYearId: 'fy-2026',
          title: 'Client Visit Transport',
          items: expect.arrayContaining([
            expect.objectContaining({
              categoryId: 'cat-travel',
              amount: 1450,
              receiptDocumentId: 'doc-uploaded-123',
            }),
          ]),
        }),
      );
      expect(mockSubmitMyClaim.mutateAsync).toHaveBeenCalledWith('claim-123');
    });
  });

  it('5. Rejects client submission if receipt-required category has no attached receipt', async () => {
    render(<EmployeeExpensesPage toast={mockToast} />);
    fireEvent.click(screen.getByText('File New Claim'));

    const titleInput = screen.getByPlaceholderText('e.g. Mumbai Onsite Client Visit Expenses');
    fireEvent.change(titleInput, { target: { value: 'Client Visit Transport' } });

    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'cat-travel' } });

    const amountInputs = document.querySelectorAll('input[type="number"]');
    fireEvent.change(amountInputs[0], { target: { value: '1450' } });

    // Click Save Draft without uploading receipt
    const saveDraftBtn = screen.getByText('Save Draft');
    fireEvent.click(saveDraftBtn);

    expect(mockCreateMyClaim.mutateAsync).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining('Receipt document is required for category "Travel & Conveyance"'),
    );
  });

  it('6. Rejects files larger than 10MB or invalid formats', async () => {
    render(<EmployeeExpensesPage toast={mockToast} />);
    fireEvent.click(screen.getByText('File New Claim'));

    // Oversized file (11MB)
    const oversizedFile = new File([''], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 11 * 1024 * 1024 });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    expect(mockUploadDocument).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Receipt file size cannot exceed 10MB');

    // Disallowed file extension (.exe)
    const invalidExtFile = new File(['content'], 'virus.exe', { type: 'application/x-msdownload' });
    fireEvent.change(fileInput, { target: { files: [invalidExtFile] } });

    expect(mockUploadDocument).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      'Invalid file type. Allowed formats: PDF, JPG, PNG, WEBP, DOCX',
    );
  });
});
