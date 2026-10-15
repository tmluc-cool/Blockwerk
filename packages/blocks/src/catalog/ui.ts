import { defineBlock } from '../defineBlock';

export const showUi = defineBlock({
  id: 'ui.show',
  category: 'ui',
  shape: 'stack',
  inputs: { ui: { type: 'reference', source: 'ui', default: 'ui:' } },
  text: { de: 'zeige UI {ui}', en: 'show UI {ui}' },
  keywords: {
    de: ['menü', 'anzeige', 'einblenden', 'oberfläche', 'hud'],
    en: ['menu', 'display', 'open', 'interface', 'hud'],
  },
  areas: ['ui'],
  compile: ({ ui }) => `game.showUi(self, ${ui});`,
  docs: {
    de: 'Blendet eine UI-Leinwand ein, die auf „von Hand“ steht (zum Beispiel ein Einstellungsmenü). Die Leinwand muss in der Szene an einem Objekt mit der Komponente „UI-Leinwand“ hängen.',
    en: 'Shows a UI canvas that is set to "by hand" (a settings menu, say). The canvas has to be on an object with the "UI Canvas" component in the scene.',
  },
  since: 6,
});

export const hideUi = defineBlock({
  id: 'ui.hide',
  category: 'ui',
  shape: 'stack',
  inputs: { ui: { type: 'reference', source: 'ui', default: 'ui:' } },
  text: { de: 'verstecke UI {ui}', en: 'hide UI {ui}' },
  keywords: { de: ['menü', 'schliessen', 'ausblenden'], en: ['menu', 'close', 'hide'] },
  areas: ['ui'],
  compile: ({ ui }) => `game.hideUi(self, ${ui});`,
  docs: {
    de: 'Blendet eine UI-Leinwand wieder aus, die mit „zeige UI“ geöffnet wurde.',
    en: 'Hides a UI canvas again that was opened with "show UI".',
  },
  since: 6,
});
