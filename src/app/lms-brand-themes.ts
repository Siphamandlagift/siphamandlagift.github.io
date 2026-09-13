import type { LmsBrandThemeId } from './lms-backend.service';

export type { LmsBrandThemeId } from './lms-backend.service';

export type LmsBrandThemeOption = {
  id: LmsBrandThemeId;
  label: string;
  copy: string;
  primary: string;
  secondary: string;
  tint: string;
  surface: string;
};

// Shared by LmsBrandingService (every company's own branding picker) and the Super Admin
// dashboard (the one platform-wide login screen's branding picker) — same fixed palette, same
// swatch preview, just applied to a different branding record underneath.
export const LMS_BRAND_THEME_OPTIONS: ReadonlyArray<LmsBrandThemeOption> = [
  {
    id: 'ocean',
    label: 'Ocean Blue',
    copy: 'A single blue theme for a calm executive workspace.',
    primary: '#2563eb',
    secondary: '#2563eb',
    tint: '#dbeafe',
    surface: '#eff6ff',
  },
  {
    id: 'forest',
    label: 'Forest Teal',
    copy: 'A single teal theme for steady platform operations.',
    primary: '#0f766e',
    secondary: '#0f766e',
    tint: '#ccfbf1',
    surface: '#f0fdfa',
  },
  {
    id: 'sunrise',
    label: 'Sunrise Coral',
    copy: 'A single orange theme for a warmer admin view.',
    primary: '#ea580c',
    secondary: '#ea580c',
    tint: '#ffedd5',
    surface: '#fff7ed',
  },
  {
    id: 'purple',
    label: 'Royal Purple',
    copy: 'A single purple theme for a richer workspace mood.',
    primary: '#7c3aed',
    secondary: '#7c3aed',
    tint: '#ede9fe',
    surface: '#f5f3ff',
  },
  {
    id: 'black',
    label: 'Carbon Black',
    copy: 'A single near-black theme for a sharper executive look.',
    primary: '#111827',
    secondary: '#111827',
    tint: '#e5e7eb',
    surface: '#f3f4f6',
  },
  {
    id: 'grey',
    label: 'Slate Grey',
    copy: 'A single grey theme for a neutral, understated workspace.',
    primary: '#6b7280',
    secondary: '#6b7280',
    tint: '#e5e7eb',
    surface: '#f9fafb',
  },
];
