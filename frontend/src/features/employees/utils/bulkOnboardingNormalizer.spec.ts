import { describe, it, expect } from 'vitest';
import {
  normalizeHeader,
  normalizeDate,
  normalizeSalary,
  normalizeStatus,
  generateAvatarInitials,
  normalizeAndValidateBulkRows,
} from './bulkOnboardingNormalizer';

describe('bulkOnboardingNormalizer (Phase 2)', () => {
  describe('1. Header Normalization', () => {
    it('should normalize various name header aliases and casing/whitespace', () => {
      expect(normalizeHeader('Name')).toBe('name');
      expect(normalizeHeader('name')).toBe('name');
      expect(normalizeHeader('NAME')).toBe('name');
      expect(normalizeHeader(' Name ')).toBe('name');
      expect(normalizeHeader('Full Name')).toBe('name');
      expect(normalizeHeader('Employee Name')).toBe('name');
      expect(normalizeHeader('Employee Full Name')).toBe('name');
      expect(normalizeHeader('emp_name')).toBe('name');
    });

    it('should normalize email header aliases', () => {
      expect(normalizeHeader('Email')).toBe('email');
      expect(normalizeHeader('EMAIL')).toBe('email');
      expect(normalizeHeader(' Email Address ')).toBe('email');
      expect(normalizeHeader('Work Email')).toBe('email');
      expect(normalizeHeader('Official Email')).toBe('email');
      expect(normalizeHeader('E-mail')).toBe('email');
    });

    it('should normalize department, designation, salary, joined, status, id headers', () => {
      expect(normalizeHeader('Department')).toBe('department');
      expect(normalizeHeader('Dept Name')).toBe('department');
      expect(normalizeHeader('Designation')).toBe('designation');
      expect(normalizeHeader('Job Title')).toBe('designation');
      expect(normalizeHeader('Position')).toBe('designation');
      expect(normalizeHeader('Monthly Salary')).toBe('salary');
      expect(normalizeHeader('Base Salary')).toBe('salary');
      expect(normalizeHeader('Date of Joining')).toBe('joined');
      expect(normalizeHeader('Joining Date')).toBe('joined');
      expect(normalizeHeader('Joined Date')).toBe('joined');
      expect(normalizeHeader('Employee Status')).toBe('status');
      expect(normalizeHeader('Employee ID')).toBe('id');
    });

    it('should return null for unknown or arbitrary headers', () => {
      expect(normalizeHeader('Random Header 123')).toBeNull();
      expect(normalizeHeader('')).toBeNull();
    });
  });

  describe('2. Date Normalization', () => {
    it('should parse ISO date strings YYYY-MM-DD', () => {
      expect(normalizeDate('2026-05-15')).toBe('2026-05-15');
      expect(normalizeDate('2026/05/15')).toBe('2026-05-15');
    });

    it('should parse localized date strings DD/MM/YYYY or DD-MM-YYYY', () => {
      expect(normalizeDate('15/05/2026')).toBe('2026-05-15');
      expect(normalizeDate('15-05-2026')).toBe('2026-05-15');
    });

    it('should parse numeric Excel date serial numbers without timezone shift', () => {
      // 46157 corresponds to 2026-05-15
      expect(normalizeDate(46157)).toBe('2026-05-15');
    });

    it('should format JavaScript Date objects without timezone shift', () => {
      const d = new Date(Date.UTC(2026, 4, 15)); // Month is 0-indexed (4 = May)
      expect(normalizeDate(d)).toBe('2026-05-15');
    });

    it('should return null for invalid dates', () => {
      expect(normalizeDate('not-a-date')).toBeNull();
      expect(normalizeDate('')).toBeNull();
      expect(normalizeDate(null)).toBeNull();
      expect(normalizeDate(undefined)).toBeNull();
    });
  });

  describe('3. Salary Normalization', () => {
    it('should normalize numeric numbers', () => {
      expect(normalizeSalary(60000)).toBe(60000);
      expect(normalizeSalary(85000.5)).toBe(85000.5);
      expect(normalizeSalary(0)).toBe(0);
    });

    it('should normalize string numbers and formatted numbers with commas', () => {
      expect(normalizeSalary('60000')).toBe(60000);
      expect(normalizeSalary(' 60,000 ')).toBe(60000);
      expect(normalizeSalary('1,25,000')).toBe(125000);
    });

    it('should return null for invalid salary amounts', () => {
      expect(normalizeSalary('invalid')).toBeNull();
      expect(normalizeSalary('-5000')).toBeNull();
      expect(normalizeSalary('')).toBeNull();
      expect(normalizeSalary(null)).toBeNull();
    });
  });

  describe('4. Status Normalization', () => {
    it('should default to Active when omitted or empty', () => {
      expect(normalizeStatus(null)).toEqual({ status: 'Active' });
      expect(normalizeStatus('')).toEqual({ status: 'Active' });
      expect(normalizeStatus(undefined)).toEqual({ status: 'Active' });
    });

    it('should normalize Active, On Leave, Inactive case-insensitively', () => {
      expect(normalizeStatus('active')).toEqual({ status: 'Active' });
      expect(normalizeStatus('ACTIVE')).toEqual({ status: 'Active' });
      expect(normalizeStatus('on leave')).toEqual({ status: 'On Leave' });
      expect(normalizeStatus('OnLeave')).toEqual({ status: 'On Leave' });
      expect(normalizeStatus('inactive')).toEqual({ status: 'Inactive' });
    });

    it('should return error for unrecognized status values', () => {
      expect(normalizeStatus('UnknownStatus').error).toBeDefined();
    });
  });

  describe('5. Avatar Initials Generator', () => {
    it('should generate initials from single or multi-part names', () => {
      expect(generateAvatarInitials('Jane Doe')).toBe('JD');
      expect(generateAvatarInitials('Alice')).toBe('AL');
      expect(generateAvatarInitials('Dr. John Watson Smith')).toBe('DS');
    });
  });

  describe('6. Full Batch Normalization & Validation', () => {
    it('should normalize standard CSV rows into canonical payloads', () => {
      const rawRows = [
        {
          'Full Name': 'Jane Doe',
          'Work Email': 'jane.doe@acme.co',
          'Department Name': 'Engineering',
          'Job Title': 'Software Engineer',
          'Monthly Salary': '75,000',
          'Date of Joining': '2026-05-15',
          Status: 'Active',
          Phone: '+91 98765 43210',
          Address: '123 Tech Park, Bengaluru',
        },
      ];

      const result = normalizeAndValidateBulkRows(rawRows);

      expect(result.totalRows).toBe(1);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(0);
      expect(result.validEmployees[0]).toEqual({
        id: undefined,
        name: 'Jane Doe',
        email: 'jane.doe@acme.co',
        department: 'Engineering',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-05-15',
        salary: 75000,
        avatar: 'JD',
        phone: '+91 98765 43210',
        address: '123 Tech Park, Bengaluru',
      });
    });

    it('should skip completely empty rows', () => {
      const rawRows = [
        {
          'Full Name': 'Jane Doe',
          'Work Email': 'jane.doe@acme.co',
          Department: 'Sales',
          Designation: 'Account Exec',
          Salary: '50000',
          Joined: '2026-01-01',
        },
        {
          'Full Name': '',
          'Work Email': '',
          Department: '',
          Designation: '',
          Salary: '',
          Joined: '',
        },
        {
          'Full Name': '   ',
          'Work Email': null,
          Department: undefined,
        },
      ];

      const result = normalizeAndValidateBulkRows(rawRows);

      expect(result.totalRows).toBe(1);
      expect(result.validCount).toBe(1);
    });

    it('should reject invalid rows and produce detailed error summaries', () => {
      const rawRows = [
        {
          Name: '', // Missing name
          Email: 'invalid-email', // Invalid email
          Department: '', // Missing department
          Designation: '', // Missing designation
          Salary: 'not-a-number', // Invalid salary
          Joined: 'invalid-date', // Invalid date
        },
      ];

      const result = normalizeAndValidateBulkRows(rawRows);

      expect(result.validCount).toBe(0);
      expect(result.invalidCount).toBe(1);
      expect(result.errorSummary[0].errors).toContain('Full Name is required');
      expect(result.errorSummary[0].errors).toContain(
        'Invalid email address format',
      );
      expect(result.errorSummary[0].errors).toContain('Department is required');
      expect(result.errorSummary[0].errors).toContain('Designation is required');
      expect(result.errorSummary[0].errors.some((e) => e.includes('Invalid salary'))).toBe(true);
      expect(result.errorSummary[0].errors.some((e) => e.includes('Invalid Joining Date'))).toBe(true);
    });

    it('should detect and flag duplicate emails within the uploaded file', () => {
      const rawRows = [
        {
          Name: 'User One',
          Email: 'duplicate@acme.co',
          Department: 'Marketing',
          Designation: 'Lead',
          Salary: '60000',
          Joined: '2026-01-01',
        },
        {
          Name: 'User Two',
          Email: 'DUPLICATE@ACME.CO', // Same email, different case
          Department: 'Sales',
          Designation: 'Rep',
          Salary: '50000',
          Joined: '2026-01-01',
        },
      ];

      const result = normalizeAndValidateBulkRows(rawRows);

      expect(result.totalRows).toBe(2);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(1);
      expect(result.previewRows[1].errors[0]).toContain(
        'Duplicate email in file (already present on row 2)',
      );
    });

    it('should send "joined" and NOT "joinedDate" in the canonical payload', () => {
      const rawRows = [
        {
          Name: 'Valid User',
          Email: 'valid@acme.co',
          Department: 'IT',
          Designation: 'Admin',
          Salary: '80000',
          'Date of Joining': '2026-03-01',
        },
      ];

      const result = normalizeAndValidateBulkRows(rawRows);
      const payload: any = result.validEmployees[0];

      expect(payload.joined).toBe('2026-03-01');
      expect(payload.joinedDate).toBeUndefined();
      expect(payload.departmentName).toBe('IT');
    });

    it('should correctly compose full name when FIRST_NAME and LAST_NAME are in separate columns', () => {
      const rawRows = [
        {
          FIRST_NAME: 'Donald',
          LAST_NAME: 'OConnell',
          EMAIL: 'donald.oconnell@acme.co',
          DEPARTMENT: 'Shipping',
          DESIGNATION: 'Clerk',
          SALARY: '2600',
          HIRE_DATE: '2007-06-21',
        },
        {
          FIRST_NAME: 'Lex',
          MIDDLE_NAME: 'De',
          LAST_NAME: 'Haan',
          EMAIL: 'lex.dehaan@acme.co',
          DEPARTMENT: 'Executive',
          DESIGNATION: 'VP',
          SALARY: '17000',
          HIRE_DATE: '2001-01-13',
        },
      ];

      const result = normalizeAndValidateBulkRows(rawRows);

      expect(result.validCount).toBe(2);
      expect(result.validEmployees[0].name).toBe('Donald OConnell');
      expect(result.validEmployees[0].avatar).toBe('DO');
      expect(result.validEmployees[1].name).toBe('Lex De Haan');
      expect(result.validEmployees[1].avatar).toBe('LH');
    });
  });
});
