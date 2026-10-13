import type { DropdownOption } from '../types';

/** Keys selectable in key blocks; values match the runtime's normalized key names. */
export const KEY_OPTIONS: readonly DropdownOption[] = [
  { value: 'Space', text: { de: 'Leertaste', en: 'space' } },
  { value: 'ArrowUp', text: { de: 'Pfeil nach oben', en: 'up arrow' } },
  { value: 'ArrowDown', text: { de: 'Pfeil nach unten', en: 'down arrow' } },
  { value: 'ArrowLeft', text: { de: 'Pfeil nach links', en: 'left arrow' } },
  { value: 'ArrowRight', text: { de: 'Pfeil nach rechts', en: 'right arrow' } },
  { value: 'any', text: { de: 'beliebige', en: 'any' } },
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    .split('')
    .map((key) => ({ value: key, text: { de: key, en: key } })),
  { value: 'Enter', text: { de: 'Eingabe', en: 'enter' } },
  { value: 'Shift', text: { de: 'Umschalt', en: 'shift' } },
];

/** Easing choices of the glide blocks. */
export const EASING_OPTIONS: readonly DropdownOption[] = [
  { value: 'smooth', text: { de: 'weich', en: 'smooth' } },
  { value: 'linear', text: { de: 'linear', en: 'linear' } },
  { value: 'spring', text: { de: 'federnd', en: 'springy' } },
];
