import type { ThemeName } from '#lib/types/ui.ts';

const THEME_LABELS: Record<ThemeName, string> = {
  dark: 'Dark',
  editor: 'Editor',
  light: 'Light',
  merchant: 'Merchant',
  'gold-luxe': 'Gold Luxe',
  matrix: 'Matrix',
  arctic: 'Arctic',
};

/** Get all available theme names with display labels */
export function getAvailableThemes(): Array<{ id: ThemeName; name: string }> {
  return (Object.entries(THEME_LABELS) as [ThemeName, string][]).map(([id, name]) => ({ id, name }));
}

/** Theme variables live in styles/themes.css under [data-theme]. */
export function applyThemeToDocument(themeName: ThemeName): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', themeName in THEME_LABELS ? themeName : 'dark');

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--theme-background').trim());
  }
}
