import type { BlockDefinition } from '../types';
import { whenGameStarts } from './events';
import { numberLiteral } from './literals';
import { moveForward } from './motion';

/** Every block of the built-in catalog. */
export const BLOCK_CATALOG: readonly BlockDefinition[] = [
  whenGameStarts,
  moveForward,
  numberLiteral,
];
