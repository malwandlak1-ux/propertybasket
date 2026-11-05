/**
 * Property Basket design tokens — mirrors resources/css/app.css @theme on the
 * website so the app and site read as one product.
 */
export const colors = {
  brand: '#F26A1B',
  brand50: '#FFF4EC',
  brand100: '#FFE2CC',
  brand600: '#E15A12',
  brand700: '#B8470A',

  ink50: '#F9FAFB',
  ink100: '#F3F4F6',
  ink200: '#E5E7EB',
  ink300: '#D1D5DB',
  ink400: '#9CA3AF',
  ink500: '#6B7280',
  ink700: '#2A2A35',
  ink800: '#1A1A22',
  ink900: '#0B0B0F',

  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',

  sky: '#0EA5E9',
  violet: '#8B5CF6',

  white: '#FFFFFF',
} as const;

export const fonts = {
  // Loaded in App.tsx via @expo-google-fonts.
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
} as const;

/** shadow-soft from the web app (0 4px 12px rgba(15,23,42,.06)). */
export const shadowCard = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 } as const;

export const spacing = (n: number) => n * 4;
