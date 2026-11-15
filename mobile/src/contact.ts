import { Linking } from 'react-native';

/** SA numbers to international digits: 082 123 4567 → 27821234567. */
export function intlDigits(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('27')) return d;
  if (d.startsWith('0')) return '27' + d.slice(1);
  return d;
}

export const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
export const whatsapp = (phone: string) => Linking.openURL(`https://wa.me/${intlDigits(phone)}`);
export const email = (address: string) => Linking.openURL(`mailto:${address}`);
