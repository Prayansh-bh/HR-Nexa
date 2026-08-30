/**
 * Canonical Bulk Onboarding Header & Value Normalizer
 *
 * Implements strict, controlled normalization and validation rules for CSV/XLSX employee uploads.
 * Replaces loose/untyped parsing with canonical field mappings conforming to backend CreateEmployeeDto.
 */

export interface CanonicalEmployeePayload {
  id?: string;
  name: string;
  email: string;
  department: string;
  departmentName: string;
  designation: string;
  status: 'Active' | 'On Leave' | 'Inactive';
  joined: string;
  salary: number;
  avatar: string;
  phone?: string;
  address?: string;
  dob?: string;
  gender?: string;
  uan?: string;
  esic?: string;
  pan?: string;
  aadhaar?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  location?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  passportNumber?: string;
  personalEmail?: string;
  permanentAddress?: string;
}

export interface NormalizedPreviewRow {
  rowNumber: number; // 1-indexed for human-readable display
  id?: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  salary?: number;
  joined: string;
  status: string;
  phone?: string;
  address?: string;
  isValid: boolean;
  errors: string[];
}

export interface BulkNormalizationResult {
  validEmployees: CanonicalEmployeePayload[];
  previewRows: NormalizedPreviewRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  errorSummary: { rowNumber: number; errors: string[] }[];
}

const HEADER_ALIAS_MAP: Record<string, string> = {
  // Name
  name: 'name',
  'full name': 'name',
  fullname: 'name',
  'employee name': 'name',
  employeename: 'name',
  'employee full name': 'name',
  'emp name': 'name',
  empname: 'name',

  // First Name
  'first name': 'firstName',
  firstname: 'firstName',
  'first_name': 'firstName',
  'given name': 'firstName',
  fname: 'firstName',

  // Middle Name
  'middle name': 'middleName',
  middlename: 'middleName',
  'middle_name': 'middleName',
  mname: 'middleName',

  // Last Name
  'last name': 'lastName',
  lastname: 'lastName',
  'last_name': 'lastName',
  surname: 'lastName',
  'family name': 'lastName',
  lname: 'lastName',

  // Email
  email: 'email',
  'email address': 'email',
  emailaddress: 'email',
  'work email': 'email',
  workemail: 'email',
  'official email': 'email',
  officialemail: 'email',
  'primary email': 'email',
  primaryemail: 'email',
  'e mail': 'email',

  // Phone
  phone: 'phone',
  'phone number': 'phone',
  phonenumber: 'phone',
  'phone no': 'phone',
  phoneno: 'phone',
  mobile: 'phone',
  'mobile number': 'phone',
  mobilenumber: 'phone',
  'mobile no': 'phone',
  contact: 'phone',
  'contact number': 'phone',
  'contact no': 'phone',
  contactnumber: 'phone',
  cell: 'phone',

  // Address
  address: 'address',
  'home address': 'address',
  'residential address': 'address',
  'current address': 'address',
  'address line': 'address',
  'address line 1': 'address',

  // Department
  department: 'department',
  'department name': 'department',
  departmentname: 'department',
  dept: 'department',
  'dept name': 'department',
  deptname: 'department',

  // Designation
  designation: 'designation',
  'job title': 'designation',
  jobtitle: 'designation',
  title: 'designation',
  position: 'designation',
  role: 'designation',

  // Salary (Monthly Base Salary in HRMS semantics)
  salary: 'salary',
  'monthly salary': 'salary',
  monthlysalary: 'salary',
  'base salary': 'salary',
  basesalary: 'salary',
  'basic salary': 'salary',
  basicsalary: 'salary',
  'monthly pay': 'salary',
  pay: 'salary',

  // Joining Date
  joined: 'joined',
  'joining date': 'joined',
  joiningdate: 'joined',
  'date of joining': 'joined',
  'date of join': 'joined',
  'join date': 'joined',
  joindate: 'joined',
  'joined date': 'joined',
  joineddate: 'joined',
  'hire date': 'joined',
  hiredate: 'joined',
  'start date': 'joined',
  startdate: 'joined',

  // Status
  status: 'status',
  'employee status': 'status',
  employeestatus: 'status',
  'employment status': 'status',
  employmentstatus: 'status',

  // ID
  id: 'id',
  'employee id': 'id',
  employeeid: 'id',
  'emp id': 'id',
  empid: 'id',
  'employee code': 'id',
  employeecode: 'id',
  'emp code': 'id',
  empcode: 'id',
  'employee number': 'id',
  employeenumber: 'id',
  'emp no': 'id',
  empno: 'id',

  // Optional fields
  dob: 'dob',
  'date of birth': 'dob',
  'birth date': 'dob',
  birthdate: 'dob',
  gender: 'gender',
  sex: 'gender',
  location: 'location',
  'work location': 'location',
  'office location': 'location',
  branch: 'location',
  uan: 'uan',
  'uan number': 'uan',
  esic: 'esic',
  'esic number': 'esic',
  pan: 'pan',
  'pan number': 'pan',
  'pan no': 'pan',
  aadhaar: 'aadhaar',
  'aadhaar number': 'aadhaar',
  adhaar: 'aadhaar',
  aadhar: 'aadhaar',
  'bank name': 'bankName',
  bank: 'bankName',
  'account number': 'accountNumber',
  'account no': 'accountNumber',
  ifsc: 'ifscCode',
  'ifsc code': 'ifscCode',
  'marital status': 'maritalStatus',
  maritalstatus: 'maritalStatus',
  'blood group': 'bloodGroup',
  bloodgroup: 'bloodGroup',
  passport: 'passportNumber',
  'passport number': 'passportNumber',
  'passport no': 'passportNumber',
  'personal email': 'personalEmail',
  'personal email address': 'personalEmail',
  'permanent address': 'permanentAddress',
};

