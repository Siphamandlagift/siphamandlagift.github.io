import { strFromU8, unzipSync } from 'fflate';

export type PowerPointUploadType = 'pptx' | 'ppt';

export type PowerPointPreviewSlide = {
  title: string;
  bulletPoints: string[];
  altText: string;
  previewDataUrl: string;
};

type PowerPointTheme = {
  colors: Map<string, string>;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
};

type PowerPointCanvas = {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
};

type PowerPointTextParagraph = {
  text: string;
  level: number;
  fontSize: number;
  bold: boolean;
  color: string;
};

type PowerPointTextShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  placeholderType: string | null;
  fillColor: string | null;
  paragraphs: PowerPointTextParagraph[];
};

const DEFAULT_SLIDE_WIDTH = 1600;
const DEFAULT_SLIDE_HEIGHT = 900;
const DEFAULT_SLIDE_WIDTH_EMU = 12192000;
const DEFAULT_SLIDE_HEIGHT_EMU = 6858000;
const DEFAULT_TITLE_FONT_SIZE = 32;
const DEFAULT_SUBTITLE_FONT_SIZE = 24;
const DEFAULT_BODY_FONT_SIZE = 20;
const TEXT_BOX_PADDING = 24;
const MAX_PREVIEW_BULLETS = 8;

const PRESET_COLOR_MAP: Record<string, string> = {
  black: '#000000',
  blue: '#2563EB',
  cyan: '#0891B2',
  gray: '#6B7280',
  green: '#16A34A',
  magenta: '#DB2777',
  orange: '#F97316',
  purple: '#7C3AED',
  red: '#DC2626',
  white: '#FFFFFF',
  yellow: '#EAB308',
};

export function resolvePowerPointUploadType(fileName: string, dataUrl: string): PowerPointUploadType | null {
  const normalizedFileName = fileName.trim().toLowerCase();
  const normalizedDataUrl = dataUrl.trim().toLowerCase();

  if (
    normalizedFileName.endsWith('.pptx') ||
    normalizedDataUrl.startsWith('data:application/vnd.openxmlformats-officedocument.presentationml.presentation')
  ) {
    return 'pptx';
  }

  if (normalizedFileName.endsWith('.ppt') || normalizedDataUrl.startsWith('data:application/vnd.ms-powerpoint')) {
    return 'ppt';
  }

  return null;
}

export function extractPowerPointSlides(dataUrl: string): PowerPointPreviewSlide[] {
  const zipArchive = unzipSync(decodeDataUrlToBytes(dataUrl));
  const presentationXml = readArchiveText(zipArchive, 'ppt/presentation.xml');
  const relationshipXml = readArchiveText(zipArchive, 'ppt/_rels/presentation.xml.rels');

  if (!presentationXml || !relationshipXml) {
    throw new Error('Missing PowerPoint presentation metadata.');
  }

  const slidePaths = resolvePowerPointSlidePaths(presentationXml, relationshipXml);
  if (!slidePaths.length) {
    throw new Error('No slides were found in the uploaded presentation.');
  }

  const theme = resolvePowerPointTheme(zipArchive);
  const canvas = resolvePowerPointCanvas(presentationXml);

  return slidePaths.map((slidePath, slideIndex) => {
    const slideXml = readArchiveText(zipArchive, slidePath);
    const slideLines = slideXml ? extractPowerPointSlideLines(slideXml) : [];
    const textShapes = slideXml ? extractPowerPointTextShapes(slideXml, canvas, theme) : [];
    const title = resolvePowerPointSlideTitle(textShapes, slideLines, slideIndex);
    const bulletPoints = resolvePowerPointSlideBulletPoints(textShapes, slideLines, title);
    const previewDataUrl = renderPowerPointSlidePreview({
      backgroundColor: slideXml ? resolvePowerPointSlideBackgroundColor(slideXml, theme) : theme.backgroundColor,
      canvas,
      slideIndex,
      textShapes,
      theme,
      title,
      bulletPoints,
    });

    return {
      title,
      bulletPoints,
      altText: buildPowerPointSlideAltText(title, bulletPoints, slideIndex),
      previewDataUrl,
    };
  });
}

