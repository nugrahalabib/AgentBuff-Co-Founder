// src/server/docs/pdf-renderer.ts — server-side HTML→PDF via headless Chromium (Puppeteer). PRD §9.5.
// The doc templates already carry CSS @page rules (A4 / 16:9), so we render with preferCSSPageSize so the
// same HTML the browser prints produces an identical PDF headlessly (for MCP/email/download). Puppeteer +
// Chromium are dynamically imported and capability-checked, so the app runs fine where Chromium is absent
// (the browser "Cetak / Simpan PDF" path always works). Single seam → swap engines without touching callers.

export interface PdfRenderer {
  available(): Promise<boolean>;
  render(html: string): Promise<Buffer>;
}

export class PuppeteerPdfRenderer implements PdfRenderer {
  private availability: Promise<boolean> | null = null;

  async available(): Promise<boolean> {
    if (this.availability === null) {
      this.availability = (async () => {
        try {
          const puppeteer = (await import("puppeteer")).default;
          const { existsSync } = await import("node:fs");
          const execPath = await puppeteer.executablePath();
          return existsSync(execPath);
        } catch {
          return false;
        }
      })();
    }
    return this.availability;
  }

  async render(html: string): Promise<Buffer> {
    const puppeteer = (await import("puppeteer")).default;
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

/** Renderer that always reports unavailable — used in tests / where Chromium is intentionally off. */
export class UnavailablePdfRenderer implements PdfRenderer {
  async available(): Promise<boolean> {
    return false;
  }
  async render(): Promise<Buffer> {
    throw new Error("PDF renderer tidak tersedia.");
  }
}

export function createPdfRenderer(): PdfRenderer {
  return process.env.NODE_ENV === "test" ? new UnavailablePdfRenderer() : new PuppeteerPdfRenderer();
}
