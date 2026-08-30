import { describe, it, expect, vi, beforeEach } from 'vitest';
import { printHTML } from './pdf-export';

describe('PDF Export & Print Utility (printHTML)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Injects window.print script into raw HTML that does not have it and opens window', () => {
    let capturedBlobContent = '';
    const OriginalBlob = global.Blob;

    class CustomBlob extends OriginalBlob {
      constructor(content: any[], options?: any) {
        super(content, options);
        capturedBlobContent = content[0];
      }
    }
    global.Blob = CustomBlob as any;

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost:5173/mock-uuid');
    global.URL.createObjectURL = mockCreateObjectURL;

    const mockFocus = vi.fn();
    const mockOpen = vi.fn().mockReturnValue({ focus: mockFocus });
    global.window.open = mockOpen;

    const rawHtml = '<html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>';
    printHTML(rawHtml);

    expect(capturedBlobContent).toContain('window.print()');
    expect(capturedBlobContent).toContain('Hello World');
    expect(mockOpen).toHaveBeenCalledWith('blob:http://localhost:5173/mock-uuid', '_blank');
    expect(mockFocus).toHaveBeenCalled();

    global.Blob = OriginalBlob;
  });

  it('2. Preserves existing window.print() and does not inject duplicate scripts for Payroll HTML', () => {
    let capturedBlobContent = '';
    const OriginalBlob = global.Blob;

    class CustomBlob extends OriginalBlob {
      constructor(content: any[], options?: any) {
        super(content, options);
        capturedBlobContent = content[0];
      }
    }
    global.Blob = CustomBlob as any;

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost:5173/mock-uuid-2');
    global.URL.createObjectURL = mockCreateObjectURL;

    const mockFocus = vi.fn();
    const mockOpen = vi.fn().mockReturnValue({ focus: mockFocus });
    global.window.open = mockOpen;

    const payrollHtml =
      '<html><head><title>Slips</title></head><body><h2>Payslip</h2><script>window.onload=()=>window.print()</script></body></html>';
    printHTML(payrollHtml);

    // Should only have 1 occurrence of window.print()
    const matches = capturedBlobContent.match(/window\.print\(\)/g) || [];
    expect(matches.length).toBe(1);
    expect(capturedBlobContent).toBe(payrollHtml);

    global.Blob = OriginalBlob;
  });
});