function decodeDataUrlToBytes(dataUrl: string) {
  const [, base64Payload = ''] = dataUrl.split(',', 2);
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function readArchiveText(zipArchive: Record<string, Uint8Array>, filePath: string) {
  const archiveFile = zipArchive[filePath.replace(/\\/g, '/')];
  return archiveFile ? strFromU8(archiveFile) : '';
}

function resolvePowerPointTheme(zipArchive: Record<string, Uint8Array>): PowerPointTheme {
  const themeXml = readArchiveText(zipArchive, 'ppt/theme/theme1.xml');
  const colors = new Map<string, string>();

  for (const key of ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']) {
    const colorValue = extractDirectColor(matchTagBlock(themeXml, `a:${key}`));
    if (colorValue) {
      colors.set(key, colorValue);
    }
  }

  const backgroundColor = colors.get('lt1') ?? '#FFFFFF';
  const textColor = colors.get('dk1') ?? '#0F172A';
  const accentColor = colors.get('accent1') ?? '#2563EB';

  return {
    colors,
    backgroundColor,
    textColor,
    accentColor,
  };
}

function resolvePowerPointCanvas(presentationXml: string): PowerPointCanvas {
  const slideWidthEmu = matchNumericValue(presentationXml, /<p:sldSz\b[^>]*\bcx="(\d+)"/i) ?? DEFAULT_SLIDE_WIDTH_EMU;
  const slideHeightEmu = matchNumericValue(presentationXml, /<p:sldSz\b[^>]*\bcy="(\d+)"/i) ?? DEFAULT_SLIDE_HEIGHT_EMU;
  const width = DEFAULT_SLIDE_WIDTH;
  const height = Math.max(720, Math.round((width * slideHeightEmu) / slideWidthEmu));

  return {
    width,
    height,
    scaleX: width / slideWidthEmu,
    scaleY: height / slideHeightEmu,
  };
}

function resolvePowerPointSlidePaths(presentationXml: string, relationshipXml: string) {
  const relationshipTargets = new Map<string, string>();

  for (const match of relationshipXml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)) {
    relationshipTargets.set(match[1], resolveArchivePath('ppt/presentation.xml', match[2]));
  }

  const slidePaths: string[] = [];
  for (const match of presentationXml.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)) {
    const slidePath = relationshipTargets.get(match[1]);
    if (slidePath) {
      slidePaths.push(slidePath);
    }
  }

  return slidePaths;
}

function resolveArchivePath(sourcePath: string, targetPath: string) {
  const normalizedTarget = targetPath.replace(/\\/g, '/');
  if (normalizedTarget.startsWith('/')) {
    return normalizedTarget.slice(1);
  }

  const sourceSegments = sourcePath.replace(/\\/g, '/').split('/');
  sourceSegments.pop();

  for (const segment of normalizedTarget.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      sourceSegments.pop();
      continue;
    }

    sourceSegments.push(segment);
  }

  return sourceSegments.join('/');
}

function extractPowerPointTextShapes(slideXml: string, canvas: PowerPointCanvas, theme: PowerPointTheme) {
  return Array.from(slideXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g), (match) => match[0])
    .map((shapeXml, shapeIndex) => {
      const placeholderType = shapeXml.match(/<p:ph\b[^>]*\btype="([^"]+)"/i)?.[1] ?? null;
      const paragraphs = extractPowerPointShapeParagraphs(shapeXml, theme, placeholderType);
      if (!paragraphs.length) {
        return null;
      }

      const bounds = resolvePowerPointShapeBounds(shapeXml, canvas, placeholderType, shapeIndex);
      return {
        ...bounds,
        placeholderType,
        fillColor: resolvePowerPointShapeFillColor(shapeXml, theme),
        paragraphs,
      } satisfies PowerPointTextShape;
    })
    .filter((shape): shape is PowerPointTextShape => Boolean(shape))
    .sort((left, right) => left.y - right.y || left.x - right.x);
}

