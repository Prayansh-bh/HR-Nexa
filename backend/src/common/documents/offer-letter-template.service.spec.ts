import { OfferLetterTemplateService } from './offer-letter-template.service';

describe('OfferLetterTemplateService (F08 Security Regression Tests)', () => {
  let service: OfferLetterTemplateService;

  beforeEach(() => {
    service = new OfferLetterTemplateService();
  });

  it('should compile valid HTML offer letters with clean inputs', () => {
    const html = service.compileOfferLetterHtml({
      recipientName: 'Rahul Sharma',
      designation: 'Staff Engineer',
      companyName: 'Acme Corp',
      companyAddress: 'Bangalore, India',
      issueDate: '22 August 2026',
      joiningDate: '01 September 2026',
      offerRef: 'OFF-123456-7890',
      terms: 'Standard probation of 3 months.\nWorking hours 9 AM to 6 PM.',
      preview: {
        annualCTC: 1200000,
        monthlyCTC: 100000,
        annualGross: 1178400,
        monthlyGross: 98200,
        netTakeHomeMonthly: 96200,
        breakdown: [
          { name: 'Basic Salary', category: 'EARNING', monthly: 49100, annual: 589200 },
        ],
      },
    });

    expect(html).toContain('Rahul Sharma');
    expect(html).toContain('Staff Engineer');
    expect(html).toContain('Standard probation of 3 months.<br/>Working hours 9 AM to 6 PM.');
  });

  it('should HTML-escape malicious script tags in candidate name and designation (F08)', () => {
    const maliciousPayload = '<script>alert("XSS")</script>';
    const html = service.compileOfferLetterHtml({
      recipientName: `John ${maliciousPayload}`,
      designation: `Lead Architect <img src=x onerror=alert('hack')>`,
      companyName: 'Acme <b onmouseover=evil()>Corp</b>',
      companyAddress: 'Addr <iframe src="evil.com"></iframe>',
      issueDate: '22 August 2026',
      joiningDate: '01 September 2026',
      offerRef: 'OFF-123',
      terms: 'Terms with <script>evil()</script> and \n newline',
      preview: {
        annualCTC: 1200000,
        monthlyCTC: 100000,
        annualGross: 1178400,
        monthlyGross: 98200,
        netTakeHomeMonthly: 96200,
        breakdown: [
          { name: 'Basic <svg/onload=alert(1)>', category: 'EARNING', monthly: 49100, annual: 589200 },
        ],
      },
    });

    expect(html).not.toContain('<script>alert("XSS")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(\'hack\')>');
    expect(html).toContain('&lt;img src=x onerror=alert(&#39;hack&#39;)&gt;');
    expect(html).not.toContain('<iframe src="evil.com"></iframe>');
    expect(html).toContain('&lt;iframe src=&quot;evil.com&quot;&gt;&lt;/iframe&gt;');
    expect(html).not.toContain('<svg/onload=alert(1)>');
    expect(html).toContain('&lt;svg/onload=alert(1)&gt;');
  });
});
