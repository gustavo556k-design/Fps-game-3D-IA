import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Room,
  PlayerState,
  ServerMessage,
  ClientMessage,
  KillFeedItem,
  ShootPayload,
  ControlLayoutConfig,
} from './types';
import { GameEngine } from './game/GameEngine';
import { Lobby } from './components/Lobby';
import { HUD } from './components/HUD';
import { TouchControls } from './components/TouchControls';
import { SettingsModal } from './components/SettingsModal';
import { MatchEndModal } from './components/MatchEndModal';
import { HUDEditor } from './components/HUDEditor';
import { getPresetLayout } from './utils/hudLayouts';
import { soundManager } from './utils/audio';

const STORAGE_NAME_KEY = 'arenastrike_player_name';
const STORAGE_CONFIG_KEY = 'arenastrike_controls_config';

const DEFAULT_CONFIG: ControlLayoutConfig = {
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
};

export default function App() {
  // Player identity
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_NAME_KEY) || `Soldado_${Math.floor(Math.random() * 900 + 100)}`;
  });
  const [myId, setMyId] = useState<string>('');

  // Rooms & Game state
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [availableRooms, setAvailableRooms] = useState<
    Array<{ code: string; name: string; playersCount: number; maxPlayers: number; status: string }>
  >([]);
  const [inGame, setInGame] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gameOverData, setGameOverData] = useState<{
    winner: PlayerState | null;
    leaderboard: PlayerState[];
  } | null>(null);

  // HUD & Combat Feedback
  const [currentAmmo, setCurrentAmmo] = useState<number>(30);
  const [maxAmmo, setMaxAmmo] = useState<number>(30);
  const [reserveAmmo, setReserveAmmo] = useState<number>(120);
  const [isHitmarkerActive, setIsHitmarkerActive] = useState<boolean>(false);
  const [isTakingDamage, setIsTakingDamage] = useState<boolean>(false);
  const [isAiming, setIsAiming] = useState<boolean>(false);
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [isSprinting, setIsSprinting] = useState<boolean>(false);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [killAlert, setKillAlert] = useState<{ title: string; victim: string } | null>(null);

  // Settings & HUD Customizer
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHUDEditorOpen, setIsHUDEditorOpen] = useState<boolean>(false);
  const [controlConfig, setControlConfig] = useState<ControlLayoutConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          customHUD: parsed.customHUD || getPresetLayout(parsed.preset || 'default'),
        };
      }
      return DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const gameEngineRef = useRef<GameEngine | null>(null);
  const gameCanvasContainerRef = useRef<HTMLDivElement>(null);
  const lastMoveSentRef = useRef<number>(0);
  const myIdRef = useRef<string>(myId);
  myIdRef.current = myId;
  const currentRoomRef = useRef<Room | null>(currentRoom);
  currentRoomRef.current = currentRoom;

  // Save config
  const updateControlConfig = (newConfig: Partial<ControlLayoutConfig>) => {
    setControlConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(updated));
      if (gameEngineRef.current) {
        if (updated.sensitivity !== undefined) gameEngineRef.current.sensitivity = updated.sensitivity;
        if (updated.invertY !== undefined) gameEngineRef.current.invertY = updated.invertY;
      }
      return updated;
    });
  };

  // Save player name
  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    localStorage.setItem(STORAGE_NAME_KEY, name);
  };

  // WebSocket connection & messaging
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const sendWs = useCallback((msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleServerMessageRef = useRef<(msg: ServerMessage) => void>(() => {});

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const connectWebSocket = () => {
      if (!isMounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        sendWs({ type: 'room:list' });
      };

      socket.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          handleServerMessageRef.current(msg);
        } catch {
          // Ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        reconnectTimeout = setTimeout(() => {
          connectWebSocket();
        }, 2000);
      };

      socket.onerror = () => {
        // Handled silently
      };
    };

    connectWebSocket();

    const pingInterval = setInterval(() => {
      sendWs({ type: 'ping', timestamp: Date.now() });
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sendWs]);

  const handleServerMessage = (msg: ServerMessage) => {
    const currentMyId = myIdRef.current;

    switch (msg.type) {
      case 'rooms:list': {
        setAvailableRooms(msg.rooms);
        break;
      }

      case 'room:joined': {
        setCurrentRoom(msg.room);
        setMyId(msg.myId);
        myIdRef.current = msg.myId;
        setErrorMessage(null);
        break;
      }

      case 'room:update': {
        setCurrentRoom(msg.room);
        break;
      }

      case 'game:start': {
        setCurrentRoom(msg.room);
        setTimeLeft(msg.room.timeLeft);
        setInGame(true);
        setGameOverData(null);
        setKillFeed([]);
        break;
      }

      case 'game:tick': {
        // Optimization for Mobile: DO NOT force a full React re-render 25 times per second!
        // We only update React state if the visual HUD needs it (timeLeft changed, or my player stats changed).
        setCurrentRoom((prev) => {
          if (!prev) return prev;
          
          let shouldUpdate = false;
          if (prev.timeLeft !== msg.timeLeft) {
            setTimeLeft(msg.timeLeft);
            shouldUpdate = true;
          }

          const myPrevPlayer = prev.players[currentMyId];
          const myNewPlayer = msg.players[currentMyId];
          
          if (myPrevPlayer && myNewPlayer) {
            if (
              myPrevPlayer.health !== myNewPlayer.health ||
              myPrevPlayer.kills !== myNewPlayer.kills ||
              myPrevPlayer.deaths !== myNewPlayer.deaths ||
              myPrevPlayer.isAlive !== myNewPlayer.isAlive
            ) {
              shouldUpdate = true;
            }
          } else if (myNewPlayer) {
            shouldUpdate = true;
          }

          if (shouldUpdate) {
            return { ...prev, timeLeft: msg.timeLeft, players: msg.players };
          }
          
          // CRITICAL: Mutate the players reference directly ONLY for the ref so the GameEngine can access it,
          // but return the EXACT SAME 'prev' object to tell React to BAIL OUT of rendering.
          prev.players = msg.players;
          return prev;
        });

        if (gameEngineRef.current) {
          gameEngineRef.current.updateRemotePlayers(msg.players);
          const myPlayer = msg.players[currentMyId];
          if (myPlayer) {
            gameEngineRef.current.setAlive(myPlayer.isAlive);
          }
        }
        break;
      }

      case 'player:shot': {
        if (gameEngineRef.current && msg.shooterId !== currentMyId) {
          gameEngineRef.current.handleRemoteShot(msg.shooterId, msg.origin, msg.direction, msg.hitPoint);
        }
        break;
      }

      case 'player:hit': {
        if (msg.hit.victimId === currentMyId) {
          soundManager.playDamage();
          setIsTakingDamage(true);
          setTimeout(() => setIsTakingDamage(false), 400);
        }

        if (msg.hit.attackerId === currentMyId) {
          soundManager.playHitmarker();
          if (msg.hit.killed) {
            soundManager.playKill();
            setKillAlert({ title: 'ELIMINADO!', victim: 'Alvo Neutralizado' });
            setTimeout(() => setKillAlert(null), 2500);
          }
        }

        if (gameEngineRef.current) {
          gameEngineRef.current.handlePlayerHit(msg.hit.victimId, msg.hit.remainingHealth, msg.hit.killed);
        }

        setCurrentRoom((prev) => {
          if (!prev) return prev;
          const updatedPlayers = { ...prev.players };
          if (updatedPlayers[msg.hit.victimId]) {
            updatedPlayers[msg.hit.victimId] = {
              ...updatedPlayers[msg.hit.victimId],
              health: msg.hit.remainingHealth,
              isAlive: !msg.hit.killed,
              deaths: msg.hit.killed ? updatedPlayers[msg.hit.victimId].deaths + 1 : updatedPlayers[msg.hit.victimId].deaths,
            };
          }
          if (updatedPlayers[msg.hit.attackerId] && msg.hit.killed) {
            updatedPlayers[msg.hit.attackerId] = {
              ...updatedPlayers[msg.hit.attackerId],
              kills: updatedPlayers[msg.hit.attackerId].kills + 1,
              score: updatedPlayers[msg.hit.attackerId].score + 100,
            };
          }
          return { ...prev, players: updatedPlayers };
        });
        break;
      }

      case 'killfeed': {
        setKillFeed((prev) => [...prev, msg.event].slice(-5));
        if (msg.event.killerId === currentMyId) {
          setKillAlert({ title: 'ELIMINADO!', victim: msg.event.victimName });
          soundManager.playKill();
          setTimeout(() => setKillAlert(null), 2500);
        }
        break;
      }

      case 'player:respawned': {
        if (msg.player.id === currentMyId && gameEngineRef.current) {
          gameEngineRef.current.setSpawnPosition(msg.player.position);
          gameEngineRef.current.setAlive(true);
        }
        break;
      }

      case 'game:over': {
        setGameOverData({ winner: msg.winner, leaderboard: msg.leaderboard });
        break;
      }

      case 'error': {
        setErrorMessage(msg.message);
        break;
      }
    }
  };

  handleServerMessageRef.current = handleServerMessage;

  // Mount 3D GameEngine when inGame changes
  useEffect(() => {
    if (inGame && gameCanvasContainerRef.current) {
      const container = gameCanvasContainerRef.current;

      const engine = new GameEngine(container, {
        onShoot: (payload) => {
          sendWs({
            type: 'player:shoot',
            origin: payload.origin,
            direction: payload.direction,
            hitPoint: payload.hitPoint,
            targetPlayerId: payload.targetPlayerId,
          });
        },
        onAmmoChange: (current, max) => {
          setCurrentAmmo(current);
          setMaxAmmo(max);
        },
        onHitmarker: () => {
          setIsHitmarkerActive(true);
          setTimeout(() => setIsHitmarkerActive(false), 200);
        },
        onAimChange: (aim) => {
          setIsAiming(aim);
        },
        onMoveUpdate: (pos, rot, moving, sprinting, aiming) => {
          setIsMoving(moving);
          setIsSprinting(sprinting);
          setIsAiming(aiming);

          // Throttle network move update to ~30Hz
          const now = performance.now();
          if (now - lastMoveSentRef.current > 33) {
            lastMoveSentRef.current = now;
            sendWs({
              type: 'player:move',
              position: pos,
              rotation: rot,
              isMoving: moving,
              isSprinting: sprinting,
              isAiming: aiming,
            });
          }
        },
      });

      engine.myId = myIdRef.current;
      engine.myName = playerName;
      engine.sensitivity = controlConfig.sensitivity;
      engine.invertY = controlConfig.invertY;

      // Position local player at assigned spawn point on match start
      const curRoom = currentRoomRef.current;
      if (curRoom && curRoom.players[myIdRef.current]) {
        engine.setSpawnPosition(curRoom.players[myIdRef.current].position);
      }

      gameEngineRef.current = engine;

      return () => {
        engine.destroy();
        gameEngineRef.current = null;
      };
    }
  }, [inGame]); // STRICTLY mount on inGame changes only to prevent repeated teardown and teleports

  // Touch control handlers
  const handleMoveVector = useCallback((vec: { x: number; y: number }) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.touchMoveVector = vec;
    }
  }, []);

  const handleLookDelta = useCallback((delta: { x: number; y: number }) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.touchLookDelta = delta;
    }
  }, []);

  const handleFireChange = useCallback((isFiring: boolean) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.isFiringTouch = isFiring;
    }
  }, []);

  const handleAimToggle = useCallback(() => {
    if (gameEngineRef.current) {
      const nextAim = !gameEngineRef.current.isAiming;
      gameEngineRef.current.setAiming(nextAim);
      setIsAiming(nextAim);
    }
  }, []);

  const handleAimSet = useCallback((aim: boolean) => {
    if (gameEngineRef.current) {
      gameEngineRef.current.setAiming(aim);
      setIsAiming(aim);
    }
  }, []);

  const handleJump = useCallback(() => {
    if (gameEngineRef.current) {
      gameEngineRef.current.jump();
    }
  }, []);

  const handleReload = useCallback(() => {
    if (gameEngineRef.current) {
      gameEngineRef.current.reload();
      setIsReloading(true);
      setTimeout(() => setIsReloading(false), 1200);
    }
  }, []);

  const handleSprintToggle = useCallback((sprint: boolean) => {
    setIsSprinting(sprint);
  }, []);

  // Lobby actions
  const handleCreateRoom = (roomName: string, maxP: number) => {
    sendWs({
      type: 'room:create',
      name: roomName,
      playerName,
      maxPlayers: maxP,
    });
  };

  const handleJoinRoom = (code: string) => {
    sendWs({
      type: 'room:join',
      code,
      playerName,
    });
  };

  const handleToggleReady = (ready: boolean) => {
    sendWs({ type: 'room:ready', ready });
  };

  const handleStartGame = () => {
    sendWs({ type: 'room:start' });
  };

  const handleStartBotMatch = () => {
    sendWs({ type: 'room:create_bot_match', playerName });
  };

  const handleLeaveRoom = () => {
    sendWs({ type: 'room:leave' });
    setCurrentRoom(null);
    setInGame(false);
    setGameOverData(null);
    sendWs({ type: 'room:list' });
  };

  const handleReturnToLobby = () => {
    setGameOverData(null);
    setInGame(false);
    if (currentRoom) {
      currentRoom.status = 'lobby';
    }
  };

  const myPlayer = currentRoom && myId ? currentRoom.players[myId] || null : null;

  return (
    <div className="w-screen h-screen overflow-hidden bg-neutral-950 font-rajdhani select-none relative">
      {/* 3D Game Canvas Container (Active during match) */}
      <div
        ref={gameCanvasContainerRef}
        id="game-canvas-container"
        className={`absolute inset-0 w-full h-full ${inGame ? 'block' : 'hidden'}`}
      />

      {/* In-Game Touch Controls & HUD */}
      {inGame && (
        <>
          <HUD
            player={myPlayer}
            currentAmmo={currentAmmo}
            maxAmmo={maxAmmo}
            reserveAmmo={reserveAmmo}
            timeLeft={timeLeft}
            killFeed={killFeed}
            roomCode={currentRoom?.code || ''}
            isHitmarkerActive={isHitmarkerActive}
            isTakingDamage={isTakingDamage}
            isAiming={isAiming}
            isMoving={isMoving}
            killAlert={killAlert}
            onOpenHUDEditor={() => setIsHUDEditorOpen(true)}
          />

          <TouchControls
            onMoveVector={handleMoveVector}
            onLookDelta={handleLookDelta}
            onFireChange={handleFireChange}
            onAimToggle={handleAimToggle}
            onAimSet={handleAimSet}
            isAiming={isAiming}
            onJump={handleJump}
            onReload={handleReload}
            isReloading={isReloading}
            onSprintToggle={handleSprintToggle}
            isSprinting={isSprinting}
            currentAmmo={currentAmmo}
            maxAmmo={maxAmmo}
            config={controlConfig}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </>
      )}

      {/* Lobby / Matchmaking UI (when not in game) */}
      {!inGame && (
        <Lobby
          playerName={playerName}
          onPlayerNameChange={handlePlayerNameChange}
          currentRoom={currentRoom}
          myId={myId}
          availableRooms={availableRooms}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onToggleReady={handleToggleReady}
          onStartGame={handleStartGame}
          onStartBotMatch={handleStartBotMatch}
          onLeaveRoom={handleLeaveRoom}
          onRefreshRooms={() => sendWs({ type: 'room:list' })}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
          isConnected={isConnected}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={controlConfig}
        onUpdateConfig={updateControlConfig}
        onLeaveGame={() => {
          setIsSettingsOpen(false);
          handleLeaveRoom();
        }}
        onOpenHUDEditor={() => {
          setIsSettingsOpen(false);
          setIsHUDEditorOpen(true);
        }}
      />

      {/* Visual Custom HUD Button Positioning Editor */}
      <HUDEditor
        isOpen={isHUDEditorOpen}
        onClose={() => setIsHUDEditorOpen(false)}
        currentLayout={controlConfig.customHUD || getPresetLayout('default')}
        onSaveLayout={(layout) => {
          updateControlConfig({ customHUD: layout });
          setIsHUDEditorOpen(false);
        }}
      />

      {/* Match End Results Modal */}
      {gameOverData && (
        <MatchEndModal
          winner={gameOverData.winner}
          leaderboard={gameOverData.leaderboard}
          myId={myId}
          onReturnToLobby={handleReturnToLobby}
        />
      )}
    </div>
  );
}
