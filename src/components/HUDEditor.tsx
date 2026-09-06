import React, { useState, useRef } from 'react';
import {
  Crosshair,
  Target,
  ArrowUp,
  RefreshCw,
  Zap,
  Sliders,
  Check,
  RotateCcw,
  X,
  Maximize2,
  Move,
  Info,
} from 'lucide-react';
import type { CustomHUDLayout, HUDButtonPosition, LayoutPreset } from '../types';
import { getPresetLayout } from '../utils/hudLayouts';

interface HUDEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentLayout: CustomHUDLayout;
  onSaveLayout: (layout: CustomHUDLayout) => void;
}

type ButtonKey = keyof CustomHUDLayout;

export const HUDEditor: React.FC<HUDEditorProps> = ({
  isOpen,
  onClose,
  currentLayout,
  onSaveLayout,
}) => {
  const [layout, setLayout] = useState<CustomHUDLayout>(() => JSON.parse(JSON.stringify(currentLayout)));
  const [selectedKey, setSelectedKey] = useState<ButtonKey>('fire');
  const containerRef = useRef<HTMLDivElement>(null);
  const dragInfoRef = useRef<{
    key: ButtonKey;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleStartDrag = (key: ButtonKey, clientX: number, clientY: number) => {
    setSelectedKey(key);
    const target = layout[key];
    if (!target) return;
    dragInfoRef.current = {
      key,
      startX: clientX,
      startY: clientY,
      initX: target.x,
      initY: target.y,
    };
  };

  const handlePointerDown = (key: ButtonKey, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleStartDrag(key, e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragInfoRef.current;
    if (!drag || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const deltaX = ((e.clientX - drag.startX) / rect.width) * 100;
    const deltaY = ((e.clientY - drag.startY) / rect.height) * 100;

    const newX = Math.max(5, Math.min(95, drag.initX + deltaX));
    const newY = Math.max(8, Math.min(92, drag.initY + deltaY));
    const roundX = Math.round(newX * 10) / 10;
    const roundY = Math.round(newY * 10) / 10;
    const targetKey = drag.key;

    setLayout((prev) => {
      if (!prev || !prev[targetKey]) return prev;
      return {
        ...prev,
        [targetKey]: {
          ...prev[targetKey],
          x: roundX,
          y: roundY,
        },
      };
    });
  };

  const handlePointerUp = () => {
    dragInfoRef.current = null;
  };

  const handleScaleChange = (scale: number) => {
    setLayout((prev) => ({
      ...prev,
      [selectedKey]: {
        ...prev[selectedKey],
        scale,
      },
    }));
  };

  const handleApplyPreset = (preset: LayoutPreset) => {
    setLayout(getPresetLayout(preset));
  };

  const handleReset = () => {
    setLayout(getPresetLayout('default'));
  };

  const handleSave = () => {
    onSaveLayout(layout);
    onClose();
  };

  const buttonLabels: Record<ButtonKey, { name: string; icon: React.ReactNode }> = {
    fire: { name: 'Tiro Principal', icon: <Crosshair className="w-5 h-5 text-rose-400" /> },
    leftFire: { name: 'Tiro Secundário (Esquerda)', icon: <Crosshair className="w-4 h-4 text-rose-300" /> },
    aim: { name: 'Mira (ADS)', icon: <Target className="w-4 h-4 text-emerald-400" /> },
    jump: { name: 'Pulo', icon: <ArrowUp className="w-4 h-4 text-sky-400" /> },
    reload: { name: 'Recarregar', icon: <RefreshCw className="w-4 h-4 text-amber-400" /> },
    sprint: { name: 'Correr', icon: <Zap className="w-4 h-4 text-amber-300" /> },
    joystick: { name: 'Joystick Virtual', icon: <Move className="w-4 h-4 text-blue-400" /> },
    settings: { name: 'Configurações', icon: <Sliders className="w-4 h-4 text-neutral-300" /> },
  };

  const currentScale = layout[selectedKey]?.scale ?? 1.0;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md select-none touch-none overflow-hidden flex flex-col justify-between"
    >
      {/* Top Floating Control Bar */}
      <div className="relative z-30 p-3 sm:p-4 bg-neutral-900/90 border-b border-white/15 backdrop-blur-lg flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400 flex items-center justify-center text-blue-400">
            <Move className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">Editor de HUD & Botões</h2>
            <p className="text-[11px] text-neutral-400 hidden sm:block">
              Arraste os botões para onde desejar na tela
            </p>
          </div>
        </div>

        {/* Selected Button Adjuster */}
        <div className="flex items-center gap-3 bg-black/50 px-3 py-1.5 rounded-xl border border-white/10">
          <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
            {buttonLabels[selectedKey].icon}
            <span>{buttonLabels[selectedKey].name}</span>
          </span>

          <div className="flex items-center gap-1.5 pl-2 border-l border-white/15">
            <span className="text-[10px] text-neutral-400">Tamanho:</span>
            <input
              type="range"
              min="0.75"
              max="1.45"
              step="0.05"
              value={currentScale}
              onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              className="w-20 sm:w-28 accent-sky-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              {Math.round(currentScale * 100)}%
            </span>
          </div>
        </div>

        {/* Presets & Actions */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => handleApplyPreset('default')}
              className="px-2.5 py-1 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Padrão
            </button>
            <button
              onClick={() => handleApplyPreset('claw3')}
              className="px-2.5 py-1 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Garra 3D
            </button>
            <button
              onClick={() => handleApplyPreset('claw4')}
              className="px-2.5 py-1 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Garra 4D
            </button>
            <button
              onClick={() => handleApplyPreset('inverted')}
              className="px-2.5 py-1 rounded-lg text-neutral-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Canhoto
            </button>
          </div>

          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-white/10 transition-colors"
            title="Restaurar Padrões"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-white/10 transition-colors"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            id="btn-save-hud"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Salvar Layout</span>
          </button>
        </div>
      </div>

      {/* Interactive Drag Surface (Grid background simulation) */}
      <div className="relative flex-1 w-full h-full">
        {/* Subtle helper grid */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Center Crosshair Reference */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center opacity-30">
          <div className="w-6 h-6 border border-white rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          <span className="text-[10px] text-white font-mono mt-1">CENTRO DA TELA</span>
        </div>

        {/* Draggable Buttons Rendering */}

        {/* 1. Virtual Joystick */}
        <div
          onPointerDown={(e) => handlePointerDown('joystick', e)}
          style={{
            position: 'absolute',
            left: `${layout.joystick.x}%`,
            top: `${layout.joystick.y}%`,
            transform: `translate(-50%, -50%) scale(${layout.joystick.scale ?? 1.0})`,
          }}
          className={`cursor-grab active:cursor-grabbing p-2 rounded-full transition-shadow ${
            selectedKey === 'joystick'
              ? 'ring-4 ring-sky-400 ring-offset-2 ring-offset-black shadow-2xl shadow-sky-500/50'
              : 'hover:ring-2 hover:ring-white/40'
          }`}
        >
          <div className="relative w-28 h-28 rounded-full bg-neutral-900/80 border-2 border-white/30 flex items-center justify-center shadow-lg">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border border-white/50 flex items-center justify-center">
              <Move className="w-4 h-4 text-white" />
            </div>
            <span className="absolute -bottom-5 text-[10px] font-bold text-sky-400 bg-black/80 px-1.5 py-0.5 rounded whitespace-nowrap">
              JOYSTICK
            </span>
          </div>
        </div>

        {/* 2. Sprint Button */}
        <div
          onPointerDown={(e) => handlePointerDown('sprint', e)}
          style={{
            position: 'absolute',
            left: `${layout.sprint.x}%`,
            top: `${layout.sprint.y}%`,
            transform: `translate(-50%, -50%) scale(${layout.sprint.scale ?? 1.0})`,
          }}
          className={`cursor-grab active:cursor-grabbing p-1 rounded-full transition-shadow ${
            selectedKey === 'sprint'
              ? 'ring-4 ring-sky-400 ring-offset-2 ring-offset-black shadow-xl shadow-sky-500/50'
              : 'hover:ring-2 hover:ring-white/40'
          }`}
        >
          <div className="px-4 py-2 rounded-full bg-amber-500/90 border border-amber-300 flex items-center gap-1.5 text-black font-bold text-xs shadow-md">
            <Zap className="w-3.5 h-3.5" />
            <span>CORRER</span>
          </div>
        </div>

        {/* 3. Primary Fire Button */}
        <div
          onPointerDown={(e) => handlePointerDown('fire', e)}
          style={{
            position: 'absolute',
            left: `${layout.fire.x}%`,
            top: `${layout.fire.y}%`,
            transform: `translate(-50%, -50%) scale(${layout.fire.scale ?? 1.15})`,
          }}
          className={`cursor-grab active:cursor-grabbing p-2 rounded-full transition-shadow ${
            selectedKey === 'fire'
              ? 'ring-4 ring-rose-400 ring-offset-2 ring-offset-black shadow-2xl shadow-rose-500/60'
              : 'hover:ring-2 hover:ring-white/40'
          }`}
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 border-2 border-rose-300 flex flex-col items-center justify-center text-white shadow-xl">
            <Crosshair className="w-8 h-8 text-white drop-shadow" />
            <span className="text-[10px] font-black tracking-wider uppercase mt-0.5">FOGO</span>
          </div>
        </div>

        {/* 4. Secondary Left Fire Button */}
        <div
          onPointerDown={(e) => handlePointerDown('leftFire', e)}
          style={{
            position: 'absolute',
            left: `${layout.leftFire.x}%`,
            top: `${layout.leftFire.y}%`,
            transform: `translate(-50%, -50%) scale(${layout.leftFire.scale ?? 1.0})`,
          }}
          className={`cursor-grab active:cursor-grabbing p-2 rounded-full transition-shadow ${
            selectedKey === 'leftFire'
              ? 'ring-4 ring-rose-400 ring-offset-2 ring-offset-black shadow-2xl shadow-rose-500/60'
              : 'hover:ring-2 hover:ring-white/40'
          }`}
        >
          <div className="w-15 h-15 rounded-full bg-gradient-to-tr from-rose-600/90 to-red-500/90 border-2 border-rose-300 flex flex-col items-center justify-center text-white shadow-lg">
            <Crosshair className="w-6 h-6 text-white" />
            <span className="text-[9px] font-extrabold uppercase mt-0.5">TIRO ESQ</span>
          </div>
        </div>

        {/* 5. Aim Button */}
        <div
          onPointerDown={(e) => handlePointerDown('aim', e)}
          style={{
            position: 'absolute',
            left: `${layout.aim.x}%`,
            top: `${layout.aim.y}%`,
            transform: `translate(-50%, -50%) scale(${layout.aim.scale ?? 1.0})`,
          }}
          className={`cursor-grab active:cursor-grabbing p-1.5 rounded-full transition-shadow ${
            selectedKey === 'aim'
              ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-black shadow-2xl shadow-emerald-500/60'
              : 'hover:ring-2 hover:ring-white/40'
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-emerald-600 border-2 border-emerald-300 flex flex-col items-center justify-center text-white shadow-lg">
            <Target className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase mt-0.5">MIRA</span>
          </div>
        </div>

        {/* 6. Jump Button */}
        <div
          onPointerDown={(e) => handlePointerDown('jump', e)}
          style={{
            position: 'absolute',
            left: `${layout.jump.x}%`,
            top: `${layout.jump.y}%`,
            transform: `translate(-50%, -50%) scale(${layout.jump.scale ?? 1.0})`,
          }}
          className={`cursor-grab active:cursor-grabbing p-1.5 rounded-full transition-shadow ${
            selectedKey === 'jump'
              ? 'ring-4 ring-sky-400 ring-offset-2 ring-offset-black shadow-2xl shadow-sky-500/60'
              : 'hover:ring-2 hover:ring-white/40'
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-neutral-900/80 border-2 border-sky-400 flex flex-col items-center justify-center text-sky-400 shadow-lg">
            <ArrowUp className="w-6 h-6" />
            <span className="text-[8px] font-bold uppercase mt-0.5 text-white">PULAR</span>
          </div>
        </div>

        {/* 7. Reload Button */}
        <div
          onPointerDown={(e) => handlePointerDown('reload', e)}
          style={{
            position: 'absolute',
            left: `${layout.reload.x}%`,
            top: `${layout.reload.y}%`,
            transform: `translate(-50%, -50%) scale(${layout.reload.scale ?? 1.0})`,
          }}
          className={`cursor-grab active:cursor-grabbing p-1.5 rounded-full transition-shadow ${
            selectedKey === 'reload'
              ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-black shadow-2xl shadow-amber-500/60'
              : 'hover:ring-2 hover:ring-white/40'
          }`}
        >
          <div className="w-13 h-13 rounded-full bg-neutral-900/80 border-2 border-amber-400 flex flex-col items-center justify-center text-amber-400 shadow-lg">
            <RefreshCw className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase mt-0.5 text-white">RECARREGAR</span>
          </div>
        </div>

        {/* 8. Settings Button */}
        <div
          onPointerDown={(e) => handlePointerDown('settings', e)}
          style={{
            position: 'absolute',
            left: `${layout.settings.x}%`,
            top: `${layout.settings.y}%`,
            transform: `translate(-50%, -50%) scale(${layout.settings.scale ?? 0.9})`,
          }}
          className={`cursor-grab active:cursor-grabbing p-1.5 rounded-full transition-shadow ${
            selectedKey === 'settings'
              ? 'ring-4 ring-white ring-offset-2 ring-offset-black shadow-xl'
              : 'hover:ring-2 hover:ring-white/40'
          }`}
        >
          <div className="w-11 h-11 rounded-full bg-neutral-900/90 border border-white/30 flex items-center justify-center text-white/80 shadow-md">
            <Sliders className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Bottom helper tip */}
      <div className="p-2.5 bg-black/70 border-t border-white/10 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
        <Info className="w-3.5 h-3.5 text-sky-400" />
        <span>Toque ou clique em qualquer botão para selecioná-lo e arraste para posicionar. Ajuste o tamanho na barra superior.</span>
      </div>
    </div>
  );
};