/**
 * Normalizes raw column header string to canonical key.
 */
export function normalizeHeader(rawHeader: string): string | null {
  if (!rawHeader || typeof rawHeader !== 'string') return null;
  const clean = rawHeader
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, ' ');
  return HEADER_ALIAS_MAP[clean] || null;
}

/**
 * Normalizes Date representations (Date objects, Excel serials, ISO strings, localized strings)
 * to exact YYYY-MM-DD format without UTC/local timezone shifts.
 */
export function normalizeDate(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;

  // 1. JavaScript Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Numeric Excel date serial number (e.g. 46157 -> 2026-05-15)
  if (typeof val === 'number' && !isNaN(val) && val > 0) {
    const utcDays = Math.floor(val - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (isNaN(dateObj.getTime())) return null;
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    if (y >= 1900 && y <= 2100) {
      return `${y}-${m}-${d}`;
    }
    return null;
  }

  // 3. String date formats
  const str = String(val).trim();
  if (!str) return null;

  // ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD-MM-YYYY or MM-DD-YYYY or DD/MM/YYYY
  const altMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (altMatch) {
    const p1 = parseInt(altMatch[1], 10);
    const p2 = parseInt(altMatch[2], 10);
    const y = parseInt(altMatch[3], 10);
    if (y >= 1900 && y <= 2100) {
      if (p1 > 12 && p2 >= 1 && p2 <= 12 && p1 <= 31) {
        return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
      if (p2 > 12 && p1 >= 1 && p1 <= 12 && p2 <= 31) {
        return `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
      }
      if (p1 >= 1 && p1 <= 31 && p2 >= 1 && p2 <= 12) {
        return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
    }
  }

  // General Date.parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    if (y >= 1900 && y <= 2100) {
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

/**
 * Normalizes salary values to a positive number.
 * Handles numbers, numeric strings, and strings with thousand separators (e.g. "60,000").
 * Rejects invalid text or negative amounts.
 */
export function normalizeSalary(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) || val < 0 ? null : val;
  }
  const cleanStr = String(val).trim().replace(/[\s,]/g, '');
  if (!cleanStr) return null;
  if (!/^\d+(\.\d+)?$/.test(cleanStr)) return null;
  const num = Number(cleanStr);
  return isNaN(num) || num < 0 ? null : num;
}

/**
 * Normalizes status values to Active, On Leave, or Inactive.
 * Defaults to 'Active' when omitted.
 */
export function normalizeStatus(val: any): {
  status?: 'Active' | 'On Leave' | 'Inactive';
  error?: string;
} {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { status: 'Active' };
  }
  const clean = String(val).trim().toLowerCase().replace(/[\s_\-]+/g, ' ');
  if (clean === 'active') return { status: 'Active' };
  if (clean === 'on leave' || clean === 'onleave' || clean === 'leave')
    return { status: 'On Leave' };
  if (clean === 'inactive' || clean === 'terminated' || clean === 'resigned')
    return { status: 'Inactive' };
  return {
    error: `Invalid status "${val}". Allowed: Active, On Leave, Inactive`,
  };
}

/**
 * Generates 2-letter avatar initials from employee name.
 */
export function generateAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Normalizes a single spreadsheet row and validates against the canonical contract.
 */
export function normalizeEmployeeRow(
  rawRow: Record<string, any>,
  rowNumber: number,
  seenEmails: Map<string, number>,
  seenIds: Map<string, number>,
): {
  payload?: CanonicalEmployeePayload;
  preview: NormalizedPreviewRow;
  isEmpty: boolean;
} {
  const normalizedData: Record<string, any> = {};
  let hasAnyContent = false;

  for (const rawKey of Object.keys(rawRow)) {
    const rawVal = rawRow[rawKey];
    if (
      rawVal !== null &&
      rawVal !== undefined &&
      String(rawVal).trim() !== ''
    ) {
      hasAnyContent = true;
    }
    const canonicalKey = normalizeHeader(rawKey);
    if (canonicalKey) {
      normalizedData[canonicalKey] = rawVal;
    }
  }

  // 1. Empty row check
  if (!hasAnyContent) {
    return {
      preview: {
        rowNumber,
        name: '',
        email: '',
        department: '',
        designation: '',
        joined: '',
        status: '',
        isValid: false,
        errors: ['Empty row'],
      },
      isEmpty: true,
    };
  }

  const errors: string[] = [];

  // 2. Name resolution & validation (supports single 'Name' or split 'First' + 'Middle' + 'Last' Name columns)
  let rawName =
    normalizedData.name !== undefined
      ? String(normalizedData.name).trim()
      : '';

  if (!rawName) {
    const parts = [
      normalizedData.firstName,
      normalizedData.middleName,
      normalizedData.lastName,
    ]
      .filter(Boolean)
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0);

    if (parts.length > 0) {
      rawName = parts.join(' ');
    }
  }

  if (!rawName) {
    errors.push('Full Name is required');
  } else if (rawName.length > 250) {
    errors.push('Name must not exceed 250 characters');
  } else if (!/^[a-zA-Z\s]+$/.test(rawName)) {
    errors.push('Name must contain only alphabets and spaces');
  }

  // 3. Email validation
  const rawEmail =
    normalizedData.email !== undefined
      ? String(normalizedData.email).trim().toLowerCase()
      : '';
  if (!rawEmail) {
    errors.push('Email is required');
  } else if (
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rawEmail)
  ) {
    errors.push('Invalid email address format');
  } else {
    const prevRow = seenEmails.get(rawEmail);
    if (prevRow !== undefined) {
      errors.push(
        `Duplicate email in file (already present on row ${prevRow})`,
      );
    } else {
      seenEmails.set(rawEmail, rowNumber);
    }
  }

  // 4. Department validation
  const rawDept =
    normalizedData.department !== undefined
      ? String(normalizedData.department).trim()
      : '';
  if (!rawDept) {
    errors.push('Department is required');
  }

  // 5. Designation validation
  const rawDesig =
    normalizedData.designation !== undefined
      ? String(normalizedData.designation).trim()
      : '';
  if (!rawDesig) {
    errors.push('Designation is required');
  }

  // 6. Salary validation
  const rawSalary = normalizedData.salary;
  const salaryNum = normalizeSalary(rawSalary);
  if (
    rawSalary === undefined ||
    rawSalary === null ||
    String(rawSalary).trim() === ''
  ) {
    errors.push('Monthly Salary is required');
  } else if (salaryNum === null) {
    errors.push(
      `Invalid salary amount "${rawSalary}" (must be a non-negative number)`,
    );
  }

  // 7. Joining Date validation
  const rawJoined = normalizedData.joined;
  const joinedDate = normalizeDate(rawJoined);
  if (!rawJoined || String(rawJoined).trim() === '') {
    errors.push('Joining Date is required');
  } else if (!joinedDate) {
    errors.push(
      `Invalid Joining Date format "${rawJoined}" (expected YYYY-MM-DD)`,
    );
  }

  // 8. Status validation
  const statusResult = normalizeStatus(normalizedData.status);
  if (statusResult.error) {
    errors.push(statusResult.error);
  }
  const statusVal = statusResult.status || 'Active';

  // 9. Optional Phone validation
  const rawPhone =
    normalizedData.phone !== undefined
      ? String(normalizedData.phone).trim()
      : undefined;
  if (rawPhone && !/^\+?[0-9\s\-]{10,15}$/.test(rawPhone)) {
    errors.push(
      'Phone number must be numeric and between 10 to 15 digits',
    );
  }

  // 10. Optional Address validation
  const rawAddress =
    normalizedData.address !== undefined
      ? String(normalizedData.address).trim()
      : undefined;
  if (rawAddress && rawAddress.length > 500) {
    errors.push('Address must not exceed 500 characters');
  }

  // 11. Optional ID validation
  const rawId =
    normalizedData.id !== undefined
      ? String(normalizedData.id).trim()
      : undefined;
  if (rawId) {
    const prevIdRow = seenIds.get(rawId);
    if (prevIdRow !== undefined) {
      errors.push(
        `Duplicate Employee ID in file (already present on row ${prevIdRow})`,
      );
    } else {
      seenIds.set(rawId, rowNumber);
    }
  }

  const isValid = errors.length === 0;

  const preview: NormalizedPreviewRow = {
    rowNumber,
    id: rawId,
    name: rawName,
    email: rawEmail,
    department: rawDept,
    designation: rawDesig,
    salary: salaryNum !== null ? salaryNum : undefined,
    joined: joinedDate || String(rawJoined || ''),
    status: statusVal,
    phone: rawPhone,
    address: rawAddress,
    isValid,
    errors,
  };

  if (!isValid) {
    return { preview, isEmpty: false };
  }

  const payload: CanonicalEmployeePayload = {
    id: rawId,
    name: rawName,
    email: rawEmail,
    department: rawDept,
    departmentName: rawDept,
    designation: rawDesig,
    status: statusVal,
    joined: joinedDate!,
    salary: salaryNum!,
    avatar: generateAvatarInitials(rawName),
    phone: rawPhone || undefined,
    address: rawAddress || undefined,
  };

  return { payload, preview, isEmpty: false };
}

/**
 * Normalizes and validates an array of raw spreadsheet rows into canonical employee payloads and previews.
 */
export function normalizeAndValidateBulkRows(
  rawRows: Record<string, any>[],
): BulkNormalizationResult {
  const validEmployees: CanonicalEmployeePayload[] = [];
  const previewRows: NormalizedPreviewRow[] = [];
  const errorSummary: { rowNumber: number; errors: string[] }[] = [];
  const seenEmails = new Map<string, number>();
  const seenIds = new Map<string, number>();

  let humanRowCounter = 1;

  for (const rawRow of rawRows) {
    humanRowCounter++; // Row 1 is header row in spreadsheet, so data rows start at row 2
    const result = normalizeEmployeeRow(
      rawRow,
      humanRowCounter,
      seenEmails,
      seenIds,
    );
    if (result.isEmpty) {
      continue;
    }
    previewRows.push(result.preview);
    if (result.payload && result.preview.isValid) {
      validEmployees.push(result.payload);
    } else {
      errorSummary.push({
        rowNumber: result.preview.rowNumber,
        errors: result.preview.errors,
      });
    }
  }

  return {
    validEmployees,
    previewRows,
    totalRows: previewRows.length,
    validCount: validEmployees.length,
    invalidCount: errorSummary.length,
    errorSummary,
  };
}
