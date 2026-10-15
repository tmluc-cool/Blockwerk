import { TERRAIN_LAYERS } from '@blockwerk/runtime';
import type { TerrainTool } from '@blockwerk/runtime';
import { Mountain } from 'lucide-react';
import { useDocument } from '../state/document';
import { usePlay } from '../state/play';
import { useT } from '../state/settings';
import { NumberInput } from '../panels/inspector/fields';
import type { TranslationKey } from '../i18n';
import {
  assignTerrain,
  changeTerrain,
  createTerrainAsset,
  TERRAIN_TOOL_ORDER,
} from './terrainEditing';
import { useTerrainTool } from './terrainTool';

const TOOL_NAMES: Readonly<Record<TerrainTool, TranslationKey>> = {
  raise: 'terrain.tool.raise',
  lower: 'terrain.tool.lower',
  smooth: 'terrain.tool.smooth',
  flatten: 'terrain.tool.flatten',
  paint: 'terrain.tool.paint',
};

const LAYER_NAMES: readonly TranslationKey[] = [
  'terrain.layer.1',
  'terrain.layer.2',
  'terrain.layer.3',
  'terrain.layer.4',
];

/** Tools of the terrain component (Unity: terrain tools): create data, sculpt and paint. */
export function TerrainTools({ objectId, asset }: { objectId: string; asset: string | null }) {
  const t = useT();
  const tool = useTerrainTool();
  const playing = usePlay((state) => state.status !== 'stopped');
  useDocument((state) => state.assetsVersion);
  if (!asset) {
    return (
      <div className="terrain-tools" data-testid="terrain-tools">
        <button
          type="button"
          data-testid="terrain-create"
          disabled={playing}
          onClick={() => {
            const id = createTerrainAsset(200, 129, t('terrain.defaultName'));
            if (id) assignTerrain(objectId, id);
          }}
        >
          <Mountain size={14} /> {t('terrain.create')}
        </button>
      </div>
    );
  }
  return (
    <div className="terrain-tools" data-testid="terrain-tools">
      <button
        type="button"
        data-testid="terrain-brush-toggle"
        aria-pressed={tool.active}
        className={tool.active ? 'toggled' : undefined}
        disabled={playing}
        onClick={() => tool.set({ active: !tool.active })}
      >
        <Mountain size={14} /> {t(tool.active ? 'terrain.brush.stop' : 'terrain.brush.start')}
      </button>
      {tool.active && (
        <>
          <div className="terrain-tool-row" role="group">
            {TERRAIN_TOOL_ORDER.map((name) => (
              <button
                key={name}
                type="button"
                data-testid={`terrain-tool-${name}`}
                aria-pressed={tool.tool === name}
                className={tool.tool === name ? 'toggled' : undefined}
                onClick={() => tool.set({ tool: name })}
              >
                {t(TOOL_NAMES[name])}
              </button>
            ))}
          </div>
          {tool.tool === 'paint' && (
            <div className="terrain-tool-row" role="group">
              {Array.from({ length: TERRAIN_LAYERS }, (_, layer) => (
                <button
                  key={layer}
                  type="button"
                  data-testid={`terrain-layer-${layer}`}
                  aria-pressed={tool.layer === layer}
                  className={tool.layer === layer ? 'toggled' : undefined}
                  onClick={() => tool.set({ layer })}
                >
                  {t(LAYER_NAMES[layer] ?? 'terrain.layer.1')}
                </button>
              ))}
            </div>
          )}
          <label className="brush-row">
            <span>{t('brush.radius')}</span>
            <NumberInput
              value={tool.radius}
              step={1}
              min={1}
              max={80}
              testId="terrain-radius"
              onChange={(radius) => tool.set({ radius })}
            />
          </label>
          <label className="brush-row">
            <span>{t('terrain.strength')}</span>
            <NumberInput
              value={tool.strength}
              step={0.1}
              min={0.05}
              max={1}
              testId="terrain-strength"
              onChange={(strength) => tool.set({ strength })}
            />
          </label>
        </>
      )}
      <button
        type="button"
        data-testid="terrain-hills"
        disabled={playing}
        onClick={() =>
          changeTerrain(objectId, (data) => {
            const seed = Math.floor(Math.random() * 1e6);
            const region = data.generateHills(seed, data.size * 0.04, 3 / data.size);
            data.autoPaint({ flat: 0, steep: 2, low: 3 }, -1000);
            return region;
          })
        }
      >
        {t('terrain.generateHills')}
      </button>
    </div>
  );
}
