import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export type CourseCompletionCertificatePdfInput = {
  studentName: string;
  courseName: string;
  // YYYY-MM-DD, same shape as the client-side renderer's completionDate.
  completionDate: string;
  serialNumber: string;
  verifyUrl: string;
  // Same CertificateTemplateSettings fields the client-side canvas renderer
  // (src/app/certificate-template.ts) takes — this is that layout ported to a real PDF.
  titleText: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  brandText: string;
  signatoryName: string;
  signatoryTitle: string;
};

// Server-side counterpart of src/app/certificate-template.ts's canvas renderer. Genuine
// tamper-resistance requires the certificate to be rendered somewhere the certificate holder
// doesn't control — a browser canvas can never provide that, no matter how it's drawn — so this
// is the ONLY renderer that produces a student's actual issued certificate (see
// IssuedCertificateRecord's own comment in contracts.ts). The client renderer stays in place
// unchanged, used only for the admin's live template-editing preview.
//
// Same 1400x990 'px'-unit coordinate space as the client renderer for visual parity, with two
// deliberate differences: no cursive font for the student's name (jsPDF's built-in fonts don't
// include one, and embedding a custom font just for this wasn't worth the added complexity), and
// a serial number + QR code stamped in the bottom-left corner, which is the entire reason this
// version exists.
export async function renderCourseCompletionCertificatePdf(input: CourseCompletionCertificatePdfInput): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1400, 990] });
  const centerX = 700;

  doc.setFillColor(input.backgroundColor);
  doc.rect(0, 0, 1400, 990, 'F');

  doc.setDrawColor(input.textColor);
  doc.setLineWidth(10);
  doc.rect(30, 30, 1340, 930, 'S');

  doc.setDrawColor(input.accentColor);
  doc.setLineWidth(3);
  doc.rect(56, 56, 1288, 878, 'S');

  doc.setTextColor('#94a3b8');
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.text(input.brandText, centerX, 160, { align: 'center' });

  doc.setTextColor(input.textColor);
  doc.setFont('times', 'bold');
  doc.setFontSize(62);
  doc.text(input.titleText, centerX, 260, { align: 'center' });

  doc.setTextColor('#475569');
  doc.setFont('times', 'normal');
  doc.setFontSize(26);
  doc.text('This certifies that', centerX, 365, { align: 'center' });

  doc.setTextColor(input.textColor);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(50);
  doc.text(input.studentName, centerX, 450, { align: 'center' });

  const nameWidth = Math.min(620, doc.getTextWidth(input.studentName) + 80);
  doc.setDrawColor(input.accentColor);
  doc.setLineWidth(2);
  doc.line(centerX - nameWidth / 2, 478, centerX + nameWidth / 2, 478);

  doc.setTextColor('#475569');
  doc.setFont('times', 'normal');
  doc.setFontSize(26);
  doc.text('has successfully completed the course', centerX, 545, { align: 'center' });

  doc.setTextColor(input.textColor);
  doc.setFont('times', 'bold');
  doc.setFontSize(38);
  doc.text(input.courseName, centerX, 615, { align: 'center', maxWidth: 1140 });

  doc.setTextColor('#475569');
  doc.setFont('times', 'normal');
  doc.setFontSize(24);
  doc.text(formatCertificateDate(input.completionDate), centerX, 840, { align: 'center' });

  const signatoryName = input.signatoryName.trim();
  if (signatoryName) {
    doc.setDrawColor('#94a3b8');
    doc.setLineWidth(1);
    doc.line(centerX - 130, 872, centerX + 130, 872);

    doc.setTextColor(input.textColor);
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.text(signatoryName, centerX, 897, { align: 'center' });

    const signatoryTitle = input.signatoryTitle.trim();
    if (signatoryTitle) {
      doc.setTextColor('#64748b');
      doc.setFont('times', 'normal');
      doc.setFontSize(17);
      doc.text(signatoryTitle, centerX, 918, { align: 'center' });
    }
  }

  // Verification stamp — bottom-left, deliberately outside the decorative border's "content"
  // area so it reads as a verification mark rather than part of the admin-customizable design.
  const qrDataUrl = await QRCode.toDataURL(input.verifyUrl, { margin: 0, width: 200 });
  doc.addImage(qrDataUrl, 'PNG', 70, 860, 70, 70);

  doc.setTextColor('#64748b');
  doc.setFont('courier', 'normal');
  doc.setFontSize(13);
  doc.text(`Serial: ${input.serialNumber}`, 150, 890);
  doc.text(`Verify at ${input.verifyUrl}`, 150, 908);

  return new Uint8Array(doc.output('arraybuffer'));
}

function formatCertificateDate(dateValue: string): string {
  const [year, month, day] = dateValue.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return 'Completion date not recorded';
  }

  const date = new Date(year, month - 1, day);
  const formatted = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  return `Completed on ${formatted}`;
}