function extractPowerPointShapeParagraphs(shapeXml: string, theme: PowerPointTheme, placeholderType: string | null) {
  return Array.from(shapeXml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g), (match) => match[0])
    .map((paragraphXml) => {
      const text = normalizeWhitespace(
        Array.from(paragraphXml.replace(/<a:br\s*\/>/gi, ' ').matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g), (match) => decodeXmlEntities(match[1])).join(' '),
      );

      if (!text) {
        return null;
      }

      return {
        text,
        level: matchNumericValue(paragraphXml, /<a:pPr\b[^>]*\blvl="(\d+)"/i) ?? 0,
        fontSize: resolvePowerPointParagraphFontSize(paragraphXml, placeholderType),
        bold: /<(?:a:rPr|a:defRPr)\b[^>]*\bb="1"/i.test(paragraphXml),
        color: resolvePowerPointTextColor(paragraphXml, theme, placeholderType),
      } satisfies PowerPointTextParagraph;
    })
    .filter((paragraph): paragraph is PowerPointTextParagraph => Boolean(paragraph));
}

function resolvePowerPointShapeBounds(shapeXml: string, canvas: PowerPointCanvas, placeholderType: string | null, shapeIndex: number) {
  const x = matchNumericValue(shapeXml, /<a:off\b[^>]*\bx="(\d+)"/i);
  const y = matchNumericValue(shapeXml, /<a:off\b[^>]*\by="(\d+)"/i);
  const width = matchNumericValue(shapeXml, /<a:ext\b[^>]*\bcx="(\d+)"/i);
  const height = matchNumericValue(shapeXml, /<a:ext\b[^>]*\bcy="(\d+)"/i);

  if (x !== null && y !== null && width !== null && height !== null) {
    return {
      x: Math.round(x * canvas.scaleX),
      y: Math.round(y * canvas.scaleY),
      width: Math.max(Math.round(width * canvas.scaleX), 120),
      height: Math.max(Math.round(height * canvas.scaleY), 72),
    };
  }

  if (placeholderType === 'title' || placeholderType === 'ctrTitle') {
    return {
      x: 96,
      y: 88,
      width: canvas.width - 192,
      height: 132,
    };
  }

  if (placeholderType === 'subTitle') {
    return {
      x: 118,
      y: 220,
      width: canvas.width - 236,
      height: 92,
    };
  }

  return {
    x: 116,
    y: Math.min(248 + shapeIndex * 72, canvas.height - 220),
    width: canvas.width - 232,
    height: Math.max(canvas.height - 320 - shapeIndex * 14, 160),
  };
}

function resolvePowerPointParagraphFontSize(paragraphXml: string, placeholderType: string | null) {
  const rawSize = matchNumericValue(paragraphXml, /<(?:a:rPr|a:defRPr|a:endParaRPr)\b[^>]*\bsz="(\d+)"/i);
  if (rawSize !== null) {
    return clamp((rawSize / 100) * (96 / 72), 14, 44);
  }

  if (placeholderType === 'title' || placeholderType === 'ctrTitle') {
    return DEFAULT_TITLE_FONT_SIZE;
  }

  if (placeholderType === 'subTitle') {
    return DEFAULT_SUBTITLE_FONT_SIZE;
  }

  return DEFAULT_BODY_FONT_SIZE;
}

function resolvePowerPointTextColor(paragraphXml: string, theme: PowerPointTheme, placeholderType: string | null) {
  const resolvedColor = resolveXmlColor(paragraphXml, theme);
  if (resolvedColor) {
    return resolvedColor;
  }

  if (placeholderType === 'title' || placeholderType === 'ctrTitle') {
    return theme.textColor;
  }

  return '#334155';
}

function resolvePowerPointShapeFillColor(shapeXml: string, theme: PowerPointTheme) {
  const shapeProperties = matchTagBlock(shapeXml, 'p:spPr');
  return shapeProperties ? resolveXmlColor(shapeProperties, theme) : null;
}

function resolvePowerPointSlideTitle(textShapes: PowerPointTextShape[], slideLines: string[], slideIndex: number) {
  const titleShape = textShapes.find((shape) => shape.placeholderType === 'title' || shape.placeholderType === 'ctrTitle');
  const titleFromShape = titleShape?.paragraphs[0]?.text;
  if (titleFromShape) {
    return titleFromShape;
  }

  const firstTextShape = textShapes.find((shape) => shape.paragraphs.length > 0)?.paragraphs[0]?.text;
  if (firstTextShape) {
    return firstTextShape;
  }

  return slideLines[0] ?? `Slide ${slideIndex + 1}`;
}

