import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmployeeTaxDeclPage } from './EmployeeTaxDeclPage';
import * as taxQueryModule from '../../../hooks/useTaxDeclarationsQuery';
import * as fiscalQueryModule from '../../../hooks/useFiscalYearsQuery';
import * as authPermissionModule from '../../../auth/useHasPermission';

vi.mock('../../../hooks/useTaxDeclarationsQuery', () => ({
  useMyTaxDeclarationQuery: vi.fn(),
  useTaxDeclarationMutations: vi.fn(),
}));

vi.mock('../../../hooks/useFiscalYearsQuery', () => ({
  useFiscalYearsQuery: vi.fn(),
}));

vi.mock('../../../auth/useHasPermission', () => ({
  useHasPermission: vi.fn(),
}));

describe('EmployeeTaxDeclPage - Frontend Integration Specs', () => {
  const mockToast = vi.fn();
  const mockCreateMyDeclaration = { mutateAsync: vi.fn() };
  const mockUpdateMyDeclaration = { mutateAsync: vi.fn() };
  const mockSubmitMyDeclaration = { mutateAsync: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(fiscalQueryModule.useFiscalYearsQuery).mockReturnValue({
      data: [{ id: 'fy-2026', name: 'FY 2026-27', status: 'ACTIVE' }],
    } as any);

    vi.mocked(taxQueryModule.useTaxDeclarationMutations).mockReturnValue({
      createMyDeclaration: mockCreateMyDeclaration,
      updateMyDeclaration: mockUpdateMyDeclaration,
      submitMyDeclaration: mockSubmitMyDeclaration,
      auditDeclaration: { mutateAsync: vi.fn() },
    } as any);
  });

  it('Renders tax declaration page correctly when employee has TAX_DECLARATIONS_VIEW', async () => {
    vi.mocked(authPermissionModule.useHasPermission).mockReturnValue(true);
    vi.mocked(taxQueryModule.useMyTaxDeclarationQuery).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    render(<EmployeeTaxDeclPage toast={mockToast} />);

    // Verify page header
    expect(screen.getByText('My Tax Declaration')).toBeInTheDocument();
    expect(screen.getByText('Old Tax Regime')).toBeInTheDocument();
    expect(screen.getByText('New Tax Regime (Default)')).toBeInTheDocument();
  });

  it('Displays draft investment items if they exist', async () => {
    vi.mocked(authPermissionModule.useHasPermission).mockReturnValue(true);
    vi.mocked(taxQueryModule.useMyTaxDeclarationQuery).mockReturnValue({
      data: {
        id: 'decl-1',
        regime: 'OLD',
        status: 'DRAFT',
        items: [
          { id: 'item-1', section: '80C', category: 'LIC Premium', declaredAmount: 50000, remarks: '' },
        ],
      },
      isLoading: false,
      isError: false,
    } as any);

    render(<EmployeeTaxDeclPage toast={mockToast} />);

    expect(screen.getByText('Itemized Investment Deductions')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. PPF / LIC Policy')).toHaveValue('LIC Premium');
  });

  it('Disables editing when status is SUBMITTED', async () => {
    vi.mocked(authPermissionModule.useHasPermission).mockReturnValue(true);
    vi.mocked(taxQueryModule.useMyTaxDeclarationQuery).mockReturnValue({
      data: {
        id: 'decl-1',
        regime: 'OLD',
        status: 'SUBMITTED',
        items: [
          { id: 'item-1', section: '80C', category: 'LIC Premium', declaredAmount: 50000, remarks: '' },
        ],
      },
      isLoading: false,
      isError: false,
    } as any);

    render(<EmployeeTaxDeclPage toast={mockToast} />);

    // Inputs should be read-only / disabled
    expect(screen.getByPlaceholderText('e.g. PPF / LIC Policy')).toBeDisabled();
    expect(screen.queryByText('Save Draft')).not.toBeInTheDocument();
  });
});
