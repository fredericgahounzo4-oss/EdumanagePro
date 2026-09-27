import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Capture un élément du DOM et le télécharge directement en PDF A4, une
 * seule page, sans passer par la boîte de dialogue d'impression du
 * navigateur. Le contenu est mis à l'échelle pour tenir entièrement sur
 * la page, comme le ferait une impression "ajuster à la page".
 */
export async function downloadElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addCanvasAsPage(pdf, canvas);
  pdf.save(filename);
}

/**
 * Capture plusieurs éléments (un par élève, par ex.) et les regroupe dans un
 * seul PDF, une page par élément, téléchargé directement.
 */
export async function downloadElementsAsPdf(elements: HTMLElement[], filename: string): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  for (let i = 0; i < elements.length; i++) {
    const canvas = await html2canvas(elements[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    if (i > 0) pdf.addPage();
    addCanvasAsPage(pdf, canvas);
  }
  pdf.save(filename);
}

function addCanvasAsPage(pdf: jsPDF, canvas: HTMLCanvasElement) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidthMm = pageWidth;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
  // Si le rendu est plus haut qu'une page A4, on le réduit pour qu'il
  // tienne entièrement dessus plutôt que de déborder sur une 2e page.
  const scaleToFit = imgHeightMm > pageHeight ? pageHeight / imgHeightMm : 1;
  const finalWidth = imgWidthMm * scaleToFit;
  const finalHeight = imgHeightMm * scaleToFit;
  const x = (pageWidth - finalWidth) / 2;
  const y = 0;
  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
}
