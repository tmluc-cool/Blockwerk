import { NumberInput } from '../panels/inspector/fields';
import {
  layersCollide,
  physicsLayers,
  sceneGravity,
  setLayersCollide,
  setSceneGravity,
  useDocument,
} from '../state/document';
import { useDialogs } from '../state/dialogs';
import { useT } from '../state/settings';

/**
 * Physics settings (Unity: Project Settings → Physics): gravity of the open scene and the layer
 * collision matrix. Changes apply at once; the matrix is stored in the project, the gravity in
 * the scene.
 */
export function PhysicsDialog() {
  const t = useT();
  const close = useDialogs((state) => state.close);
  // Re-render when the project settings or the scene change.
  useDocument((state) => state.assetsVersion);
  useDocument((state) => state.scene);
  const layers = physicsLayers();
  return (
    <div
      className="dialog dialog-wide"
      role="dialog"
      aria-modal="true"
      data-testid="physics-dialog"
    >
      <h2>{t('physics.title')}</h2>
      <div className="physics-row">
        <label>{t('physics.gravity')}</label>
        <NumberInput
          value={sceneGravity()}
          step={0.1}
          testId="physics-gravity"
          onChange={setSceneGravity}
        />
        <span className="unit">{t('physics.gravityUnit')}</span>
      </div>
      <h3>{t('physics.matrix')}</h3>
      <p className="muted">{t('physics.matrixHint')}</p>
      <table className="layer-matrix" data-testid="layer-matrix">
        <tbody>
          {layers.map((row, rowIndex) => (
            <tr key={row}>
              <th>{row}</th>
              {layers.slice(0, layers.length - rowIndex).map((column) => (
                <td key={column}>
                  <input
                    type="checkbox"
                    aria-label={`${row} / ${column}`}
                    data-testid={`matrix-${row}-${column}`}
                    checked={layersCollide(row, column)}
                    onChange={(event) => setLayersCollide(row, column, event.target.checked)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dialog-buttons">
        <button type="button" className="primary" autoFocus onClick={close}>
          {t('dialog.ok')}
        </button>
      </div>
    </div>
  );
}
