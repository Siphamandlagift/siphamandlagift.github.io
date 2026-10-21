export type CourseCompletionCertificateInput = {
  studentName: string;
  courseName: string;
  completionDate: string;
  // Admin-configurable (Course Studio > Certificate Template) — see CertificateTemplateSettings
  // in training-manager-data.service.ts. Left undefined/blank, every one of these reproduces
  // today's fixed design exactly: titleText defaults to 'Certificate of Completion', accentColor
  // to '#c9a227', backgroundColor to '#fdfaf3', textColor to '#173446', brandText to
  // 'SKILLSCONNECT', and the signature line is omitted entirely when signatoryName is blank.
  titleText?: string;
  accentColor?: string;
  backgroundColor?: string;
  // The primary/dark text colour — outer border, title, student name, course name, and the
  // signatory name. The lighter supporting copy ("This certifies that", the date, etc.) stays a
  // fixed muted tone regardless, so there's still visual hierarchy no matter what's picked here.
  textColor?: string;
  brandText?: string;
  signatoryName?: string;
  signatoryTitle?: string;
};

/** Converts a data URL (e.g. from canvas.toDataURL()) into a File, so a generated image can be
 *  handed to the existing file-upload endpoints the same way a picked <input type="file"> would be. */
export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}

/** Renders a printable "Certificate of Completion" as a PNG data URL — student name, course
 *  name, and completion date, framed with a simple decorative border. Canvas-based rather than
 *  a PDF library so it needs no new dependency and reuses the data-URL pattern already used for
 *  logos/thumbnails elsewhere in this app. */
export function renderCourseCompletionCertificate(input: CourseCompletionCertificateInput): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 990;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }

  const centerX = canvas.width / 2;
  const titleText = input.titleText?.trim() || 'Certificate of Completion';
  const accentColor = input.accentColor?.trim() || '#c9a227';
  const backgroundColor = input.backgroundColor?.trim() || '#fdfaf3';
  const textColor = input.textColor?.trim() || '#173446';
  const brandText = input.brandText?.trim() || 'SKILLSCONNECT';
  const signatoryName = input.signatoryName?.trim() ?? '';
  const signatoryTitle = input.signatoryTitle?.trim() ?? '';

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = textColor;
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, canvas.width - 112, canvas.height - 112);

  ctx.textAlign = 'center';

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 26px Georgia, "Times New Roman", serif';
  ctx.fillText(brandText, centerX, 160);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 62px Georgia, "Times New Roman", serif';
  ctx.fillText(titleText, centerX, 260);

  ctx.fillStyle = '#475569';
  ctx.font = '26px Georgia, "Times New Roman", serif';
  ctx.fillText('This certifies that', centerX, 365);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 50px "Brush Script MT", cursive, Georgia, serif';
  ctx.fillText(input.studentName, centerX, 450);

  const nameWidth = Math.min(620, ctx.measureText(input.studentName).width + 80);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - nameWidth / 2, 478);
  ctx.lineTo(centerX + nameWidth / 2, 478);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '26px Georgia, "Times New Roman", serif';
  ctx.fillText('has successfully completed the course', centerX, 545);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 38px Georgia, "Times New Roman", serif';
  drawWrappedCenteredText(ctx, input.courseName, centerX, 615, 1140, 46);

  ctx.fillStyle = '#475569';
  ctx.font = '24px Georgia, "Times New Roman", serif';
  ctx.fillText(formatCertificateDate(input.completionDate), centerX, 840);

  // Signature block is entirely optional — omitted (rather than drawn blank) when the admin
  // hasn't set a signatory name, so a template left at its defaults renders pixel-identical to
  // the original fixed design.
  if (signatoryName) {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 130, 872);
    ctx.lineTo(centerX + 130, 872);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 22px Georgia, "Times New Roman", serif';
    ctx.fillText(signatoryName, centerX, 897);

    if (signatoryTitle) {
      ctx.fillStyle = '#64748b';
      ctx.font = '17px Georgia, "Times New Roman", serif';
      ctx.fillText(signatoryTitle, centerX, 918);
    }
  }

  return canvas.toDataURL('image/png');
}

function drawWrappedCenteredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => ctx.fillText(line, x, startY + index * lineHeight));
}

function formatCertificateDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return 'Completion date not recorded';
  }

  const date = new Date(year, month - 1, day);
  const formatted = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  return `Completed on ${formatted}`;
}
