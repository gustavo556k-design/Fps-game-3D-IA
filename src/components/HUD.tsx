import React, { useEffect, useState } from 'react';
import { Shield, Clock, Wifi, Copy, Check, Crosshair, Move, Skull } from 'lucide-react';
import type { KillFeedItem, PlayerState } from '../types';

interface HUDProps {
  player: PlayerState | null;
  currentAmmo: number;
  maxAmmo: number;
  reserveAmmo: number;
  timeLeft: number;
  killFeed: KillFeedItem[];
  roomCode: string;
  isHitmarkerActive: boolean;
  isTakingDamage: boolean;
  isAiming: boolean;
  isMoving: boolean;
  killAlert?: { title: string; victim: string } | null;
  onOpenHUDEditor?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  player,
  currentAmmo,
  maxAmmo,
  reserveAmmo,
  timeLeft,
  killFeed,
  roomCode,
  isHitmarkerActive,
  isTakingDamage,
  isAiming,
  isMoving,
  killAlert,
  onOpenHUDEditor,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.max(0, seconds) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const health = player?.health ?? 100;
  const isLowHealth = health <= 30;

  // Crosshair gap calculation based on moving/aiming
  const crosshairGap = isAiming ? 4 : isMoving ? 14 : 8;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-4 md:p-6">
      {/* Damage Screen Flash */}
      {isTakingDamage && (
        <div className="absolute inset-0 bg-red-600/30 border-8 border-red-500/80 animate-damage pointer-events-none" />
      )}

