function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value !== "string") {
    try {
      value = JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

describe('HR NEXA — Payroll XSS Hardening & HTML Escaping Tests (PAYROLL-AUDIT-003)', () => {
  it('1. should escape employee name containing <script>', () => {
    const payload = '<script>alert(1)</script>';
    const result = escapeHtml(payload);
    expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('2. should escape employee name containing <img onerror>', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const result = escapeHtml(payload);
    expect(result).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(result).not.toContain('<img');
  });

  it('3. should escape remarks containing HTML tags', () => {
    const payload = '<b>Special Bonus</b> & Allowance';
    const result = escapeHtml(payload);
    expect(result).toBe('&lt;b&gt;Special Bonus&lt;/b&gt; &amp; Allowance');
  });

  it('4. should escape leave reason containing HTML', () => {
    const payload = 'Medical <iframe src="evil.com"></iframe>';
    const result = escapeHtml(payload);
    expect(result).toBe('Medical &lt;iframe src=&quot;evil.com&quot;&gt;&lt;/iframe&gt;');
    expect(result).not.toContain('<iframe');
  });

  it('5. should escape component name containing HTML', () => {
    const payload = 'HRA <script>alert("hack")</script>';
    const result = escapeHtml(payload);
    expect(result).toBe('HRA &lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;');
  });

  it('6. should escape quote-breaking payload `"><script>alert(1)</script>`', () => {
    const payload = '"><script>alert(document.cookie)</script>';
    const result = escapeHtml(payload);
    expect(result).toBe('&quot;&gt;&lt;script&gt;alert(document.cookie)&lt;/script&gt;');
  });

  it('7. should escape SVG onload payload `<svg onload=alert(1)>`', () => {
    const payload = '<svg onload=alert(1)>';
    const result = escapeHtml(payload);
    expect(result).toBe('&lt;svg onload=alert(1)&gt;');
    expect(result).not.toContain('<svg');
  });

  it('8. should escape javascript: payload', () => {
    const payload = 'javascript:alert(1)';
    const result = escapeHtml(payload);
    expect(result).toBe('javascript:alert(1)');
  });

  it('9. should handle null and undefined safely', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('10. should preserve normal Unicode employee names', () => {
    const payload = 'José María Ñuñez (Priya-Sharma)';
    const result = escapeHtml(payload);
    expect(result).toBe('José María Ñuñez (Priya-Sharma)');
  });

  it('11. should escape normal apostrophes and quotes safely', () => {
    const payload = "O'Connor & Sons \"Payroll\"";
    const result = escapeHtml(payload);
    expect(result).toBe('O&#39;Connor &amp; Sons &quot;Payroll&quot;');
  });

  it('12. should handle ampersand encoding', () => {
    const payload = 'AT&T & R&D';
    const result = escapeHtml(payload);
    expect(result).toBe('AT&amp;T &amp; R&amp;D');
  });
});
