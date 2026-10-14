import { importModelFiles, isModelFile } from '../library/importModel';
import { draggedLibraryEntry, endLibraryDrag } from '../library/drag';
import { libraryRef } from '../library/assetLibrary';
import type { IDockviewPanelProps } from 'dockview-react';
import type { AnimatorHandle, FigureInfo } from '@blockwerk/runtime';
import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { playInTestArea } from '../testArea/playTestArea';
import { useDocument } from '../state/document';
import { useEditor } from '../state/editor';
import { useT } from '../state/settings';
import { ABILITY_DRAG_TYPE, AbilityBar } from '../studio/AbilityBar';
import { AnimationsPanel } from '../studio/AnimationsPanel';
import { BuilderSection, ColorsSection } from '../studio/BodySections';
import { CameraPreview } from '../studio/CameraPreview';
import { EquipmentSection, suggestedPoint, writeAttachments } from '../studio/EquipmentSection';
import { ModelSection } from '../studio/ModelSection';
import { MovementSection } from '../studio/MovementSection';
import { CollisionSection, PortraitSection, SoundsSection } from '../studio/OtherSections';
import { setCurrentStage, StageViewport } from '../studio/StudioStage';
import type { StageOverlays } from '../studio/StudioStage';
import {
  figureCandidates,
  makeFigure,
  resolveTarget,
  setAbilityOn,
  setValue,
  STUDIO_SECTIONS,
  useStudio,
  valuesOf,
} from '../studio/studio';
import type { StudioSection } from '../studio/studio';
import type { SectionProps } from '../studio/types';
import { parseAttachments } from '@blockwerk/runtime';
import { createPlayerTwo, saveFigureToMine } from '../studio/figurePrefabs';
import { useConsole } from '../state/console';
import { objectName } from '../scene/worlds';

const SECTIONS = {
  model: ModelSection,
  builder: BuilderSection,
  colors: ColorsSection,
  equipment: EquipmentSection,
  movement: MovementSection,
  collision: CollisionSection,
  sounds: SoundsSection,
  portrait: PortraitSection,
} as const;

/** Overlays of the turntable computed from the figure's components. */
function overlaysOf(props: Pick<SectionProps, 'object'>): StageOverlays {
  const { object } = props;
  const control = object.components.find((component) => component.type.endsWith('Control'));
  const controlValues = control ? valuesOf(object, control.type) : null;
  const hasController = object.components.some((c) => c.type === 'characterController');
  const controller = valuesOf(object, 'characterController');
  const center = (controller['center'] as [number, number, number] | undefined) ?? [0, 0.9, 0];
  return {
    jump: controlValues
      ? {
          jumpHeight: Number(controlValues['jumpHeight']),
          gravity: Number(controlValues['gravity']),
          walkSpeed: Number(controlValues['walkSpeed']),
          runSpeed: Number(controlValues['runSpeed']),
          snapDistance: Number(controller['snapDistance'] ?? 0.3),
        }
      : null,
    capsule: hasController
      ? {
          height: Number(controller['height']),
          radius: Number(controller['radius']),
          center: [center[0], center[1], center[2]],
        }
      : null,
    referenceHeight: 1.8,
    obstacles: true,
  };
}

/**
 * Character Studio (SPEC 5.10): everything about a figure in one view. A graphical interface
 * over the same components the Inspector shows; every change is an ordinary scene edit.
 */