function resolvePowerPointSlideBulletPoints(textShapes: PowerPointTextShape[], slideLines: string[], title: string) {
  const normalizedTitle = normalizeWhitespace(title).toLowerCase();
  const resolvedPoints: string[] = [];

  for (const shape of textShapes) {
    for (let index = 0; index < shape.paragraphs.length; index += 1) {
      const paragraph = shape.paragraphs[index];
      const normalizedParagraph = normalizeWhitespace(paragraph.text).toLowerCase();

      if (!normalizedParagraph || normalizedParagraph === normalizedTitle) {
        continue;
      }

      if ((shape.placeholderType === 'title' || shape.placeholderType === 'ctrTitle') && index === 0) {
        continue;
      }

      if (!resolvedPoints.some((point) => normalizeWhitespace(point).toLowerCase() === normalizedParagraph)) {
        resolvedPoints.push(paragraph.text);
      }

      if (resolvedPoints.length >= MAX_PREVIEW_BULLETS) {
        return resolvedPoints;
      }
    }
  }

  return slideLines
    .filter((line) => normalizeWhitespace(line).toLowerCase() !== normalizedTitle)
    .slice(0, MAX_PREVIEW_BULLETS);
}

function resolvePowerPointSlideBackgroundColor(slideXml: string, theme: PowerPointTheme) {
  const backgroundProperties = matchTagBlock(slideXml, 'p:bgPr');
  return backgroundProperties ? resolveXmlColor(backgroundProperties, theme) ?? theme.backgroundColor : theme.backgroundColor;
}

function renderPowerPointSlidePreview(input: {
  backgroundColor: string;
  canvas: PowerPointCanvas;
  slideIndex: number;
  textShapes: PowerPointTextShape[];
  theme: PowerPointTheme;
  title: string;
  bulletPoints: string[];
}) {
  const shapes = input.textShapes.length ? input.textShapes : buildFallbackPowerPointShapes(input.canvas, input.theme, input.title, input.bulletPoints);
  const backgroundColor = input.backgroundColor;
  const accentColor = input.theme.accentColor;
  const surfaceColor = toRgbaString(isDarkColor(backgroundColor) ? '#FFFFFF' : '#FFFFFF', isDarkColor(backgroundColor) ? 0.08 : 0.5);
  const surfaceStroke = toRgbaString(accentColor, 0.16);
  const markup = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${input.canvas.width} ${input.canvas.height}" width="${input.canvas.width}" height="${input.canvas.height}">`,
    `<rect width="100%" height="100%" fill="${backgroundColor}"/>`,
    `<rect width="100%" height="28" fill="${accentColor}" opacity="0.94"/>`,
    `<rect x="32" y="46" width="${input.canvas.width - 64}" height="${input.canvas.height - 78}" rx="28" fill="${surfaceColor}" stroke="${surfaceStroke}" stroke-width="2"/>`,
  ];

  for (const shape of shapes) {
    const shapeFillColor = shape.fillColor && !areColorsSimilar(shape.fillColor, backgroundColor) ? shape.fillColor : null;
    if (shapeFillColor) {
      markup.push(
        `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="22" fill="${shapeFillColor}" opacity="0.96"/>`,
      );
    }

    markup.push(renderPowerPointShapeMarkup(shape, shapeFillColor ?? backgroundColor, input.theme.textColor));
  }

  markup.push(
    `<text x="${input.canvas.width - 48}" y="${input.canvas.height - 28}" fill="${toRgbaString(input.theme.textColor, 0.42)}" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="20" text-anchor="end">Slide ${input.slideIndex + 1}</text>`,
    '</svg>',
  );

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup.join(''))}`;
}

function buildFallbackPowerPointShapes(canvas: PowerPointCanvas, theme: PowerPointTheme, title: string, bulletPoints: string[]) {
  return [
    {
      x: 96,
      y: 96,
      width: canvas.width - 192,
      height: 132,
      placeholderType: 'title',
      fillColor: null,
      paragraphs: [{ text: title, level: 0, fontSize: DEFAULT_TITLE_FONT_SIZE, bold: true, color: theme.textColor }],
    },
    {
      x: 118,
      y: 252,
      width: canvas.width - 236,
      height: canvas.height - 340,
      placeholderType: 'body',
      fillColor: null,
      paragraphs: (bulletPoints.length ? bulletPoints : ['No slide text was detected for this slide.']).map((point) => ({
        text: point,
        level: 0,
        fontSize: DEFAULT_BODY_FONT_SIZE,
        bold: false,
        color: '#334155',
      })),
    },
  ] satisfies PowerPointTextShape[];
}

function renderPowerPointShapeMarkup(shape: PowerPointTextShape, surfaceColor: string, fallbackTextColor: string) {
  const contentX = shape.x + TEXT_BOX_PADDING;
  const maxY = shape.y + shape.height - TEXT_BOX_PADDING;
  const lines: string[] = [];
  let currentY = shape.y + TEXT_BOX_PADDING;

  for (const paragraph of shape.paragraphs) {
    const fontSize = clamp(paragraph.fontSize, 14, shape.placeholderType === 'title' || shape.placeholderType === 'ctrTitle' ? 44 : 28);
    const lineHeight = fontSize * 1.28;
    const indent = Math.min(paragraph.level, 4) * 30;
    const shouldUseBullet = shape.placeholderType === 'body' || shape.placeholderType === 'obj';
    const paragraphText = shouldUseBullet ? `${'  '.repeat(Math.min(paragraph.level, 2))}• ${paragraph.text}` : paragraph.text;
    const availableWidth = Math.max(shape.width - TEXT_BOX_PADDING * 2 - indent, 120);
    const wrappedLines = wrapTextToLines(paragraphText, availableWidth, fontSize);
    const fill = resolveReadableTextColor(paragraph.color, surfaceColor, fallbackTextColor);

    for (let lineIndex = 0; lineIndex < wrappedLines.length; lineIndex += 1) {
      if (currentY + fontSize > maxY) {
        const truncatedLine = truncateTextToFit(wrappedLines[lineIndex], availableWidth, fontSize);
        if (truncatedLine) {
          lines.push(
            `<text x="${contentX + indent}" y="${currentY + fontSize}" fill="${fill}" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="${paragraph.bold ? 700 : 500}">${escapeSvgText(truncatedLine)}</text>`,
          );
        }

        return lines.join('');
      }

      lines.push(
        `<text x="${contentX + indent}" y="${currentY + fontSize}" fill="${fill}" font-family="Aptos, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="${paragraph.bold ? 700 : shape.placeholderType === 'title' || shape.placeholderType === 'ctrTitle' ? 800 : 500}">${escapeSvgText(wrappedLines[lineIndex])}</text>`,
      );
      currentY += lineHeight;
    }

    currentY += fontSize * 0.18;
    if (currentY > maxY) {
      break;
    }
  }

  return lines.join('');
}

