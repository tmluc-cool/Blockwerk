import { parseList } from '@blockwerk/runtime';
import { useState } from 'react';
import { useT } from '../state/settings';
import { setValue, setValues, valuesOf } from './studio';
import type { SectionProps } from './types';
import { SliderRow, StudioGroup } from './widgets';

/** Groups of model parts by the words in their names (SPEC 5.10 builder: hair, clothes …). */
const PART_GROUPS: readonly (readonly [string, RegExp])[] = [
  ['hair', /hair|bangs|ponytail/i],
  ['head', /head|face|eye|nose|mouth|ear/i],
  ['hat', /hat|helm|cap|hood|crown/i],
  ['top', /torso|shirt|jacket|chest|top|armor/i],
  ['pants', /pant|leg|trouser|skirt/i],
  ['shoes', /shoe|boot|foot/i],
  ['gloves', /glove|hand|arm/i],
  ['back', /back|cape|cloak|pack/i],
];

/** The group of a part ("other" if no word matches). */
export function partGroup(name: string): string {
  return PART_GROUPS.find(([, pattern]) => pattern.test(name))?.[0] ?? 'other';
}

/** Color palettes: skin, hair and clothes colors that fit together. */
export const PALETTES: readonly Readonly<Record<'skin' | 'hair' | 'clothes' | 'accent', string>>[] =
  [
    { skin: '#f1c9a5', hair: '#4a3020', clothes: '#3a6ea5', accent: '#c9a227' },
    { skin: '#c68863', hair: '#1c1c1c', clothes: '#a53a3a', accent: '#e8e0d0' },
    { skin: '#8d5a3b', hair: '#6b2d12', clothes: '#3a8f5a', accent: '#d9d9d9' },
    { skin: '#ffe0bd', hair: '#d9b44a', clothes: '#7a4aa5', accent: '#2f2f2f' },
    { skin: '#a8c7a0', hair: '#2d4a3a', clothes: '#d98a2b', accent: '#5a3a1a' },
  ];

/** The slot of a part for a palette (skin for body parts, hair, clothes or accent). */
function paletteSlot(group: string): 'skin' | 'hair' | 'clothes' | 'accent' {
  if (group === 'head' || group === 'other') return 'skin';
  if (group === 'hair') return 'hair';
  if (group === 'shoes' || group === 'gloves' || group === 'back' || group === 'hat') {
    return 'accent';
  }
  return 'clothes';
}

/** Section "Builder": which parts are shown, and the body sliders. */
export function BuilderSection({ id, object, info }: SectionProps) {
  const t = useT();
  const values = valuesOf(object, 'character');
  const hidden = new Set(
    String(values['hiddenParts'] ?? '')
      .split(';')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const parts = info?.parts ?? [];
  const gear = new Set(info?.gear ?? []);
  const shownGear = new Set(
    String(values['shownGear'] ?? '')
      .split(';')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  /** Body parts are shown unless hidden; loose gear is hidden unless shown. */
  const isShown = (part: string): boolean =>
    gear.has(part) ? shownGear.has(part) && !hidden.has(part) : !hidden.has(part);
  const toggle = (part: string): void => {
    const on = !isShown(part);
    const nextHidden = new Set(hidden);
    const nextShown = new Set(shownGear);
    if (on) {
      nextHidden.delete(part);
      nextShown.add(part);
    } else {
      nextHidden.add(part);
      nextShown.delete(part);
    }
    setValues(id, 'character', {
      hiddenParts: [...nextHidden].join(';'),
      shownGear: [...nextShown].join(';'),
    });
  };
  const slider = (field: string, label: string, min: number, max: number) => (
    <SliderRow
      label={label}
      value={Number(values[field] ?? 1)}
      min={min}
      max={max}
      step={0.05}
      testId={`studio-${field}`}
      onChange={(value) => setValue(id, 'character', field, value)}
    />
  );
  return (
    <div className="studio-section" data-testid="studio-section-builder">
      <StudioGroup title={t('studio.builder.parts')}>
        {parts.length === 0 && <p className="muted">{t('studio.loading')}</p>}
        <ul className="studio-parts" data-testid="studio-parts">
          {parts.map((part) => (
            <li key={part}>
              <label>
                <input
                  type="checkbox"
                  checked={isShown(part)}
                  data-testid={`part-${part}`}
                  onChange={() => toggle(part)}
                />
                <span>{part}</span>
                <span className="muted">{t(`studio.group.${partGroup(part)}` as never)}</span>
              </label>
            </li>
          ))}
        </ul>
      </StudioGroup>
      <StudioGroup title={t('studio.builder.body')}>
        {slider('build', t('studio.builder.build'), 0.6, 1.6)}
        {slider('headScale', t('studio.builder.head'), 0.6, 1.8)}
        {slider('armScale', t('studio.builder.arms'), 0.7, 1.5)}
        {slider('legScale', t('studio.builder.legs'), 0.7, 1.5)}
        <button
          type="button"
          data-testid="studio-body-reset"
          onClick={() =>
            setValues(id, 'character', { build: 1, headScale: 1, armScale: 1, legScale: 1 })
          }
        >
          {t('studio.builder.reset')}
        </button>
      </StudioGroup>
    </div>
  );
}

/** Section "Colors": a color per part, ready-made palettes and the dice. */
export function ColorsSection({ id, object, info }: SectionProps) {
  const t = useT();
  const values = valuesOf(object, 'character');
  const tints = new Map(parseList(String(values['tints'] ?? '')));
  const [palette, setPalette] = useState<number | null>(null);
  const parts = info?.parts ?? [];
  const write = (next: ReadonlyMap<string, string>): void =>
    setValue(
      id,
      'character',
      'tints',
      [...next].map(([part, color]) => `${part}=${color}`).join(';'),
    );
  const apply = (index: number): void => {
    const colors = PALETTES[index];
    if (!colors) return;
    setPalette(index);
    const next = new Map<string, string>();
    for (const part of parts) next.set(part, colors[paletteSlot(partGroup(part))]);
    write(next);
  };
  return (
    <div className="studio-section" data-testid="studio-section-colors">
      <StudioGroup title={t('studio.colors.palettes')}>
        <div className="studio-palettes">
          {PALETTES.map((colors, index) => (
            <button
              key={colors.skin + colors.clothes}
              type="button"
              className={`palette${palette === index ? ' active' : ''}`}
              data-testid={`palette-${index}`}
              onClick={() => apply(index)}
            >
              {Object.values(colors).map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </button>
          ))}
          <button
            type="button"
            data-testid="studio-dice"
            title={t('studio.colors.random')}
            onClick={() => apply(Math.floor(Math.random() * PALETTES.length))}
          >
            🎲
          </button>
          <button type="button" data-testid="studio-colors-clear" onClick={() => write(new Map())}>
            {t('studio.colors.clear')}
          </button>
        </div>
      </StudioGroup>
      <StudioGroup title={t('studio.colors.parts')}>
        <ul className="studio-parts">
          {parts.map((part) => (
            <li key={part}>
              <label>
                <input
                  type="color"
                  value={tints.get(part) ?? '#ffffff'}
                  data-testid={`color-${part}`}
                  onChange={(event) => write(new Map(tints).set(part, event.target.value))}
                />
                <span>{part}</span>
              </label>
            </li>
          ))}
        </ul>
      </StudioGroup>
    </div>
  );
}
