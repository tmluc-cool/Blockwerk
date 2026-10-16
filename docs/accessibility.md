# Accessibility

What Blockwerk does for people who use a keyboard, a screen reader, high contrast or reduced
motion, what is checked automatically, and what is still open. The checks run in CI
(`e2e/editor/accessibility.spec.ts`, `apps/editor/test/contrast.test.ts`).

## Checked on every change

- **Names for every control.** Each button, field, checkbox, dropdown and tab in every window has a
  name a screen reader can read. Inspector fields take the name of their row ("Mass", "Position X").
  Icon-only buttons have a text name.
- **Dialogs** are labeled with their title (`role="dialog"`, `aria-labelledby`).
- **Keyboard.** Tab reaches the menu bar, the toolbar and the windows; the focus is always visible
  (an orange frame in the dark theme, a dark orange one in the light theme). The 3D view and the
  tree views can be focused too. Shortcuts as in Unity (Ctrl+1 … Ctrl+5 focus the main windows).
- **Contrast.** Text colors reach 4.5:1 and interface colors 3:1 against their backgrounds, in the
  dark and the light theme (WCAG 2.1 AA). The test reads the color tokens from the style sheet, so a
  new color cannot slip in unchecked.
- **No information by color alone in the console.** Entries have an icon per level, and the level
  filters have a pressed state.
- **Reduced motion.** With the system setting "reduce motion", animations and transitions in the
  editor are switched off, and games run without camera shake (`reduceMotion` of the game, taken
  from `prefers-reduced-motion`).
- **Language.** The page language follows the interface language (German or English).

## Games made with Blockwerk

The settings menu of a game offers volumes, mouse sensitivity, key bindings (every action can be
rebound, also for player 2), fullscreen and the graphics level. The built-in menus can be used with
mouse and keyboard (navigating them with a gamepad is not done yet, see phase 6).

## Still open

- **The block editor** is Blockly. Its keyboard support for moving blocks is limited; blocks can be
  added from the search ("typing finds blocks", phase 7), but connecting and moving them with the
  keyboard only is not complete.
- **The Scene view** is a 3D canvas: it can be moved with the keyboard (as in Unity), but objects can
  be placed precisely only via the Inspector, and a screen reader does not describe the scene. The
  Hierarchy and the Inspector give the same information as text.
- **A switch for "reduce motion" inside a game's settings menu** does not exist yet; the system
  setting is used.
- No review with real assistive technology (NVDA, VoiceOver) has been done yet. The automatic checks
  find missing names and contrast, not whether the result is pleasant to use. Reports are welcome.