export function FigurePanel({ api }: IDockviewPanelProps) {
  const t = useT();
  const scene = useDocument((state) => state.scene);
  const targetId = useStudio((state) => state.targetId);
  const section = useStudio((state) => state.section);
  const animation = useStudio((state) => state.animation);
  const speed = useStudio((state) => state.speed);
  const loop = useStudio((state) => state.loop);
  const hostRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<StageViewport | null>(null);
  const [info, setInfo] = useState<FigureInfo | null>(null);
  const [animator, setAnimator] = useState<AnimatorHandle | null>(null);
  const [spin, setSpin] = useState(false);

  const id = resolveTarget(scene, targetId);
  const object = scene && id ? scene.objects[id] : undefined;
  const candidates = scene ? figureCandidates(scene) : [];
  const isFigure = object?.components.some((component) => component.type === 'character');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const viewport = new StageViewport(host, {
      figure: (nextInfo, nextAnimator) => {
        setInfo(nextInfo);
        setAnimator(nextAnimator);
      },
    });
    setStage(viewport);
    setCurrentStage(viewport);
    const resize = (): void => viewport.resize(host.clientWidth, host.clientHeight);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const dimensions = api.onDidDimensionsChange(resize);
    return () => {
      observer.disconnect();
      dimensions.dispose();
      viewport.dispose();
      setStage(null);
    };
  }, [api]);

  const bodyHeight = object ? Number(valuesOf(object, 'character')['bodyHeight'] ?? 1.8) : 1.8;
  useEffect(() => {
    void stage?.show(isFigure && object ? object : null, bodyHeight);
  }, [stage, object, isFigure, bodyHeight]);
  useEffect(() => {
    if (animator) stage?.play(animation, speed, loop);
  }, [stage, animator, animation, speed, loop]);
  useEffect(() => {
    if (object) stage?.setOverlays(overlaysOf({ object }));
  }, [stage, object]);
  useEffect(() => {
    stage?.setSpin(spin);
  }, [stage, spin]);

  const drop = (event: DragEvent): void => {
    event.preventDefault();
    if (!id || !object) return;
    const ability = event.dataTransfer.getData(ABILITY_DRAG_TYPE);
    if (ability) {
      setAbilityOn(id, ability, true);
      return;
    }
    const files = [...event.dataTransfer.files].filter((file) => isModelFile(file.name));
    if (files.length > 0) {
      void importModelFiles(files).then((assets) => {
        const first = assets[0];
        if (first) setValue(id, 'character', 'model', first.id);
      });
      return;
    }
    const entry = draggedLibraryEntry();
    endLibraryDrag();
    if (!entry) return;
    if (entry.category === 'characters' && entry.animations.length > 0) {
      setValue(id, 'character', 'model', libraryRef(entry));
    } else {
      const point = suggestedPoint(entry);
      const attached = parseAttachments(String(valuesOf(object, 'character')['attachments'] ?? ''));
      writeAttachments(id, [
        ...attached.filter(([, at]) => at !== point),
        [libraryRef(entry), point],
      ]);
    }
  };

  const props: SectionProps | null = id && object ? { id, object, info, animator, stage } : null;
  const Section = SECTIONS[section];

  return (
    <div className="panel studio" data-testid="studio">
      <div className="panel-toolbar">
        <label className="toolbar-field">
          <span className="muted">{t('studio.figure')}</span>
          <select
            value={id ?? ''}
            data-testid="studio-figure"
            onChange={(event) => useStudio.getState().setTarget(event.target.value || null)}
          >
            {candidates.length === 0 && <option value="">{t('studio.noFigure')}</option>}
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        {id && object && !isFigure && (
          <button type="button" data-testid="studio-make-figure" onClick={() => makeFigure(id)}>
            {t('studio.makeFigure')}
          </button>
        )}
        <button
          type="button"
          className={spin ? 'toggled' : ''}
          aria-pressed={spin}
          data-testid="studio-spin"
          onClick={() => setSpin(!spin)}
        >
          {t('studio.spin')}
        </button>
        <button
          type="button"
          disabled={!id || !isFigure}
          data-testid="studio-player2"
          onClick={() => {
            if (!id || !object) return;
            if (createPlayerTwo(id, info?.parts ?? [])) {
              useConsole
                .getState()
                .log('info', 'studio.player2Done', { name: objectName(object, id) });
            }
          }}
        >
          {t('studio.player2')}
        </button>
        <button
          type="button"
          disabled={!id || !isFigure}
          data-testid="studio-save-mine"
          onClick={() => {
            if (!id || !object) return;
            void saveFigureToMine(id).then((saved) => {
              if (saved) {
                useConsole
                  .getState()
                  .log('info', 'studio.savedMine', { name: objectName(object, id) });
              }
            });
          }}
        >
          {t('studio.saveMine')}
        </button>
        <span className="toolbar-spacer" />
        <button
          type="button"
          disabled={!id}
          data-testid="studio-test-area"
          onClick={() => {
            if (id) useEditor.getState().setSelection([id]);
            playInTestArea();
          }}
        >
          {t('studio.testArea')}
        </button>
      </div>
      <div className="studio-body">
        <nav className="studio-nav" data-testid="studio-nav">
          {STUDIO_SECTIONS.map((name: StudioSection) => (
            <button
              key={name}
              type="button"
              className={section === name ? 'active' : ''}
              aria-pressed={section === name}
              data-testid={`studio-tab-${name}`}
              onClick={() => useStudio.getState().setSection(name)}
            >
              {t(`studio.section.${name}` as never)}
            </button>
          ))}
        </nav>
        <div className="studio-left" data-testid="studio-left">
          {props ? (
            <Section {...props} />
          ) : (
            <p className="muted" data-testid="studio-empty">
              {t('studio.empty')}
            </p>
          )}
        </div>
        <div
          className="studio-stage viewport-host"
          ref={hostRef}
          data-testid="studio-stage"
          onDragOver={(event) => event.preventDefault()}
          onDrop={drop}
        />
        <div className="studio-right">
          {props && <AnimationsPanel {...props} />}
          {scene && <CameraPreview scene={scene} stage={stage} />}
        </div>
      </div>
      {props && <AbilityBar {...props} />}
    </div>
  );
}
