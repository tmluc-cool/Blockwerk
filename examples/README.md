# Examples

One example project per phase. Each one is an acceptance test of its phase (see `SPEC.md`,
section 10) and must run in play mode.

| Phase | Example                                                                       | Status |
| ----- | ----------------------------------------------------------------------------- | ------ |
| 0     | Built-in sample scene of the editor (no project format yet)                   | done   |
| 1     | `01-hindernis`                                                                | done   |
| 2     | `02-dorf`                                                                     | done   |
| 3     | `03-held`                                                                     | done   |
| 3b    | `03b-figur`                                                                   | done   |
| 4     | `04-landschaft`                                                               | done   |
| 5     | `05-quest` (since phase 6 with main menu, pause, settings, saves)             | done   |
| 7     | `07-gross` (86 block scripts, a script library with custom blocks)            | done   |
| 8     | `08-kaputt` (five deliberate mistakes for the debugging tools)                | done   |
| 11    | `endspiel` (the final game: village, landscape, quests, fights, split screen) | done   |

Phase 0 has no example project of its own: the project format and the play mode arrive in
phase 1. Its "example scene" is the sample scene the editor opens with (sky, sun, ground, test
cube, main camera); `docs/screenshots/phase-00.png` shows it.
