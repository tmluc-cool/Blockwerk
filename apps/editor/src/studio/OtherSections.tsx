import { assetDisplayName } from '@blockwerk/project';
import { BUILTIN_SOUNDS, isBuiltinSound, parseList } from '@blockwerk/runtime';
import { useState } from 'react';
import { previewSound } from '../audio/editorAudio';
import { importImageAsset, defaultFolder, useDocument } from '../state/document';
import { useConsole } from '../state/console';
import { useT } from '../state/settings';
import { ensureComponent, setValue, setValues, valuesOf } from './studio';
import type { SectionProps } from './types';
import { SliderRow, StudioGroup } from './widgets';

/** Section "Collision": the capsule around the figure. */
export function CollisionSection({ id, object }: SectionProps) {
  const t = useT();
  const has = object.components.some((component) => component.type === 'characterController');
  if (!has) {
    return (
      <div className="studio-section" data-testid="studio-section-collision">
        <p className="muted">{t('studio.move.noControl')}</p>
        <button
          type="button"
          data-testid="studio-add-controller"
          onClick={() => ensureComponent(id, 'characterController')}
        >
          {t('studio.move.addControl')}
        </button>
      </div>
    );
  }
  const values = valuesOf(object, 'characterController');
  const center = (values['center'] as [number, number, number] | undefined) ?? [0, 0.9, 0];
  const bodyHeight = Number(valuesOf(object, 'character')['bodyHeight'] ?? 1.8);
  const setCenter = (axis: number, value: number): void => {
    const next: [number, number, number] = [center[0], center[1], center[2]];
    next[axis] = value;
    setValue(id, 'characterController', 'center', next);
  };
  return (
    <div className="studio-section" data-testid="studio-section-collision">
      <StudioGroup title={t('studio.collision.capsule')}>
        <SliderRow
          label={t('studio.collision.height')}
          value={Number(values['height'])}
          min={0.4}
          max={4}
          step={0.05}
          unit="m"
          testId="capsule-height"
          onChange={(value) => setValue(id, 'characterController', 'height', value)}
        />
        <SliderRow
          label={t('studio.collision.radius')}
          value={Number(values['radius'])}
          min={0.1}
          max={1.5}
          step={0.05}
          unit="m"
          testId="capsule-radius"
          onChange={(value) => setValue(id, 'characterController', 'radius', value)}
        />
        <SliderRow
          label={t('studio.collision.offsetY')}
          value={center[1]}
          min={0}
          max={3}
          step={0.05}
          unit="m"
          testId="capsule-offset-y"
          onChange={(value) => setCenter(1, value)}
        />
        <SliderRow
          label={t('studio.collision.offsetX')}
          value={center[0]}
          min={-1}
          max={1}
          step={0.05}
          unit="m"
          testId="capsule-offset-x"
          onChange={(value) => setCenter(0, value)}
        />
        <SliderRow
          label={t('studio.collision.offsetZ')}
          value={center[2]}
          min={-1}
          max={1}
          step={0.05}
          unit="m"
          testId="capsule-offset-z"
          onChange={(value) => setCenter(2, value)}
        />
        <button
          type="button"
          data-testid="capsule-fit"
          onClick={() =>
            setValues(id, 'characterController', {
              height: bodyHeight,
              radius: Math.round(((bodyHeight * 0.3) / 1.8) * 100) / 100,
              center: [0, bodyHeight / 2, 0],
            })
          }
        >
          {t('studio.collision.fit')}
        </button>
      </StudioGroup>
    </div>
  );
}

/** Events with a sound in the sound set. */
const SOUND_SLOTS = ['footstep', 'jump', 'land', 'hurt', 'win', 'splash'] as const;

/** Whether a sound reference names a built-in sound or a sound of the project. */
function isKnown(value: string, audio: readonly { id: string }[]): boolean {
  return (
    value === 'none' ||
    isBuiltinSound(value.replace('builtin:', '')) ||
    audio.some((asset) => value === `audio:${asset.id}`)
  );
}