function buildPowerPointSlideAltText(title: string, bulletPoints: string[], slideIndex: number) {
  return bulletPoints.length
    ? `Slide ${slideIndex + 1}: ${title}. Key points: ${bulletPoints.join('; ')}.`
    : `Slide ${slideIndex + 1}: ${title}.`;
}

function extractPowerPointSlideLines(slideXml: string) {
  const paragraphBlocks = Array.from(slideXml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g), (match) => match[0]);
  const lines = paragraphBlocks
    .map((paragraph) => Array.from(paragraph.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g), (match) => decodeXmlEntities(match[1])).join('').trim())
    .filter(Boolean);

  if (lines.length) {
    return lines;
  }

  return Array.from(slideXml.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g), (match) => decodeXmlEntities(match[1]).trim()).filter(Boolean);
}

function matchTagBlock(source: string, tagName: string) {
  if (!source) {
    return '';
  }

  return source.match(new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'i'))?.[0] ?? '';
}

function matchNumericValue(source: string, pattern: RegExp) {
  const match = source.match(pattern);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function resolveXmlColor(source: string, theme: PowerPointTheme) {
  const directColor = extractDirectColor(source);
  if (directColor) {
    return directColor;
  }

  const themeColorName = source.match(/<a:schemeClr\b[^>]*\bval="([^"]+)"/i)?.[1];
  return themeColorName ? resolveThemeColor(theme, themeColorName) : null;
}

function extractDirectColor(source: string) {
  const rgbColor = source.match(/<a:srgbClr\b[^>]*\bval="([0-9a-f]{6})"/i)?.[1];
  if (rgbColor) {
    return `#${rgbColor.toUpperCase()}`;
  }

  const systemColor = source.match(/<a:sysClr\b[^>]*\blastClr="([0-9a-f]{6})"/i)?.[1];
  if (systemColor) {
    return `#${systemColor.toUpperCase()}`;
  }

  const presetColor = source.match(/<a:prstClr\b[^>]*\bval="([^"]+)"/i)?.[1]?.toLowerCase();
  return presetColor ? PRESET_COLOR_MAP[presetColor] ?? null : null;
}

