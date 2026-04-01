import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export async function exportCanvasToPdf(): Promise<void> {
  const element = document.querySelector('.react-flow') as HTMLElement | null;
  if (!element) {
    console.error('Export failed: React Flow element not found');
    return;
  }

  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: '#f9fafb',
    });

    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });

    const imgWidth = img.width;
    const imgHeight = img.height;
    const orientation = imgWidth >= imgHeight ? 'landscape' : 'portrait';

    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 10;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;

    const scale = Math.min(maxW / imgWidth, maxH / imgHeight);
    const w = imgWidth * scale;
    const h = imgHeight * scale;

    const x = (pageWidth - w) / 2;
    const y = (pageHeight - h) / 2;

    pdf.addImage(dataUrl, 'PNG', x, y, w, h);
    pdf.save('roadmap.pdf');
  } catch (err) {
    console.error('Failed to export PDF:', err);
  }
}
