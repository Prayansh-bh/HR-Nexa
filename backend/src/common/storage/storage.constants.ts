export type UploadCategory =
  | 'employee-photos'
  | 'documents'
  | 'resumes'
  | 'offer-letters'
  | 'payslips'
  | 'hr_letter';

export function normalizeUploadCategory(rawCategory?: string): UploadCategory {
  if (!rawCategory) return 'documents';
  const clean = rawCategory.toLowerCase().replace(/[_\s]+/g, '-');
  if (clean === 'employee-photos' || clean === 'photos' || clean === 'photo') return 'employee-photos';
  if (clean === 'resumes' || clean === 'resume') return 'resumes';
  if (clean === 'offer-letters' || clean === 'offer-letter' || clean === 'offers' || clean === 'offer') return 'offer-letters';
  if (clean === 'payslips' || clean === 'payslip') return 'payslips';
  if (clean === 'hr-letter' || clean === 'hr-letters' || clean === 'hr_letter') return 'hr_letter';
  return 'documents';
}

export const ALLOWED_MIME_TYPES: Record<UploadCategory, string[]> = {
  'employee-photos': ['image/jpeg', 'image/png', 'image/webp'],
  documents: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/html',
  ],
  resumes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  'offer-letters': [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/html',
  ],
  payslips: ['application/pdf'],
  hr_letter: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/html',
  ],
};

export const MAX_FILE_SIZES: Record<UploadCategory, number> = {
  'employee-photos': 5 * 1024 * 1024,  // 5MB
  documents: 10 * 1024 * 1024,        // 10MB
  resumes: 10 * 1024 * 1024,          // 10MB
  'offer-letters': 10 * 1024 * 1024,  // 10MB
  payslips: 10 * 1024 * 1024,         // 10MB
  hr_letter: 10 * 1024 * 1024,        // 10MB
};
