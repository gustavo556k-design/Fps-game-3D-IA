import type { CustomHUDLayout, LayoutPreset } from '../types';

export const DEFAULT_HUD_LAYOUT: CustomHUDLayout = {
  joystick: { x: 14, y: 76, scale: 1.0 },
  sprint: { x: 14, y: 59, scale: 0.95 },
  fire: { x: 86, y: 76, scale: 1.15 },
  aim: { x: 73, y: 64, scale: 1.0 },
  jump: { x: 88, y: 54, scale: 1.0 },
  reload: { x: 74, y: 80, scale: 1.0 },
  leftFire: { x: 14, y: 32, scale: 1.05 },
  settings: { x: 92, y: 8, scale: 0.9 },
};

export const CLAW3_HUD_LAYOUT: CustomHUDLayout = {
  joystick: { x: 14, y: 76, scale: 1.0 },
  sprint: { x: 14, y: 59, scale: 0.95 },
  leftFire: { x: 12, y: 20, scale: 1.2 },
  fire: { x: 86, y: 76, scale: 1.1 },
  aim: { x: 73, y: 64, scale: 1.0 },
  jump: { x: 88, y: 54, scale: 1.0 },
  reload: { x: 74, y: 80, scale: 1.0 },
  settings: { x: 92, y: 8, scale: 0.9 },
};

export const CLAW4_HUD_LAYOUT: CustomHUDLayout = {
  joystick: { x: 14, y: 76, scale: 1.0 },
  sprint: { x: 14, y: 59, scale: 0.95 },
  leftFire: { x: 12, y: 18, scale: 1.25 },
  aim: { x: 88, y: 18, scale: 1.25 },
  fire: { x: 86, y: 76, scale: 1.1 },
  jump: { x: 88, y: 54, scale: 1.0 },
  reload: { x: 74, y: 78, scale: 1.0 },
  settings: { x: 50, y: 8, scale: 0.9 },
};

export const INVERTED_HUD_LAYOUT: CustomHUDLayout = {
  joystick: { x: 86, y: 76, scale: 1.0 },
  sprint: { x: 86, y: 59, scale: 0.95 },
  fire: { x: 14, y: 76, scale: 1.15 },
  aim: { x: 27, y: 64, scale: 1.0 },
  jump: { x: 12, y: 54, scale: 1.0 },
  reload: { x: 26, y: 80, scale: 1.0 },
  leftFire: { x: 86, y: 32, scale: 1.05 },
  settings: { x: 8, y: 8, scale: 0.9 },
};

export function getPresetLayout(preset: LayoutPreset): CustomHUDLayout {
  switch (preset) {
    case 'claw3':
      return JSON.parse(JSON.stringify(CLAW3_HUD_LAYOUT));
    case 'claw4':
      return JSON.parse(JSON.stringify(CLAW4_HUD_LAYOUT));
    case 'inverted':
      return JSON.parse(JSON.stringify(INVERTED_HUD_LAYOUT));
    default:
      return JSON.parse(JSON.stringify(DEFAULT_HUD_LAYOUT));
  }
}