/** Section "Sounds": which sound plays on which event of the figure. */
export function SoundsSection({ id, object }: SectionProps) {
  const t = useT();
  const project = useDocument((state) => state.project);
  const sounds = new Map(parseList(String(valuesOf(object, 'character')['sounds'] ?? '')));
  const write = (slot: string, value: string): void => {
    const next = new Map(sounds);
    if (value) next.set(slot, value);
    else next.delete(slot);
    setValue(
      id,
      'character',
      'sounds',
      [...next].map(([name, sound]) => `${name}=${sound}`).join(';'),
    );
  };
  return (
    <div className="studio-section" data-testid="studio-section-sounds">
      <StudioGroup title={t('studio.sounds.set')}>
        <p className="muted">{t('studio.sounds.hint')}</p>
        {SOUND_SLOTS.map((slot) => {
          const chosen = sounds.get(slot) ?? '';
          const audio = project?.assetsOfType('audio') ?? [];
          return (
            <label className="field-row" key={slot}>
              <span className="field-label">{t(`studio.sound.${slot}` as never)}</span>
              <select
                value={chosen}
                data-testid={`sound-${slot}`}
                onChange={(event) => write(slot, event.target.value)}
              >
                <option value="">{t('studio.sounds.default')}</option>
                <option value="none">{t('sound.none')}</option>
                {chosen && !isKnown(chosen, audio) && <option value={chosen}>{chosen}</option>}
                {BUILTIN_SOUNDS.map((name) => (
                  <option key={name} value={`builtin:${name}`}>
                    {t(`sound.builtin.${name}` as never)}
                  </option>
                ))}
                {audio.map((asset) => (
                  <option key={asset.id} value={`audio:${asset.id}`}>
                    {assetDisplayName(asset.path)}
                  </option>
                ))}
              </select>
              {chosen && chosen !== 'none' && (
                <button type="button" className="small" onClick={() => previewSound(chosen)}>
                  {t('sound.preview')}
                </button>
              )}
            </label>
          );
        })}
      </StudioGroup>
    </div>
  );
}

/** Section "Portrait": a bust picture of the figure, saved as an image in the project. */
export function PortraitSection({ object, stage }: SectionProps) {
  const t = useT();
  const [angle, setAngle] = useState(15);
  const [framing, setFraming] = useState<'bust' | 'body'>('bust');
  const [background, setBackground] = useState<'studio' | 'color' | 'transparent'>('studio');
  const [color, setColor] = useState('#3a4a5a');
  const [created, setCreated] = useState<{ url: string; path: string } | null>(null);
  const create = (): void => {
    const bytes = stage?.portrait({
      angle,
      framing,
      background: background === 'transparent' ? null : background === 'studio' ? '#2a2d33' : color,
      size: 512,
    });
    if (!bytes) return;
    const name = `${object.name ?? t('studio.portrait.name')} ${t('studio.portrait.suffix')}`;
    const entry = importImageAsset(defaultFolder('image'), name, bytes);
    if (!entry) return;
    setCreated({
      url: URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' })),
      path: entry.path,
    });
    useConsole.getState().log('info', 'studio.portrait.created', { path: entry.path });
  };
  return (
    <div className="studio-section" data-testid="studio-section-portrait">
      <StudioGroup title={t('studio.portrait.options')}>
        <SliderRow
          label={t('studio.portrait.angle')}
          value={angle}
          min={-90}
          max={90}
          step={1}
          unit="°"
          testId="portrait-angle"
          onChange={setAngle}
        />
        <label className="field-row">
          <span className="field-label">{t('studio.portrait.framing')}</span>
          <select
            value={framing}
            data-testid="portrait-framing"
            onChange={(event) => setFraming(event.target.value as 'bust' | 'body')}
          >
            <option value="bust">{t('studio.portrait.bust')}</option>
            <option value="body">{t('studio.portrait.body')}</option>
          </select>
        </label>
        <label className="field-row">
          <span className="field-label">{t('studio.portrait.background')}</span>
          <select
            value={background}
            data-testid="portrait-background"
            onChange={(event) => setBackground(event.target.value as typeof background)}
          >
            <option value="studio">{t('studio.portrait.bg.studio')}</option>
            <option value="color">{t('studio.portrait.bg.color')}</option>
            <option value="transparent">{t('studio.portrait.bg.transparent')}</option>
          </select>
          {background === 'color' && (
            <input
              type="color"
              value={color}
              data-testid="portrait-color"
              onChange={(event) => setColor(event.target.value)}
            />
          )}
        </label>
        <button type="button" data-testid="portrait-create" onClick={create}>
          {t('studio.portrait.create')}
        </button>
      </StudioGroup>
      {created && (
        <div className="studio-portrait" data-testid="portrait-result">
          <img src={created.url} alt="" />
          <span className="muted">{t('studio.portrait.saved', { path: created.path })}</span>
        </div>
      )}
    </div>
  );
}
