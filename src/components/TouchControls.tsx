import React, { useRef, useState, useEffect } from 'react';
import { Target, Crosshair, ArrowUp, RefreshCw, Zap, Sliders } from 'lucide-react';
import type { ControlLayoutConfig } from '../types';
import { DEFAULT_HUD_LAYOUT } from '../utils/hudLayouts';

interface TouchControlsProps {
  onMoveVector: (vec: { x: number; y: number }) => void;
  onLookDelta: (delta: { x: number; y: number }) => void;
  onFireChange: (isFiring: boolean) => void;
  onAimToggle: () => void;
  onAimSet?: (aim: boolean) => void;
  isAiming: boolean;
  onJump: () => void;
  onReload: () => void;
  isReloading: boolean;
  onSprintToggle: (sprinting: boolean) => void;
  isSprinting: boolean;
  currentAmmo: number;
  maxAmmo: number;
  config: ControlLayoutConfig;
  onOpenSettings: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMoveVector,
  onLookDelta,
  onFireChange,
  onAimToggle,
  onAimSet,
  isAiming,
  onJump,
  onReload,
  isReloading,
  onSprintToggle,
  isSprinting,
  currentAmmo,
  maxAmmo,
  config,
  onOpenSettings,
}) => {
  // Joystick refs & states
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickTouchIdRef = useRef<number | null>(null);
  const [joystickKnobPos, setJoystickKnobPos] = useState({ x: 0, y: 0 });

  // Camera look touch tracking (tracks touch IDs that are looking/aiming)
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Multi-touch tracking for fire buttons (supports simultaneous main & left fire)
  const fireTouchesRef = useRef<Set<number>>(new Set());

  const scale = config.scale || 1.0;
  const customHUD = config.customHUD || DEFAULT_HUD_LAYOUT;
  const showLeftFire = config.showLeftFireButton || config.preset === 'claw3' || config.preset === 'claw4';

  // Joystick touch handlers
  const handleJoystickStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (joystickTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;
    updateJoystickPos(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        updateJoystickPos(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        setJoystickKnobPos({ x: 0, y: 0 });
        onMoveVector({ x: 0, y: 0 });
        break;
      }
    }
  };

  const updateJoystickPos = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxRadius = (rect.width / 2) * 0.85;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const clampedDist = Math.min(dist, maxRadius);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setJoystickKnobPos({ x: knobX, y: knobY });

    // Normalized vector (-1 to 1)
    const normX = knobX / maxRadius;
    const normY = knobY / maxRadius;
    onMoveVector({ x: normX, y: normY });
  };

  // Touch look zone handlers (covers entire screen behind action buttons)
  const handleLookStart = (e: React.TouchEvent) => {
    if (lookTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchIdRef.current = touch.identifier;
    lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        const dx = touch.clientX - lastLookPosRef.current.x;
        const dy = touch.clientY - lastLookPosRef.current.y;
        lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };

        onLookDelta({ x: dx, y: dy });
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  };

  // Fire touch handlers supporting multi-touch (main fire + left fire)
  const handleFireTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      fireTouchesRef.current.add(e.changedTouches[i].identifier);
    }
    onFireChange(fireTouchesRef.current.size > 0);
  };

  const handleFireTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      fireTouchesRef.current.delete(e.changedTouches[i].identifier);
    }
    onFireChange(fireTouchesRef.current.size > 0);
  };

  // Aim touch handlers supporting both 'toggle' and 'hold' modes
  const handleAimTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (config.aimMode === 'hold') {
      if (onAimSet) onAimSet(true);
    } else {
      onAimToggle();
    }
  };

  const handleAimTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (config.aimMode === 'hold') {
      if (onAimSet) onAimSet(false);
    }
  };

  // Clean up touches if cancelled
  useEffect(() => {
    const handleTouchCancel = () => {
      joystickTouchIdRef.current = null;
      lookTouchIdRef.current = null;
      fireTouchesRef.current.clear();
      setJoystickKnobPos({ x: 0, y: 0 });
      onMoveVector({ x: 0, y: 0 });
      onFireChange(false);
      if (config.aimMode === 'hold' && onAimSet) {
        onAimSet(false);
      }
    };
    window.addEventListener('touchcancel', handleTouchCancel);
    return () => window.removeEventListener('touchcancel', handleTouchCancel);
  }, [onMoveVector, onFireChange, config.aimMode, onAimSet]);

  const joyPos = customHUD.joystick || DEFAULT_HUD_LAYOUT.joystick;
  const sprintPos = customHUD.sprint || DEFAULT_HUD_LAYOUT.sprint;
  const firePos = customHUD.fire || DEFAULT_HUD_LAYOUT.fire;
  const leftFirePos = customHUD.leftFire || DEFAULT_HUD_LAYOUT.leftFire;
  const aimPos = customHUD.aim || DEFAULT_HUD_LAYOUT.aim;
  const jumpPos = customHUD.jump || DEFAULT_HUD_LAYOUT.jump;
  const reloadPos = customHUD.reload || DEFAULT_HUD_LAYOUT.reload;
  const settingsPos = customHUD.settings || DEFAULT_HUD_LAYOUT.settings;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 overflow-hidden">
      {/* Full-Screen Touch Camera Look Surface */}
      <div
        id="touch-look-zone"
        className="absolute inset-0 w-full h-full pointer-events-auto touch-none"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* 1. Virtual Joystick (Custom Positioned) */}
      <div
        className="absolute pointer-events-auto touch-none"
        style={{
          left: `${joyPos.x}%`,
          top: `${joyPos.y}%`,
          transform: `translate(-50%, -50%) scale(${(joyPos.scale ?? 1.0) * scale})`,
        }}
      >
        <div
          ref={joystickBaseRef}
          id="btn-joystick-base"
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
          className="relative w-36 h-36 rounded-full bg-neutral-900/60 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl shadow-black/50"
        >
          {/* Inner guide ring */}
          <div className="w-16 h-16 rounded-full border border-white/10" />

          {/* Direction indicators */}
          <div className="absolute top-2 w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="absolute left-2 w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white/30" />

          {/* Draggable Knob */}
          <div
            id="joystick-knob"
            className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border border-white/40 shadow-md flex items-center justify-center transition-transform duration-75"
            style={{
              transform: `translate(${joystickKnobPos.x}px, ${joystickKnobPos.y}px)`,
            }}
          >
            <div className="w-4 h-4 rounded-full bg-white/85" />
          </div>
        </div>
      </div>

      {/* 2. Sprint Button (Custom Positioned) */}
      <div
        className="absolute pointer-events-auto touch-none z-20"
        style={{
          left: `${sprintPos.x}%`,
          top: `${sprintPos.y}%`,
          transform: `translate(-50%, -50%) scale(${(sprintPos.scale ?? 1.0) * scale})`,
        }}
      >
        <button
          id="btn-sprint"
          onClick={() => onSprintToggle(!isSprinting)}
          className={`px-4 py-2 rounded-full flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase border transition-all active:scale-95 shadow-md ${
            isSprinting
              ? 'bg-amber-500 text-black border-amber-300 shadow-amber-500/40'
              : 'bg-black/70 text-white/90 border-white/20 backdrop-blur-md'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{isSprinting ? 'Correndo' : 'Correr'}</span>
        </button>
      </div>

      {/* 3. Primary Fire Button (Custom Positioned) */}
      <div
        className="absolute pointer-events-auto touch-none z-20"
        style={{
          left: `${firePos.x}%`,
          top: `${firePos.y}%`,
          transform: `translate(-50%, -50%) scale(${(firePos.scale ?? 1.15) * scale})`,
        }}
      >
        <button
          id="btn-fire"
          onTouchStart={handleFireTouchStart}
          onTouchEnd={handleFireTouchEnd}
          onTouchCancel={handleFireTouchEnd}
          onMouseDown={() => onFireChange(true)}
          onMouseUp={() => onFireChange(false)}
          className="w-22 h-22 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 border-2 border-rose-300 shadow-xl shadow-rose-600/40 flex flex-col items-center justify-center text-white active:scale-90 transition-transform select-none"
        >
          <Crosshair className="w-9 h-9 text-white drop-shadow" />
          <span className="text-[11px] font-black tracking-wider uppercase mt-0.5">FOGO</span>
        </button>
      </div>

      {/* 4. Secondary Left Fire Button (Custom Positioned, toggleable or claw preset) */}
      {showLeftFire && (
        <div
          className="absolute pointer-events-auto touch-none z-20"
          style={{
            left: `${leftFirePos.x}%`,
            top: `${leftFirePos.y}%`,
            transform: `translate(-50%, -50%) scale(${(leftFirePos.scale ?? 1.0) * scale})`,
          }}
        >
          <button
            id="btn-fire-left"
            onTouchStart={handleFireTouchStart}
            onTouchEnd={handleFireTouchEnd}
            onTouchCancel={handleFireTouchEnd}
            onMouseDown={() => onFireChange(true)}
            onMouseUp={() => onFireChange(false)}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-600/90 to-red-500/90 border-2 border-rose-300 shadow-lg shadow-rose-600/30 flex flex-col items-center justify-center text-white active:scale-90 transition-transform select-none backdrop-blur-sm"
            title="Tiro Secundário (Garra)"
          >
            <Crosshair className="w-6 h-6 text-white drop-shadow" />
            <span className="text-[9px] font-extrabold uppercase tracking-wider mt-0.5">TIRO</span>
          </button>
        </div>
      )}

      {/* 5. Aim (ADS) Button (Custom Positioned) */}
      <div
        className="absolute pointer-events-auto touch-none z-20"
        style={{
          left: `${aimPos.x}%`,
          top: `${aimPos.y}%`,
          transform: `translate(-50%, -50%) scale(${(aimPos.scale ?? 1.0) * scale})`,
        }}
      >
        <button
          id="btn-aim"
          onTouchStart={handleAimTouchStart}
          onTouchEnd={handleAimTouchEnd}
          onTouchCancel={handleAimTouchEnd}
          onClick={config.aimMode !== 'hold' ? onAimToggle : undefined}
          className={`w-15 h-15 rounded-full backdrop-blur-md border-2 flex flex-col items-center justify-center active:scale-90 transition-all shadow-lg ${
            isAiming
              ? 'bg-emerald-500 text-black border-emerald-200 shadow-emerald-500/40 font-black'
              : 'bg-neutral-900/80 text-white border-white/30 font-bold'
          }`}
          title={config.aimMode === 'hold' ? 'Segure para Mirar' : 'Toque para Mirar'}
        >
          <Target className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase mt-0.5">
            {isAiming ? 'MIRANDO' : 'MIRA'}
          </span>
        </button>
      </div>

      {/* 6. Jump Button (Custom Positioned) */}
      <div
        className="absolute pointer-events-auto touch-none z-20"
        style={{
          left: `${jumpPos.x}%`,
          top: `${jumpPos.y}%`,
          transform: `translate(-50%, -50%) scale(${(jumpPos.scale ?? 1.0) * scale})`,
        }}
      >
        <button
          id="btn-jump"
          onClick={onJump}
          onTouchStart={(e) => {
            e.stopPropagation();
            onJump();
          }}
          className="w-14 h-14 rounded-full bg-neutral-900/80 backdrop-blur-md border-2 border-sky-400/80 flex flex-col items-center justify-center text-sky-400 active:scale-90 transition-transform shadow-lg shadow-black/40"
        >
          <ArrowUp className="w-6 h-6" />
          <span className="text-[8px] font-bold text-white uppercase mt-0.5">PULO</span>
        </button>
      </div>

      {/* 7. Reload Button (Custom Positioned) */}
      <div
        className="absolute pointer-events-auto touch-none z-20"
        style={{
          left: `${reloadPos.x}%`,
          top: `${reloadPos.y}%`,
          transform: `translate(-50%, -50%) scale(${(reloadPos.scale ?? 1.0) * scale})`,
        }}
      >
        <button
          id="btn-reload"
          onClick={onReload}
          disabled={isReloading}
          className="relative w-14 h-14 rounded-full bg-neutral-900/80 backdrop-blur-md border-2 border-amber-400/80 flex flex-col items-center justify-center text-white active:scale-90 transition-transform shadow-lg shadow-black/40"
        >
          <RefreshCw className={`w-5 h-5 text-amber-400 ${isReloading ? 'animate-spin' : ''}`} />
          <span className="text-[9px] font-bold text-white/90 leading-tight mt-0.5">
            {currentAmmo}/{maxAmmo}
          </span>
        </button>
      </div>

      {/* 8. Settings Button (Custom Positioned) */}
      <div
        className="absolute pointer-events-auto touch-none z-20"
        style={{
          left: `${settingsPos.x}%`,
          top: `${settingsPos.y}%`,
          transform: `translate(-50%, -50%) scale(${(settingsPos.scale ?? 0.9) * scale})`,
        }}
      >
        <button
          id="btn-settings-touch"
          onClick={onOpenSettings}
          className="w-11 h-11 rounded-full bg-neutral-900/70 backdrop-blur-md border border-white/25 flex items-center justify-center text-white/80 active:scale-90 transition-transform shadow-md"
          title="Configurações e Layout"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
