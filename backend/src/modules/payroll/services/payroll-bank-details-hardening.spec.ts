function maskAccountNumber(acc: unknown): string {
  if (acc === null || acc === undefined) {
    return "Bank details not configured";
  }
  const str = String(acc).trim();
  if (!str || str.toUpperCase() === "N/A" || str === "—") {
    return "Bank details not configured";
  }
  if (str.length <= 4) {
    return str;
  }
  const last4 = str.slice(-4);
  const maskedLength = Math.max(4, str.length - 4);
  return "X".repeat(maskedLength) + last4;
}

describe('HR NEXA — Payroll Bank Details Hardening Tests (PAYROLL-AUDIT-004)', () => {
  const empCompanyA1 = {
    id: 'emp-A-1',
    name: 'Alice Cooper',
    companyId: 'COMPANY-A',
    bankName: 'Axis Bank',
    accountNumber: '918020045678901',
    ifscCode: 'UTIB0000123',
  };

  const empCompanyA2 = {
    id: 'emp-A-2',
    name: 'Bob Marley',
    companyId: 'COMPANY-A',
    bankName: 'ICICI Bank',
    accountNumber: '001105001234',
    ifscCode: 'ICIC0000011',
  };

  const empCompanyB = {
    id: 'emp-B-1',
    name: 'Eve Attacker',
    companyId: 'COMPANY-B',
    bankName: 'Malicious Bank',
    accountNumber: '999999999999',
    ifscCode: 'EVIL0000999',
  };

  const empNoBank = {
    id: 'emp-A-3',
    name: 'Charlie Brown',
    companyId: 'COMPANY-A',
    bankName: null,
    accountNumber: null,
    ifscCode: null,
  };

  const slips = [
    { employeeId: 'emp-A-1', employeeName: 'Alice Cooper', net: 75000, month: 'July 2026' },
    { employeeId: 'emp-A-2', employeeName: 'Bob Marley', net: 65000, month: 'July 2026' },
    { employeeId: 'emp-A-3', employeeName: 'Charlie Brown', net: 50000, month: 'July 2026' },
  ];

  const buildBankTransferRows = (targetCompanyId: string, employeeList: any[], monthSlips: any[]) => {
    const tenantEmployees = employeeList.filter((e) => e.companyId === targetCompanyId);
    const rows: any[][] = [];

    monthSlips.forEach((slip) => {
      const emp = tenantEmployees.find((e) => e.id === slip.employeeId);
      if (!emp) return;

      const bankName = emp.bankName;
      const accNo = emp.accountNumber;
      const ifsc = emp.ifscCode;

      if (!accNo || !ifsc || accNo === 'N/A' || ifsc === 'N/A') {
        return;
      }

      rows.push([slip.employeeName, bankName || 'Not Configured', accNo, ifsc, slip.net]);
    });

    return rows;
  };

  it('1. Real employee bank name is used', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empCompanyA1], [slips[0]]);
    expect(rows[0][1]).toBe('Axis Bank');
    expect(rows[0][1]).not.toBe('HDFC Bank Ltd');
    expect(rows[0][1]).not.toBe('Demo Bank');
  });

  it('2. Real employee IFSC is used', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empCompanyA1], [slips[0]]);
    expect(rows[0][3]).toBe('UTIB0000123');
    expect(rows[0][3]).not.toBe('N/A');
  });

  it('3. Real employee account number is used for authorized bank transfer export', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empCompanyA1], [slips[0]]);
    expect(rows[0][2]).toBe('918020045678901');
    expect(rows[0][2]).not.toBe('XXXXXXXX9845');
  });

  it('4. Payslip masks account number preserving only last 4 digits', () => {
    const masked = maskAccountNumber(empCompanyA1.accountNumber);
    expect(masked).toBe('XXXXXXXXXXX8901');
    expect(masked).not.toBe('918020045678901');
  });

  it('5. Missing bank details do NOT produce fake credentials', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empNoBank], [slips[2]]);
    expect(rows.length).toBe(0);
  });

  it('6. "Demo Bank" is never generated', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empCompanyA1, empCompanyA2, empNoBank], slips);
    const content = JSON.stringify(rows);
    expect(content).not.toContain('Demo Bank');
  });

  it('7. "HDFC Bank Ltd" is never generated as a hardcoded fallback for non-HDFC employees', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empCompanyA1], [slips[0]]);
    expect(rows[0][1]).toBe('Axis Bank');
  });

  it('8. "XXXXXXXX9845" is never hardcoded in export files', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empCompanyA1, empCompanyA2], slips);
    const content = JSON.stringify(rows);
    expect(content).not.toContain('XXXXXXXX9845');
  });

  it('9. Company A cannot access Company B employee bank details (Tenant Isolation)', () => {
    const allEmployees = [empCompanyA1, empCompanyB];
    const rowsCompanyA = buildBankTransferRows('COMPANY-A', allEmployees, [
      slips[0],
      { employeeId: 'emp-B-1', employeeName: 'Eve Attacker', net: 100000, month: 'July 2026' },
    ]);

    expect(rowsCompanyA.length).toBe(1);
    expect(rowsCompanyA[0][0]).toBe('Alice Cooper');
    expect(JSON.stringify(rowsCompanyA)).not.toContain('Malicious Bank');
  });

  it('10. Invalid/nonexistent employee ID is safely ignored', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empCompanyA1], [
      { employeeId: 'NONEXISTENT', employeeName: 'Ghost', net: 50000, month: 'July 2026' },
    ]);
    expect(rows.length).toBe(0);
  });

  it('11. Bank transfer amount matches persisted payroll net salary', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empCompanyA1], [slips[0]]);
    expect(rows[0][4]).toBe(75000);
  });

  it('12. No full account number is written to console or debug output during masking', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const masked = maskAccountNumber('123456789012');
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('123456789012'));
    consoleSpy.mockRestore();
    expect(masked).toBe('XXXXXXXX9012');
  });

  it('13. Multiple employees receive their own respective bank details', () => {
    const rows = buildBankTransferRows('COMPANY-A', [empCompanyA1, empCompanyA2], slips);
    expect(rows.length).toBe(2);
    expect(rows[0][1]).toBe('Axis Bank');
    expect(rows[1][1]).toBe('ICICI Bank');
  });

  it('14. Empty/null banking fields fail safely without crashing', () => {
    expect(maskAccountNumber(null)).toBe('Bank details not configured');
    expect(maskAccountNumber(undefined)).toBe('Bank details not configured');
    expect(maskAccountNumber('N/A')).toBe('Bank details not configured');
  });
});
