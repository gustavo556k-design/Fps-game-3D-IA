import React from 'react';
import { Trophy, Crown, ArrowLeft, Users } from 'lucide-react';
import type { PlayerState } from '../types';

interface MatchEndModalProps {
  winner: PlayerState | null;
  leaderboard: PlayerState[];
  myId: string;
  onReturnToLobby: () => void;
}

export const MatchEndModal: React.FC<MatchEndModalProps> = ({
  winner,
  leaderboard,
  myId,
  onReturnToLobby,
}) => {
  const isWinnerMe = winner?.id === myId;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="max-w-lg w-full bg-gradient-to-b from-neutral-900 to-neutral-950 border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Banner */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-neutral-850 border border-neutral-750 flex items-center justify-center text-amber-400">
            <Trophy className="w-6 h-6" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isWinnerMe ? 'Vitória!' : 'Fim da Partida'}
          </h2>

          <p className="text-neutral-400 text-xs sm:text-sm mt-1">
            {winner ? (
              <span className="flex items-center justify-center gap-1.5 text-neutral-300 font-medium">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> Vencedor: {winner.name} ({winner.kills} eliminações)
              </span>
            ) : (
              'Empate na arena'
            )}
          </p>
        </div>

        {/* Leaderboard Table */}
        <div className="flex-1 overflow-y-auto mb-6 bg-black/40 rounded-2xl border border-white/10 p-3">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            <div className="flex items-center gap-3">
              <span className="w-6 text-center">#</span>
              <span>Jogador</span>
            </div>
            <div className="flex items-center gap-6">
              <span>Eliminações</span>
              <span>Mortes</span>
              <span>Score</span>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {leaderboard.map((p, index) => {
              const isMe = p.id === myId;
              const isFirst = index === 0;

              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                    isMe ? 'bg-blue-600/20 border border-blue-500/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-teko text-lg font-bold">
                      {isFirst ? (
                        <Crown className="w-4 h-4 text-amber-400 inline" />
                      ) : (
                        <span className="text-neutral-500">{index + 1}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: p.color || '#3b82f6' }}
                      />
                      <span className={`font-bold text-sm truncate max-w-[110px] sm:max-w-[140px] ${isMe ? 'text-blue-300' : 'text-white'}`}>
                        {p.name} {isMe && '(Você)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 font-mono font-bold text-sm">
                    <span className="w-10 text-right text-emerald-400">{p.kills}</span>
                    <span className="w-10 text-right text-rose-400">{p.deaths}</span>
                    <span className="w-12 text-right text-amber-300">{p.score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <button
          id="btn-return-lobby"
          onClick={onReturnToLobby}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold tracking-wider uppercase text-sm flex items-center justify-center gap-2 border border-blue-400 shadow-xl shadow-blue-600/40 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Lobby</span>
        </button>
      </div>
    </div>
  );
};
