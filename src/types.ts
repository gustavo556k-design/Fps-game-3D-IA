export interface PlayerState {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  roomCode: string;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
  health: number;
  maxHealth: number;
  kills: number;
  deaths: number;
  score: number;
  isAlive: boolean;
  respawnTimer: number;
  isMoving: boolean;
  isSprinting: boolean;
  isAiming: boolean;
  color: string;
  ping?: number;
}

export interface Room {
  code: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  status: 'lobby' | 'in_game' | 'ended';
  matchDuration: number; // in seconds (e.g., 300 = 5 min)
  timeLeft: number;
  isBotMatch: boolean;
  players: Record<string, PlayerState>;
  winnerId: string | null;
  createdAt: number;
}

export interface KillFeedItem {
  id: string;
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  timestamp: number;
}

export interface ShootPayload {
  playerId: string;
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  hitPoint: { x: number; y: number; z: number } | null;
  targetPlayerId: string | null;
}

export interface HitResult {
  victimId: string;
  attackerId: string;
  damage: number;
  remainingHealth: number;
  killed: boolean;
}

export type LayoutPreset = 'default' | 'claw3' | 'claw4' | 'inverted' | 'custom';
export type AimMode = 'toggle' | 'hold';

export interface HUDButtonPosition {
  x: number; // percentage from left of screen (0 to 100)
  y: number; // percentage from top of screen (0 to 100)
  scale?: number; // scale multiplier (0.7 to 1.5)
}

export interface CustomHUDLayout {
  fire: HUDButtonPosition;
  leftFire: HUDButtonPosition;
  aim: HUDButtonPosition;
  jump: HUDButtonPosition;
  reload: HUDButtonPosition;
  sprint: HUDButtonPosition;
  joystick: HUDButtonPosition;
  settings: HUDButtonPosition;
}

export interface ControlLayoutConfig {
  scale: number; // 0.8 to 1.4
  joystickSize: number;
  fireButtonSize: number;
  aimButtonSize: number;
  jumpButtonSize: number;
  reloadButtonSize: number;
  sprintButtonSize: number;
  sensitivity: number;
  invertY: boolean;
  vibration: boolean;
  // Position customization
  preset: LayoutPreset;
  aimMode: AimMode;
  showLeftFireButton: boolean;
  actionButtonsBottom: number; // 16 to 120 px
  actionButtonsRight: number;  // 12 to 90 px
  joystickBottom: number;      // 16 to 120 px
  joystickLeft: number;        // 12 to 90 px
  customHUD: CustomHUDLayout;
}

export type ClientMessage =
  | { type: 'room:list' }
  | { type: 'room:create'; name: string; playerName: string; maxPlayers: number }
  | { type: 'room:create_bot_match'; playerName: string }
  | { type: 'room:join'; code: string; playerName: string }
  | { type: 'room:ready'; ready: boolean }
  | { type: 'room:start' }
  | { type: 'room:leave' }
  | {
      type: 'player:move';
      position: { x: number; y: number; z: number };
      rotation: { yaw: number; pitch: number };
      isMoving: boolean;
      isSprinting: boolean;
      isAiming: boolean;
    }
  | {
      type: 'player:shoot';
      origin: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
      targetPlayerId: string | null;
      hitPoint: { x: number; y: number; z: number } | null;
    }
  | { type: 'player:respawn' }
  | { type: 'ping'; timestamp: number };

export type ServerMessage =
  | { type: 'rooms:list'; rooms: Array<{ code: string; name: string; playersCount: number; maxPlayers: number; status: string }> }
  | { type: 'room:joined'; room: Room; myId: string }
  | { type: 'room:update'; room: Room }
  | { type: 'game:start'; room: Room }
  | { type: 'game:tick'; timeLeft: number; players: Record<string, PlayerState> }
  | {
      type: 'player:shot';
      shooterId: string;
      origin: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
      hitPoint: { x: number; y: number; z: number } | null;
    }
  | { type: 'player:hit'; hit: HitResult }
  | { type: 'killfeed'; event: KillFeedItem }
  | { type: 'player:respawned'; player: PlayerState }
  | { type: 'game:over'; winner: PlayerState | null; leaderboard: PlayerState[] }
  | { type: 'error'; message: string }
  | { type: 'pong'; timestamp: number };