      {/* Top Header Bar */}
      <div className="flex items-start justify-between w-full">
        {/* Match Timer & Room Badge & Edit HUD Button */}
        <div className="flex items-center gap-2">
          {/* Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-white shadow-md">
            <Clock className="w-4 h-4 text-sky-400" />
            <span className="font-teko text-xl font-bold tracking-wider text-sky-300">
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Room Code Badge */}
          <button
            id="btn-copy-room-code-hud"
            onClick={handleCopyCode}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-white/80 hover:text-white transition-colors active:scale-95"
            title="Copiar Código da Sala"
          >
            <span className="text-xs text-neutral-400 uppercase">Sala</span>
            <span className="font-mono text-xs font-bold text-amber-400">{roomCode}</span>
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Edit HUD Button */}
          {onOpenHUDEditor && (
            <button
              id="btn-quick-edit-hud"
              onClick={onOpenHUDEditor}
              className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-md border border-sky-400/40 text-sky-300 hover:text-white transition-colors active:scale-95 text-xs font-semibold"
              title="Personalizar Posição dos Botões"
            >
              <Move className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Personalizar Botões</span>
            </button>
          )}

          {/* Online Ping */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-emerald-400 text-xs font-semibold">
            <Wifi className="w-3.5 h-3.5" />
            <span>28ms</span>
          </div>
        </div>

        {/* Live Score & Top Kill Feed */}
        <div className="flex flex-col items-end gap-2 max-w-[260px] sm:max-w-xs">
          {/* Personal K/D Badge */}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/20 text-xs font-semibold shadow-lg">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Skull className="w-4 h-4 text-emerald-400" />
              <span className="font-bold">ELIMINAÇÕES:</span>
              <span className="font-teko text-2xl text-emerald-300 font-bold leading-none">{player?.kills ?? 0}</span>
            </div>
            <div className="w-px h-4 bg-white/25" />
            <div className="flex items-center gap-1 text-rose-400">
              <span className="font-bold">MORTES:</span>
              <span className="font-teko text-xl text-rose-300 font-bold leading-none">{player?.deaths ?? 0}</span>
            </div>
          </div>

          {/* Kill Feed Notifications */}
          <div className="flex flex-col gap-1 w-full items-end">
            {killFeed.slice(-3).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-medium animate-fade-in text-white/90 shadow-sm"
              >
                <span className="text-emerald-400 font-bold truncate max-w-[90px]">{item.killerName}</span>
                <Crosshair className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-rose-400 truncate max-w-[90px]">{item.victimName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Epic Kill Confirmation Popup Banner */}
      {killAlert && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center animate-bounce">
          <div className="px-6 py-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 border-2 border-yellow-300 shadow-2xl shadow-red-500/80 flex items-center gap-2.5 text-white">
            <Skull className="w-6 h-6 text-yellow-300 animate-pulse" />
            <div className="flex flex-col items-center">
              <span className="font-teko text-3xl font-black tracking-wider text-yellow-200 leading-none">
                +100 {killAlert.title}
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-widest">
                {killAlert.victim}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Center Screen: Dynamic Crosshair & Hitmarker */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Dynamic Crosshair */}
        <div className="relative w-10 h-10 flex items-center justify-center">
          {/* Top tick */}
          <div
            className="absolute w-0.5 bg-white/90 shadow-sm transition-all duration-75"
            style={{
              height: isAiming ? '5px' : '7px',
              top: `calc(50% - ${crosshairGap + (isAiming ? 5 : 7)}px)`,
            }}
          />
          {/* Bottom tick */}
          <div
            className="absolute w-0.5 bg-white/90 shadow-sm transition-all duration-75"
            style={{
              height: isAiming ? '5px' : '7px',
              bottom: `calc(50% - ${crosshairGap + (isAiming ? 5 : 7)}px)`,
            }}
          />
          {/* Left tick */}
          <div
            className="absolute h-0.5 bg-white/90 shadow-sm transition-all duration-75"
            style={{
              width: isAiming ? '5px' : '7px',
              left: `calc(50% - ${crosshairGap + (isAiming ? 5 : 7)}px)`,
            }}
          />
          {/* Right tick */}
          <div
            className="absolute h-0.5 bg-white/90 shadow-sm transition-all duration-75"
            style={{
              width: isAiming ? '5px' : '7px',
              right: `calc(50% - ${crosshairGap + (isAiming ? 5 : 7)}px)`,
            }}
          />
          {/* Center dot */}
          <div className="w-1 h-1 rounded-full bg-red-500 shadow-sm" />

          {/* Hitmarker X indicator */}
          {isHitmarkerActive && (
            <div className="absolute w-6 h-6 animate-hitmarker pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-0.5 bg-red-500 shadow-sm" />
                <div className="h-6 w-0.5 bg-red-500 shadow-sm" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dead Respawn Overlay */}
      {player && !player.isAlive && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-center pointer-events-auto p-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-3 animate-pulse">
            <Crosshair className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="font-teko text-4xl sm:text-5xl font-bold text-red-500 tracking-wider">
            VOCÊ FOI ELIMINADO
          </h2>
          <p className="text-white/80 text-sm sm:text-base mt-1">
            Preparando novo spawn em local seguro...
          </p>
          <div className="mt-4 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white font-mono font-bold text-lg">
            Respawn em {player.respawnTimer || 3}s
          </div>
        </div>
      )}

      {/* Bottom HUD: Health & Ammo */}
      <div className="flex items-end justify-between w-full mb-1">
        {/* Health Bar (Left) */}
        <div className="flex flex-col gap-1 w-44 sm:w-56 p-2 rounded-xl bg-black/65 backdrop-blur-md border border-white/15 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-white/80">
              <Shield className={`w-4 h-4 ${isLowHealth ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} />
              <span className="text-xs font-bold uppercase tracking-wider">VIDA</span>
            </div>
            <span className={`font-teko text-2xl font-bold leading-none ${isLowHealth ? 'text-red-400' : 'text-emerald-300'}`}>
              {Math.round(health)}
            </span>
          </div>
          {/* Health Bar Track */}
          <div className="w-full h-2.5 rounded-full bg-neutral-800 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                health > 50
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : health > 25
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                  : 'bg-gradient-to-r from-red-600 to-rose-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, health))}%` }}
            />
          </div>
        </div>

        {/* Ammo Display (Right) */}
        <div className="flex flex-col items-end gap-0.5 px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/15 shadow-lg">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Munição</span>
          <div className="flex items-baseline gap-1">
            <span className={`font-teko text-4xl font-bold leading-none ${currentAmmo <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {currentAmmo}
            </span>
            <span className="text-sm font-bold text-neutral-400">/ {reserveAmmo}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
