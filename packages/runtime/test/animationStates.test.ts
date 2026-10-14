import { describe, expect, it } from 'vitest';
import { matchClips } from '../src';

const KAYKIT = [
  '1H_Melee_Attack_Chop',
  '1H_Melee_Attack_Stab',
  '2H_Melee_Idle',
  'Block',
  'Block_Attack',
  'Block_Hit',
  'Blocking',
  'Cheer',
  'Death_A',
  'Death_A_Pose',
  'Hit_A',
  'Hit_B',
  'Idle',
  'Interact',
  'Jump_Full_Long',
  'Jump_Full_Short',
  'Jump_Idle',
  'Jump_Land',
  'Jump_Start',
  'Lie_Idle',
  'PickUp',
  'Running_A',
  'Running_B',
  'Running_Strafe_Left',
  'Sit_Chair_Down',
  'Sit_Chair_Idle',
  'Sit_Floor_Idle',
  'T-Pose',
  'Unarmed_Idle',
  'Walking_A',
  'Walking_B',
  'Walking_Backwards',
];

describe('animation states', () => {
  it('matches KayKit clip names to the standard states', () => {
    const states = matchClips(KAYKIT);
    expect(Object.fromEntries(states)).toEqual({
      idle: 'Idle',
      walk: 'Walking_A',
      run: 'Running_A',
      jump: 'Jump_Start',
      fall: 'Jump_Idle',
      land: 'Jump_Land',
      attack: '1H_Melee_Attack_Chop',
      hit: 'Hit_A',
      death: 'Death_A',
      cheer: 'Cheer',
      interact: 'Interact',
      block: 'Block',
      sit: 'Sit_Chair_Idle',
    });
  });

  it('matches other common naming styles and respects overrides', () => {
    const states = matchClips([
      'idle',
      'walk',
      'run',
      'jump',
      'falling',
      'crouch_idle',
      'crouch_walk',
      'wave',
      'die',
    ]);
    expect(states.get('crouch')).toBe('crouch_idle');
    expect(states.get('crouchWalk')).toBe('crouch_walk');
    expect(states.get('fall')).toBe('falling');
    expect(states.get('death')).toBe('die');
    expect(states.get('wave')).toBe('wave');
    const custom = matchClips(['Idle', 'Hello'], { wave: 'Hello', idle: 'Missing' });
    expect(custom.get('wave')).toBe('Hello');
    expect(custom.has('idle')).toBe(false);
  });
});
