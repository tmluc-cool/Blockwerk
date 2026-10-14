import { getComponentDefinition, matchClips } from '@blockwerk/runtime';
import type { AnimationState } from '@blockwerk/runtime';
import { useSettings, useT } from '../state/settings';
import { abilityIsOn, setAbilityOn } from './studio';
import type { SectionProps } from './types';

/** Drag-and-drop data type of ability cards. */
export const ABILITY_DRAG_TYPE = 'application/x-blockwerk-ability';

/** The ability cards of the studio: component, input action and the animation it needs. */
export const ABILITY_CARDS = [
  { type: 'doubleJump', input: 'Space ×2', animation: null, icon: '⤴' },
  { type: 'roll', input: 'Q', animation: 'roll', icon: '⟳' },
  { type: 'glide', input: 'Space (hold)', animation: null, icon: '🪂' },
  { type: 'stamina', input: 'Shift', animation: null, icon: '⚡' },
] as const satisfies readonly {
  type: string;
  input: string;
  animation: AnimationState | null;
  icon: string;
}[];

/** Abilities that come with later phases; their cards are shown but cannot be switched on yet. */
export const FUTURE_ABILITIES = ['swim', 'climb', 'wallJump', 'dive', 'carry', 'interact'] as const;

/** The bottom bar: ability cards that are dragged onto the figure or switched on and off. */
export function AbilityBar({ id, object, animator }: SectionProps) {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const clips = matchClips(animator?.clips ?? []);
  return (
    <div className="studio-abilities" data-testid="studio-abilities">
      <span className="studio-abilities-title">{t('studio.abilities')}</span>
      {ABILITY_CARDS.map((card) => {
        const definition = getComponentDefinition(card.type);
        const on = abilityIsOn(object, card.type);
        const missing = card.animation !== null && !clips.has(card.animation);
        return (
          <div
            key={card.type}
            className={`ability-card${on ? ' on' : ''}`}
            draggable
            data-testid={`ability-${card.type}`}
            onDragStart={(event) => {
              event.dataTransfer.setData(ABILITY_DRAG_TYPE, card.type);
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <span className={`ability-icon ability-${card.type}`} aria-hidden="true">
              {card.icon}
            </span>
            <strong>{definition?.text[locale] ?? card.type}</strong>
            <span className="muted">{card.input}</span>
            {missing && (
              <span className="warn" title={t('studio.abilities.missingAnimation')}>
                {t('studio.abilities.missing')}
              </span>
            )}
            <label>
              <input
                type="checkbox"
                checked={on}
                data-testid={`ability-toggle-${card.type}`}
                onChange={(event) => setAbilityOn(id, card.type, event.target.checked)}
              />
              <span className="muted">{t('studio.abilities.on')}</span>
            </label>
          </div>
        );
      })}
      {FUTURE_ABILITIES.map((name) => (
        <div key={name} className="ability-card disabled" title={t('studio.abilities.later')}>
          <strong>{t(`studio.ability.${name}` as never)}</strong>
          <span className="muted">{t('studio.abilities.later')}</span>
        </div>
      ))}
    </div>
  );
}
