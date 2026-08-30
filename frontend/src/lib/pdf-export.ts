export function printHTML(html: string) {
  let printableHtml = html;

  // If the HTML does not already contain a print trigger, inject one safely
  if (!printableHtml.includes("window.print")) {
    const printScript = `
<script>
  window.addEventListener('load', function() {
    setTimeout(function() {
      try {
        window.focus();
        window.print();
      } catch (e) {
        console.error("Print trigger failed:", e);
      }
    }, 200);
  });
</script>`;
    if (printableHtml.includes("</body>")) {
      printableHtml = printableHtml.replace("</body>", `${printScript}</body>`);
    } else {
      printableHtml += printScript;
    }
  }

  const blob = new Blob([printableHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (w) {
    w.focus();
  }
}
