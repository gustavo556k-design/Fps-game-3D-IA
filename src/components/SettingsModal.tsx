import React, { useState } from 'react';
import {
  Sliders,
  Volume2,
  VolumeX,
  RotateCcw,
  Keyboard,
  LogOut,
  X,
  Smartphone,
  Crosshair,
  Target,
  Move,
  Check,
  Maximize2,
} from 'lucide-react';
import type { ControlLayoutConfig, LayoutPreset, AimMode } from '../types';
import { soundManager } from '../utils/audio';
import { getPresetLayout } from '../utils/hudLayouts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ControlLayoutConfig;
  onUpdateConfig: (newConfig: ControlLayoutConfig) => void;
  onLeaveGame: () => void;
  onOpenHUDEditor?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onLeaveGame,
  onOpenHUDEditor,
}) => {
  const [activeTab, setActiveTab] = useState<'mobile' | 'general'>('mobile');

  if (!isOpen) return null;

  const handleSensitivityChange = (val: number) => {
    onUpdateConfig({ ...config, sensitivity: val });
  };

  const handleScaleChange = (val: number) => {
    onUpdateConfig({ ...config, scale: val });
  };

  const handleActionBottomChange = (val: number) => {
    onUpdateConfig({ ...config, actionButtonsBottom: val });
  };

  const handleActionRightChange = (val: number) => {
    onUpdateConfig({ ...config, actionButtonsRight: val });
  };

  const handleJoystickBottomChange = (val: number) => {
    onUpdateConfig({ ...config, joystickBottom: val });
  };

  const handleJoystickLeftChange = (val: number) => {
    onUpdateConfig({ ...config, joystickLeft: val });
  };

  const handleToggleInvertY = () => {
    onUpdateConfig({ ...config, invertY: !config.invertY });
  };

  const handleToggleMute = () => {
    soundManager.enabled = !soundManager.enabled;
    onUpdateConfig({ ...config });
  };

  const handlePresetSelect = (preset: LayoutPreset) => {
    const layout = getPresetLayout(preset);
    if (preset === 'claw3') {
      onUpdateConfig({
        ...config,
        preset,
        customHUD: layout,
        showLeftFireButton: true,
      });
    } else if (preset === 'claw4') {
      onUpdateConfig({
        ...config,
        preset,
        customHUD: layout,
        showLeftFireButton: true,
        aimMode: 'hold',
      });
    } else if (preset === 'inverted') {
      onUpdateConfig({
        ...config,
        preset,
        customHUD: layout,
        showLeftFireButton: false,
      });
    } else {
      onUpdateConfig({
        ...config,
        preset: 'default',
        customHUD: layout,
        showLeftFireButton: false,
        aimMode: 'toggle',
      });
    }
  };

  const handleAimModeChange = (mode: AimMode) => {
    onUpdateConfig({ ...config, aimMode: mode });
  };

  const handleToggleLeftFire = () => {
    onUpdateConfig({ ...config, showLeftFireButton: !config.showLeftFireButton });
  };

  const handleResetDefaults = () => {
    onUpdateConfig({
      scale: 1.0,
      joystickSize: 140,
      fireButtonSize: 88,
      aimButtonSize: 56,
      jumpButtonSize: 56,
      reloadButtonSize: 52,
      sprintButtonSize: 40,
      sensitivity: 1.0,
      invertY: false,
      vibration: true,
      preset: 'default',
      aimMode: 'toggle',
      showLeftFireButton: false,
      actionButtonsBottom: 24,
      actionButtonsRight: 24,
      joystickBottom: 24,
      joystickLeft: 24,
      customHUD: getPresetLayout('default'),
    });
  };

  const presets: { id: LayoutPreset; name: string; desc: string; icon: string }[] = [
    {
      id: 'default',
      name: 'Padrão (Polegares)',
      desc: 'Joystick à esquerda, ações e disparo à direita.',
      icon: '👍',
    },
    {
      id: 'claw3',
      name: 'Garra 3 Dedos',
      desc: 'Fogo secundário no topo esquerdo para mirar e atirar simultaneamente.',
      icon: '🎯',
    },
    {
      id: 'claw4',
      name: 'Garra 4 Dedos',
      desc: 'Fogo no topo esq., Mira no topo dir. para controle profissional.',
      icon: '⚡',
    },
    {
      id: 'inverted',
      name: 'Canhoto',
      desc: 'Inverte joystick para direita e ações de tiro para esquerda.',
      icon: '🔄',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="max-w-lg w-full bg-neutral-900 border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold text-white">Configurações do Jogo</h2>
          </div>
          <button
            id="btn-close-settings"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-4 p-1 bg-black/40 rounded-xl border border-white/10">
          <button
            id="tab-btn-mobile"
            onClick={() => setActiveTab('mobile')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'mobile'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Layout Celular</span>
          </button>
          <button
            id="tab-btn-general"
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'general'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Geral & PC</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-4 flex-1 text-xs text-neutral-300 overflow-y-auto pr-1">
          {activeTab === 'mobile' && (
            <>
              {/* Direct Drag-and-Drop HUD Customization Button */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-900/40 via-sky-900/30 to-indigo-900/40 border-2 border-sky-500/50 shadow-lg flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                    <Move className="w-4 h-4 text-sky-400" />
                    <span>Personalizar Posição dos Botões</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 mt-0.5 leading-snug">
                    Abra o editor interativo para arrastar e posicionar cada botão livremente na tela.
                  </p>
                </div>
                <button
                  id="btn-open-hud-editor"
                  onClick={() => {
                    onClose();
                    if (onOpenHUDEditor) onOpenHUDEditor();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-sky-500/30 shrink-0 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Editar HUD</span>
                </button>
              </div>

              {/* Presets Grid */}
              <div>
                <label className="block text-white font-bold mb-2 flex items-center gap-1.5">
                  <span>Predefinição de Layout dos Botões</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((p) => {
                    const isSelected = config.preset === p.id;
                    return (
                      <button
                        key={p.id}
                        id={`btn-preset-${p.id}`}
                        onClick={() => handlePresetSelect(p.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-600/20'
                            : 'bg-neutral-800/60 border-white/10 hover:border-white/20 text-neutral-300'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        <div className="text-sm font-bold text-white flex items-center gap-1">
                          <span>{p.icon}</span>
                          <span>{p.name}</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-1 leading-snug line-clamp-2">
                          {p.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aim Mode (Toggle vs Hold) */}
              <div className="p-3 rounded-2xl bg-neutral-800/50 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-emerald-400" />
                      Modo de Disparo e Mira (ADS)
                    </span>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      Possibilidade de mirar e atirar ao mesmo tempo
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    id="btn-aim-mode-toggle"
                    onClick={() => handleAimModeChange('toggle')}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                      config.aimMode === 'toggle'
                        ? 'bg-emerald-600/30 border-emerald-400 text-white font-bold'
                        : 'bg-neutral-900 border-white/10 text-neutral-400'
                    }`}
                  >
                    <div className="font-bold">Toque para Alternar</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">1 toque liga/desliga</div>
                  </button>
                  <button
                    id="btn-aim-mode-hold"
                    onClick={() => handleAimModeChange('hold')}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                      config.aimMode === 'hold'
                        ? 'bg-emerald-600/30 border-emerald-400 text-white font-bold'
                        : 'bg-neutral-900 border-white/10 text-neutral-400'
                    }`}
                  >
                    <div className="font-bold">Segurar para Mirar</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">Solte para desarmar</div>
                  </button>
                </div>
              </div>

              {/* Secondary Left Fire Button */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-800/50 border border-white/10">
                <div className="pr-3">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-rose-400" />
                    Botão de Fogo Secundário (Esquerda)
                  </span>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    Adiciona botão de tiro na esquerda para atirar com a mão esquerda enquanto mira com a direita.
                  </p>
                </div>
                <button
                  id="btn-toggle-left-fire"
                  onClick={handleToggleLeftFire}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider border shrink-0 transition-all ${
                    config.showLeftFireButton || config.preset === 'claw3' || config.preset === 'claw4'
                      ? 'bg-rose-600 text-white border-rose-400'
                      : 'bg-neutral-900 text-neutral-400 border-white/10'
                  }`}
                >
                  {config.showLeftFireButton || config.preset === 'claw3' || config.preset === 'claw4'
                    ? 'Ativado'
                    : 'Desativado'}
                </button>
              </div>

              {/* Sliders for Button Positions */}
              <div className="p-3 rounded-2xl bg-neutral-800/50 border border-white/10 space-y-3">
                <div className="flex items-center gap-1.5 text-white font-bold">
                  <Move className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ajuste de Posição dos Botões (HUD)</span>
                </div>

                {/* Action Buttons Height */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-neutral-300">Altura dos Botões de Ação (Rodapé)</span>
                    <span className="font-mono text-sky-400 font-bold">{config.actionButtonsBottom ?? 24}px</span>
                  </div>
                  <input
                    id="slider-action-bottom"
                    type="range"
                    min="12"
                    max="110"
                    step="2"
                    value={config.actionButtonsBottom ?? 24}
                    onChange={(e) => handleActionBottomChange(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>

                {/* Action Buttons Side Margin */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-neutral-300">Distância Lateral dos Botões de Ação</span>
                    <span className="font-mono text-sky-400 font-bold">{config.actionButtonsRight ?? 24}px</span>
                  </div>
                  <input
                    id="slider-action-right"
                    type="range"
                    min="10"
                    max="80"
                    step="2"
                    value={config.actionButtonsRight ?? 24}
                    onChange={(e) => handleActionRightChange(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>

                {/* Joystick Height */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-neutral-300">Altura do Joystick Virtual</span>
                    <span className="font-mono text-blue-400 font-bold">{config.joystickBottom ?? 24}px</span>
                  </div>
                  <input
                    id="slider-joystick-bottom"
                    type="range"
                    min="12"
                    max="110"
                    step="2"
                    value={config.joystickBottom ?? 24}
                    onChange={(e) => handleJoystickBottomChange(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                {/* Joystick Side Margin */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-neutral-300">Distância Lateral do Joystick</span>
                    <span className="font-mono text-blue-400 font-bold">{config.joystickLeft ?? 24}px</span>
                  </div>
                  <input
                    id="slider-joystick-left"
                    type="range"
                    min="10"
                    max="80"
                    step="2"
                    value={config.joystickLeft ?? 24}
                    onChange={(e) => handleJoystickLeftChange(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Button Size / Scale */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-white">Escala Geral dos Botões</span>
                  <span className="font-mono text-emerald-400 font-bold">{Math.round(config.scale * 100)}%</span>
                </div>
                <input
                  id="slider-button-scale"
                  type="range"
                  min="0.8"
                  max="1.35"
                  step="0.05"
                  value={config.scale}
                  onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-0.5">
                  <span>80% (Pequeno)</span>
                  <span>100% (Padrão)</span>
                  <span>135% (Grande)</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'general' && (
            <>
              {/* Sensitivity */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-white">Sensibilidade da Mira</span>
                  <span className="font-mono text-sky-400 font-bold">{config.sensitivity.toFixed(1)}x</span>
                </div>
                <input
                  id="slider-sensitivity"
                  type="range"
                  min="0.4"
                  max="2.5"
                  step="0.1"
                  value={config.sensitivity}
                  onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Invert Y */}
              <div className="flex items-center justify-between py-1">
                <span className="font-bold text-white">Inverter Eixo Y (Câmera)</span>
                <button
                  id="btn-toggle-inverty"
                  onClick={handleToggleInvertY}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all ${
                    config.invertY
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-neutral-800 text-neutral-400 border-white/10'
                  }`}
                >
                  {config.invertY ? 'Ligado' : 'Desligado'}
                </button>
              </div>

              {/* Sound Mute */}
              <div className="flex items-center justify-between py-1">
                <span className="font-bold text-white">Efeitos Sonoros</span>
                <button
                  id="btn-toggle-audio"
                  onClick={handleToggleMute}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all ${
                    soundManager.enabled
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-neutral-800 text-neutral-400 border-white/10'
                  }`}
                >
                  {soundManager.enabled ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Ativo</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Mudo</span>
                    </>
                  )}
                </button>
              </div>

              {/* PC Controls Info Card */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs">
                <div className="flex items-center gap-1.5 text-sky-400 font-bold mb-2">
                  <Keyboard className="w-4 h-4" />
                  <span>Controles no Computador (PC)</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-neutral-400 text-[11px]">
                  <div><span className="text-white font-bold">W, A, S, D:</span> Mover</div>
                  <div><span className="text-white font-bold">Mouse:</span> Olhar (Clique para travar)</div>
                  <div><span className="text-white font-bold">Botão Esq.:</span> Atirar (Pressione/Segure)</div>
                  <div><span className="text-white font-bold">Botão Dir.:</span> Mirar (Segure p/ ADS)</div>
                  <div><span className="text-white font-bold">Espaço:</span> Pular</div>
                  <div><span className="text-white font-bold">Shift:</span> Correr</div>
                  <div><span className="text-white font-bold">R:</span> Recarregar</div>
                  <div><span className="text-white font-bold">Esc:</span> Liberar cursor</div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-emerald-400 font-medium">
                  💡 Dica: No PC, segure o Botão Direito para mirar e clique ou segure o Botão Esquerdo para atirar simultaneamente com precisão aumentada.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/10 mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              id="btn-reset-settings"
              onClick={handleResetDefaults}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrões</span>
            </button>
            <button
              id="btn-resume-game"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-600/30"
            >
              Confirmar & Jogar
            </button>
          </div>

          {/* Leave Match */}
          <button
            id="btn-leave-match"
            onClick={onLeaveGame}
            className="w-full py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Abandonar Partida e Voltar ao Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
};
