/** Example script shown in the block editor until block-script assets exist (phase 1). */
export const DEMO_WORKSPACE = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'events.whenGameStarts',
        id: 'demo-start',
        x: 40,
        y: 40,
        next: {
          block: {
            type: 'motion.moveForward',
            id: 'demo-move',
            inputs: {
              meters: { shadow: { type: 'literal.number', id: 'demo-meters', fields: { NUM: 2 } } },
            },
          },
        },
      },
    ],
  },
} as const;
