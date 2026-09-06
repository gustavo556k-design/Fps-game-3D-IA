import React, { useState } from 'react';
import { Users, Plus, LogIn, Check, Crown, Copy, RefreshCw, Dices, Play, ArrowLeft, ShieldAlert, Download, X, Terminal, Globe } from 'lucide-react';
import type { Room, PlayerState } from '../types';

interface LobbyProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  currentRoom: Room | null;
  myId: string;
  availableRooms: Array<{ code: string; name: string; playersCount: number; maxPlayers: number; status: string }>;
  onCreateRoom: (name: string, maxPlayers: number) => void;
  onJoinRoom: (code: string) => void;
  onToggleReady: (ready: boolean) => void;
  onStartGame: () => void;
  onStartBotMatch: () => void;
  onLeaveRoom: () => void;
  onRefreshRooms: () => void;
  errorMessage: string | null;
  onClearError: () => void;
  isConnected?: boolean;
}

const RANDOM_NAMES = [
  'Viper', 'Ghost', 'Shadow', 'Falcon', 'Wolf',
  'Storm', 'Blaze', 'Nova', 'Phantom', 'Iron',
  'Apex', 'Titan', 'Raptor', 'Striker', 'Vortex'
];

export const Lobby: React.FC<LobbyProps> = ({
  playerName,
  onPlayerNameChange,
  currentRoom,
  myId,
  availableRooms,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onStartGame,
  onStartBotMatch,
  onLeaveRoom,
  onRefreshRooms,
  errorMessage,
  onClearError,
  isConnected = true,
}) => {
  const [createRoomName, setCreateRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'play_options' | 'join' | 'host'>('main');
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const generateRandomName = () => {
    const random = `${RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]}_${Math.floor(Math.random() * 90 + 10)}`;
    onPlayerNameChange(random);
  };

  const handleCopyCode = () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateRoom(createRoomName.trim() || `Sala de ${playerName}`, maxPlayers);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase());
  };

  // View: Waiting inside a Room
  if (currentRoom) {
    const playersList: PlayerState[] = Object.values(currentRoom.players);
    const isHost = currentRoom.hostId === myId;
    const myPlayer = currentRoom.players[myId];
    const isMyReady = myPlayer?.ready ?? false;
    const allReady = playersList.every(p => p.ready);

    return (
      <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col p-4 sm:p-6 select-none overflow-y-auto">
        <div className="max-w-2xl w-full mx-auto flex flex-col flex-1">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-6">
            <button
              id="btn-leave-room-lobby"
              onClick={onLeaveRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors text-xs font-medium border border-neutral-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Código:</span>
              <button
                id="btn-copy-code"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-700 text-white font-mono font-semibold text-sm hover:bg-neutral-800 transition-colors"
                title="Clique para copiar"
              >
                <span>{currentRoom.code}</span>
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
              </button>
            </div>
          </div>

          {/* Room Summary */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                {currentRoom.name}
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Arena 3D • {playersList.length}/{currentRoom.maxPlayers} jogadores • Partida de 5 min
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-2 sm:mt-0">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <span>{isConnected ? 'Conectado' : 'Reconectando...'}</span>
            </div>
          </div>

          {/* Players List */}
          <div className="flex-1 mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              Jogadores na sala ({playersList.length})
            </div>

            <div className="divide-y divide-neutral-850 rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
              {playersList.map((p) => {
                const isThisHost = p.id === currentRoom.hostId;
                const isMe = p.id === myId;

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3.5 hover:bg-neutral-850/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color || '#3b82f6' }}
                      />
                      <span className="font-medium text-sm text-white">
                        {p.name} {isMe && <span className="text-xs text-neutral-400 font-normal">(Você)</span>}
                      </span>
                      {isThisHost && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                          <Crown className="w-2.5 h-2.5" /> Dono
                        </span>
                      )}
                    </div>

                    <div>
                      {p.ready ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <Check className="w-3 h-3" /> Pronto
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-500">
                          Aguardando
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Controls */}
          <div className="pt-4 border-t border-neutral-800 flex flex-col sm:flex-row gap-3">
            <button
              id="btn-toggle-ready"
              onClick={() => onToggleReady(!isMyReady)}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                isMyReady
                  ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750 border border-neutral-700'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
              }`}
            >
              {isMyReady ? 'Cancelar Pronto' : 'Estou Pronto'}
            </button>

            {isHost ? (
              <button
                id="btn-start-game"
                onClick={onStartGame}
                disabled={!allReady}
                className="flex-1 py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{allReady ? 'Iniciar Partida' : 'Aguardando Jogadores'}</span>
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-neutral-500 py-2">
                Aguardando o anfitrião iniciar a partida...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // View: Main Lobby (Minimalist)
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col p-4 sm:p-8 select-none overflow-y-auto font-sans">
      <div className="max-w-xl w-full mx-auto flex flex-col flex-1 py-4 sm:py-8">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-neutral-900 border border-red-500/40 flex items-center justify-between text-red-300 text-xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={onClearError}
              className="text-neutral-400 hover:text-white px-2 py-0.5 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Minimalist Header */}
        <header className="flex items-center justify-between pb-6 border-b border-neutral-850 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Arena Strike
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              FPS 3D multiplayer em tempo real
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span>{isConnected ? 'Online' : 'Conectando'}</span>
          </div>
        </header>

        {/* Menu View Rendering */}
        {menuView === 'main' && (
          <div className="flex-1 flex flex-col justify-center pb-12">
            <div className="mb-8">
              <label className="text-sm font-medium text-neutral-400 block mb-2 text-center">
                Seu Nome de Jogador
              </label>
              <div className="flex items-center gap-2 max-w-sm mx-auto">
                <input
                  id="input-player-name"
                  type="text"
                  maxLength={18}
                  value={playerName}
                  onChange={(e) => onPlayerNameChange(e.target.value)}
                  placeholder="Digite seu nome..."
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white text-base font-medium focus:outline-none focus:border-neutral-600 transition-colors text-center"
                />
                <button
                  id="btn-random-name"
                  type="button"
                  onClick={generateRandomName}
                  className="px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors flex items-center justify-center"
                  title="Gerar nome aleatório"
                >
                  <Dices className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="max-w-sm w-full mx-auto space-y-3">
              <button
                onClick={() => setMenuView('play_options')}
                className="w-full py-4 rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-white/5"
              >
                <Play className="w-5 h-5 fill-current" />
                JOGAR
              </button>

              <button
                type="button"
                onClick={() => setShowDownloadModal(true)}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4 text-neutral-400" />
                Como Baixar o Jogo Completo
              </button>
            </div>
          </div>
        )}

        {menuView === 'play_options' && (
          <div className="flex-1 flex flex-col justify-center gap-4 max-w-sm w-full mx-auto pb-12">
            <button
              onClick={() => setMenuView('main')}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors text-xs font-medium border border-neutral-800 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>

            <button
              onClick={() => setMenuView('join')}
              className="w-full p-4 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-850 text-left transition-colors flex items-center gap-4"
            >
              <div className="p-3 rounded-lg bg-neutral-800 text-white"><LogIn className="w-6 h-6" /></div>
              <div>
                <h3 className="font-semibold text-white text-base">Entrar em uma sala</h3>
                <p className="text-neutral-400 text-xs mt-0.5">Usar código ou buscar partidas</p>
              </div>
            </button>

            <button
              onClick={() => setMenuView('host')}
              className="w-full p-4 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-850 text-left transition-colors flex items-center gap-4"
            >
              <div className="p-3 rounded-lg bg-neutral-800 text-white"><Plus className="w-6 h-6" /></div>
              <div>
                <h3 className="font-semibold text-white text-base">Hospedar uma sala</h3>
                <p className="text-neutral-400 text-xs mt-0.5">Criar partida e convidar amigos</p>
              </div>
            </button>

            <button
              onClick={onStartBotMatch}
              className="w-full p-4 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-850 text-left transition-colors flex items-center gap-4"
            >
              <div className="p-3 rounded-lg bg-neutral-800 text-white"><Users className="w-6 h-6" /></div>
              <div>
                <h3 className="font-semibold text-white text-base">Jogar com bots</h3>
                <p className="text-neutral-400 text-xs mt-0.5">Partida rápida contra a IA</p>
              </div>
            </button>
          </div>
        )}

        {menuView === 'join' && (
          <div className="flex-1 flex flex-col">
            <button
              onClick={() => setMenuView('play_options')}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors text-xs font-medium border border-neutral-800 mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>

            <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-900/40 mb-6">
              <form onSubmit={handleJoinSubmit} className="space-y-2">
                <label className="text-xs font-medium text-neutral-400 block">
                  Entrar com Código
                </label>
                <div className="flex gap-2">
                  <input
                    id="input-room-code"
                    type="text"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Código (ex: 8X2A)"
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono uppercase text-white tracking-wider focus:outline-none focus:border-neutral-600"
                  />
                  <button
                    id="btn-join-room-submit"
                    type="submit"
                    disabled={!joinCode.trim()}
                    className="px-4 py-2 rounded-lg bg-white hover:bg-neutral-200 disabled:opacity-40 text-neutral-950 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Entrar
                  </button>
                </div>
              </form>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
                <Users className="w-3.5 h-3.5" />
                <span>Salas Públicas</span>
              </div>
              <button
                id="btn-refresh-rooms"
                onClick={onRefreshRooms}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Atualizar
              </button>
            </div>

            {availableRooms.length === 0 ? (
              <div className="py-8 px-4 rounded-xl border border-neutral-850 bg-neutral-900/30 text-center text-neutral-500 text-xs">
                <p className="font-medium text-neutral-400">Nenhuma sala aberta no momento.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-850 rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
                {availableRooms.map((room) => (
                  <div key={room.code} className="flex items-center justify-between p-3 hover:bg-neutral-850/40 transition-colors">
                    <div>
                      <div className="font-medium text-sm text-white">{room.name}</div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                        <span className="font-mono text-neutral-300">{room.code}</span>
                        <span>•</span>
                        <span>{room.playersCount}/{room.maxPlayers} jogadores</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onJoinRoom(room.code)}
                      disabled={room.playersCount >= room.maxPlayers}
                      className="px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-white text-xs font-medium transition-colors"
                    >
                      {room.playersCount >= room.maxPlayers ? 'Lotada' : 'Entrar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {menuView === 'host' && (
          <div className="flex-1 flex flex-col">
            <button
              onClick={() => setMenuView('play_options')}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors text-xs font-medium border border-neutral-800 mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>

            <div className="p-5 rounded-xl border border-neutral-850 bg-neutral-900/40 mb-6">
              <form onSubmit={handleCreateSubmit} className="space-y-6">
                <div>
                  <label className="text-xs text-neutral-400 block mb-2">
                    Nome da Sala
                  </label>
                  <input
                    type="text"
                    maxLength={24}
                    value={createRoomName}
                    onChange={(e) => setCreateRoomName(e.target.value)}
                    placeholder={`Sala de ${playerName}`}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-2">
                    <span>Limite de Jogadores</span>
                    <span className="font-mono text-white font-medium">{maxPlayers}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                    className="w-full accent-neutral-200 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 font-mono mt-1">
                    <span>2</span>
                    <span>4</span>
                    <span>6</span>
                    <span>8</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-white hover:bg-neutral-200 text-neutral-950 text-sm font-semibold transition-colors"
                >
                  Criar Sala
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <footer className="pt-4 border-t border-neutral-850 text-center text-[11px] text-neutral-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>Celular: Segure na horizontal para melhor controle.</span>
        <button
          onClick={() => setShowDownloadModal(true)}
          className="text-neutral-400 hover:text-white transition-colors underline underline-offset-2 flex items-center gap-1 mx-auto sm:mx-0"
        >
          <Download className="w-3 h-3" /> Baixar Jogo Completo (Código Fonte / ZIP)
        </button>
        <span>PC: Teclado (WASD) e Mouse.</span>
      </footer>

      {/* Download / Export Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-neutral-800 text-white">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Baixar Jogo Completo</h3>
                  <p className="text-xs text-neutral-400">Código-fonte 100% pronto para rodar</p>
                </div>
              </div>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-300">
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  1. Como baixar direto da tela (ZIP):
                </div>
                <p className="text-neutral-400 leading-relaxed">
                  No menu superior ou lateral do <strong>Google AI Studio</strong>, clique no botão de <strong>Exportar / Export to GitHub or ZIP</strong> para baixar todos os arquivos do projeto em um arquivo compactado (.zip).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  2. Como rodar no seu computador (Node.js):
                </div>
                <div className="bg-neutral-900 p-2.5 rounded-lg font-mono text-[11px] text-neutral-200 space-y-1">
                  <div className="text-neutral-500"># 1. Instale as dependências</div>
                  <div className="text-emerald-400">npm install</div>
                  <div className="text-neutral-500 pt-1"># 2. Inicie o jogo e servidor multiplayer</div>
                  <div className="text-emerald-400">npm run dev</div>
                </div>
                <p className="text-neutral-400">
                  O jogo abrirá em <strong>http://localhost:3000</strong> com suporte completo para tela cheia, teclado, mouse e bots!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowDownloadModal(false)}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 font-semibold text-xs transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
