# Tutorial: Deine erste Welt in 10 Minuten

Das Tutorial läuft im echten Editor. Du startest es unter **Hilfe → Tutorial: Deine erste Welt in 10 Minuten**. Eine kleine Karte unten rechts sagt dir, was als Nächstes zu tun ist, und ein orangefarbener Rahmen zeigt, wo du es findest. Sobald du den Schritt erledigt hast, springt die Karte von selbst weiter. „Weiter“ überspringt einen Schritt, „Beenden“ schliesst das Tutorial jederzeit.

| Schritt | Du machst                                                                    | Das Tutorial merkt es, wenn                  |
| ------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| 1       | Menü **Objekt → 3D-Objekt → Würfel**                                         | ein neuer Würfel in der Szene ist            |
| 2       | Im Inspektor die Position ändern                                             | sich die Position eines Würfels geändert hat |
| 3       | Ein **Block-Skript** anlegen                                                 | es ein neues Block-Skript im Projekt gibt    |
| 4       | Das Skript per **Komponente hinzufügen → Block-Skript** an den Würfel hängen | ein Würfel ein Skript trägt                  |
| 5       | „Jeden Frame“ und „drehe dich um … Grad“ zusammenstecken                     | das Skript beide Blöcke enthält              |
| 6       | **Play** drücken (Strg+P)                                                    | das Spiel läuft                              |
| 7       | **Play** noch einmal drücken                                                 | das Spiel gestoppt ist                       |

Danach zeigt das Tutorial auf **Datei → Neues Projekt aus Vorlage …** (siehe [Vorlagen](templates.md)).

## Für Entwickler

- Schritte und Bedingungen: `apps/editor/src/tutorial/steps.ts` (reine Funktionen über `TutorialFacts`, getestet in `apps/editor/test/tutorial.test.ts`).
- Zustand und Beobachtung des Dokuments: `useTutorial.ts`. Das Tutorial hat keinen eigenen Dokumentzustand und verändert nichts am Projekt.
- Texte stehen in `de.json` und `en.json` unter `tutorial.*`.
- Ablauf im Browser: `e2e/editor/tutorial.spec.ts`.