function resolveThemeColor(theme: PowerPointTheme, themeColorName: string) {
  const normalizedThemeColor = themeColorName.trim();

  switch (normalizedThemeColor) {
    case 'bg1':
      return theme.colors.get('lt1') ?? theme.backgroundColor;
    case 'bg2':
      return theme.colors.get('lt2') ?? theme.backgroundColor;
    case 'tx1':
      return theme.colors.get('dk1') ?? theme.textColor;
    case 'tx2':
      return theme.colors.get('dk2') ?? theme.textColor;
    default:
      return theme.colors.get(normalizedThemeColor) ?? theme.textColor;
  }
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function wrapTextToLines(text: string, maxWidth: number, fontSize: number) {
  const normalizedText = normalizeWhitespace(text);
  if (!normalizedText) {
    return [];
  }

  const maxCharactersPerLine = Math.max(10, Math.floor(maxWidth / (fontSize * 0.56)));
  const words = normalizedText.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidateLine = currentLine ? `${currentLine} ${word}` : word;
    if (candidateLine.length <= maxCharactersPerLine || !currentLine) {
      currentLine = candidateLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    while (currentLine.length > maxCharactersPerLine) {
      lines.push(`${currentLine.slice(0, maxCharactersPerLine - 1)}-`);
      currentLine = currentLine.slice(maxCharactersPerLine - 1);
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function truncateTextToFit(text: string, maxWidth: number, fontSize: number) {
  const maxCharacters = Math.max(6, Math.floor(maxWidth / (fontSize * 0.56)));
  if (text.length <= maxCharacters) {
    return text;
  }

  return `${text.slice(0, Math.max(maxCharacters - 1, 1)).trimEnd()}…`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveReadableTextColor(textColor: string, surfaceColor: string, fallbackTextColor: string) {
  const candidateColor = normalizeHexColor(textColor) ?? normalizeHexColor(fallbackTextColor) ?? '#0F172A';
  const resolvedSurface = normalizeHexColor(surfaceColor) ?? '#FFFFFF';

  return contrastRatio(candidateColor, resolvedSurface) >= 3 ? candidateColor : isDarkColor(resolvedSurface) ? '#FFFFFF' : '#0F172A';
}

function normalizeHexColor(color: string | null | undefined) {
  if (!color) {
    return null;
  }

  const normalizedColor = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(normalizedColor)) {
    return normalizedColor.toUpperCase();
  }

  return null;
}

function contrastRatio(leftColor: string, rightColor: string) {
  const leftLuminance = relativeLuminance(leftColor);
  const rightLuminance = relativeLuminance(rightColor);
  const lightest = Math.max(leftLuminance, rightLuminance);
  const darkest = Math.min(leftLuminance, rightLuminance);
  return (lightest + 0.05) / (darkest + 0.05);
}

function relativeLuminance(color: string) {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return 1;
  }

  const [red, green, blue] = [rgb.red, rgb.green, rgb.blue].map((channel) => {
    const normalizedChannel = channel / 255;
    return normalizedChannel <= 0.03928 ? normalizedChannel / 12.92 : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function isDarkColor(color: string) {
  return relativeLuminance(color) < 0.45;
}

function areColorsSimilar(leftColor: string, rightColor: string) {
  const leftRgb = hexToRgb(leftColor);
  const rightRgb = hexToRgb(rightColor);
  if (!leftRgb || !rightRgb) {
    return false;
  }

  const distance = Math.abs(leftRgb.red - rightRgb.red) + Math.abs(leftRgb.green - rightRgb.green) + Math.abs(leftRgb.blue - rightRgb.blue);
  return distance < 30;
}

function hexToRgb(color: string) {
  const normalizedColor = normalizeHexColor(color);
  if (!normalizedColor) {
    return null;
  }

  return {
    red: Number.parseInt(normalizedColor.slice(1, 3), 16),
    green: Number.parseInt(normalizedColor.slice(3, 5), 16),
    blue: Number.parseInt(normalizedColor.slice(5, 7), 16),
  };
}

function toRgbaString(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return color;
  }

  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${alpha})`;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}