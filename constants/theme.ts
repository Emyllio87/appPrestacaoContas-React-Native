export const COLORS = {
  primary: '#1E40AF',
  primaryLight: '#EFF6FF',
  onPrimary: '#FFFFFF',
  success: '#16A34A',
  successLight: '#F0FDF4',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  background: '#F3F4F6',
  surface: '#FFFFFF',
  border: '#D1D5DB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
};

export const FONT = {
  h1: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h2: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  h3: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  title: { fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyStrong: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  captionStrong: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
  small: { fontSize: 10, fontWeight: '400' as const, lineHeight: 14 },
  smallStrong: { fontSize: 10, fontWeight: '600' as const, lineHeight: 14 },
};

export const TYPOGRAPHY = FONT;

export const CARD = {
  backgroundColor: COLORS.surface,
  borderRadius: RADIUS.lg,
  ...SHADOW.sm,
};

export const BUTTON = {
  borderRadius: RADIUS.pill,
  paddingVertical: SPACING.sm,
};

export const INPUT = {
  borderRadius: RADIUS.md,
  backgroundColor: COLORS.surface,
};

export const MODULE_COLORS = {
  prestacoes: '#1E40AF',
  diarias: '#2563EB',
  ordens: '#3B82F6',
  pedidos: '#60A5FA',
};

export function withAlpha(hex: string, alpha: string | number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const opacity = typeof alpha === 'number' ? alpha : parseInt(alpha, 10) / 100;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}