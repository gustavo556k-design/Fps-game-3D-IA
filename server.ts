import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import type { Room, PlayerState, ClientMessage, ServerMessage, KillFeedItem } from "./src/types";

const PORT = 3000;
const MATCH_DURATION = 300; // 5 minutes in seconds

// Arena tactical spawn points (expanded arena on ground level y = 0)
const SPAWN_POINTS = [
  { x: -32, y: 0, z: -32 },
  { x: 32, y: 0, z: 32 },
  { x: -32, y: 0, z: 32 },
  { x: 32, y: 0, z: -32 },
  { x: 0, y: 0, z: -34 },
  { x: 0, y: 0, z: 34 },
  { x: -34, y: 0, z: 0 },
  { x: 34, y: 0, z: 0 },
];

const WAYPOINTS = [
  { x: 0, z: 0 },
  { x: 0, z: -28 },
  { x: 26, z: 0 },
  { x: 0, z: 28 },
  { x: -26, z: 0 },
  { x: -24, z: -24 },
  { x: 24, z: 24 },
  { x: -24, z: 24 },
  { x: 24, z: -24 },
];

interface BotAIState {
  wpIndex: number;
  pauseTicks: number;
  shootCooldown: number;
  burstRemaining: number;
  burstTick: number;
  targetId: string | null;
  strafeDir: number;
  strafeTicks: number;
}
const botAIs = new Map<string, BotAIState>();

const PLAYER_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];

const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, { playerId: string; roomCode: string | null; name: string }>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getRandomSpawn() {
  const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
  return { ...spawn };
}

function broadcastToRoom(roomCode: string, msg: ServerMessage, excludeWs?: WebSocket) {
  const payload = JSON.stringify(msg);
  for (const [ws, client] of clients.entries()) {
    if (client.roomCode === roomCode && ws.readyState === WebSocket.OPEN && ws !== excludeWs) {
      ws.send(payload);
    }
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      const pathname = url.pathname;

      if (pathname === "/ws" || pathname === "/") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        // Let other handlers process or close
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", activeRooms: rooms.size, clientsCount: clients.size });
  });

  // WebSocket handling
  wss.on("connection", (ws: WebSocket) => {
    const playerId = "p_" + Math.random().toString(36).substring(2, 9);
    clients.set(ws, { playerId, roomCode: null, name: "Jogador" });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        handleClientMessage(ws, msg);
      } catch (err) {
        console.warn("Failed to parse WS message:", err);
      }
    });

    ws.on("close", () => {
      handleDisconnect(ws);
    });

    ws.on("error", (err) => {
      console.warn("WS error on client:", err);
    });
  });

  function handleClientMessage(ws: WebSocket, msg: ClientMessage) {
    const client = clients.get(ws);
    if (!client) return;

    switch (msg.type) {
      case "ping": {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "pong", timestamp: msg.timestamp }));
        }
        break;
      }

      case "room:list": {
        const list = Array.from(rooms.values()).map((r) => ({
          code: r.code,
          name: r.name,
          playersCount: Object.keys(r.players).length,
          maxPlayers: r.maxPlayers,
          status: r.status,
        }));
        ws.send(JSON.stringify({ type: "rooms:list", rooms: list }));
        break;
      }

      case "room:create": {
        let code = generateRoomCode();
        while (rooms.has(code)) {
          code = generateRoomCode();
        }

        const spawn = getRandomSpawn();
        const initialPlayer: PlayerState = {
          id: client.playerId,
          name: msg.playerName || `Jogador_${client.playerId.slice(-3)}`,
          ready: true,
          isHost: true,
          roomCode: code,
          position: spawn,
          rotation: { yaw: 0, pitch: 0 },
          health: 100,
          maxHealth: 100,
          kills: 0,
          deaths: 0,
          score: 0,
          isAlive: true,
          respawnTimer: 0,
          isMoving: false,
          isSprinting: false,
          isAiming: false,
          color: PLAYER_COLORS[0],
        };

        const newRoom: Room = {
          code,
          name: msg.name || `Sala ${code}`,
          hostId: client.playerId,
          maxPlayers: Math.min(Math.max(msg.maxPlayers || 6, 2), 8),
          status: "lobby",
          matchDuration: MATCH_DURATION,
          timeLeft: MATCH_DURATION,
          players: { [client.playerId]: initialPlayer },
          winnerId: null,
          createdAt: Date.now(),
        };

        rooms.set(code, newRoom);
        client.roomCode = code;
        client.name = initialPlayer.name;

        ws.send(JSON.stringify({ type: "room:joined", room: newRoom, myId: client.playerId }));
        break;
      }

      case "room:create_bot_match": {
        let code = generateRoomCode();
        while (rooms.has(code)) {
          code = generateRoomCode();
        }

        const spawn = getRandomSpawn();
        const initialPlayer: PlayerState = {
          id: client.playerId,
          name: msg.playerName || `Jogador_${client.playerId.slice(-3)}`,
          ready: true,
          isHost: true,
          roomCode: code,
          position: spawn,
          rotation: { yaw: 0, pitch: 0 },
          health: 100,
          maxHealth: 100,
          kills: 0,
          deaths: 0,
          score: 0,
          isAlive: true,
          respawnTimer: 0,
          isMoving: false,
          isSprinting: false,
          isAiming: false,
          color: PLAYER_COLORS[0],
        };

        const newRoom: Room = {
          code,
          name: `Treino com Bots`,
          hostId: client.playerId,
          maxPlayers: 4,
          status: "in_game",
          matchDuration: MATCH_DURATION,
          timeLeft: MATCH_DURATION,
          isBotMatch: true,
          players: { [client.playerId]: initialPlayer },
          winnerId: null,
          createdAt: Date.now(),
        };

        // Populate bots
        const BOT_NAMES = ["Viper [BOT]", "Ghost [BOT]", "Delta [BOT]", "Shadow [BOT]", "Rex [BOT]"];
        for (let i = 1; i < 4; i++) {
          const botId = `bot_${code}_${i}`;
          const botSpawn = SPAWN_POINTS[i % SPAWN_POINTS.length];
          newRoom.players[botId] = {
            id: botId,
            name: BOT_NAMES[i % BOT_NAMES.length],
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            ready: true,
            isHost: false,
            roomCode: code,
            position: { ...botSpawn },
            rotation: { yaw: Math.random() * Math.PI * 2, pitch: 0 },
            health: 100,
            maxHealth: 100,
            kills: 0,
            deaths: 0,
            score: 0,
            isAlive: true,
            respawnTimer: 0,
            isMoving: true,
            isSprinting: false,
            isAiming: false,
          };
        }

        rooms.set(code, newRoom);
        client.roomCode = code;
        client.name = initialPlayer.name;

        ws.send(JSON.stringify({ type: "room:joined", room: newRoom, myId: client.playerId }));
        broadcastToRoom(code, { type: "game:start", room: newRoom });
        break;
      }

      case "room:join": {
        const roomCode = msg.code.trim().toUpperCase();
        const targetRoom = rooms.get(roomCode);

        if (!targetRoom) {
          ws.send(JSON.stringify({ type: "error", message: "Sala não encontrada. Verifique o código digitado." }));
          return;
        }

        const currentCount = Object.keys(targetRoom.players).length;
        if (currentCount >= targetRoom.maxPlayers) {
          ws.send(JSON.stringify({ type: "error", message: "A sala já está cheia." }));
          return;
        }

        const colorIndex = currentCount % PLAYER_COLORS.length;
        const spawn = getRandomSpawn();
        const newPlayer: PlayerState = {
          id: client.playerId,
          name: msg.playerName || `Jogador_${client.playerId.slice(-3)}`,
          ready: false,
          isHost: false,
          roomCode: targetRoom.code,
          position: spawn,
          rotation: { yaw: 0, pitch: 0 },
          health: 100,
          maxHealth: 100,
          kills: 0,
          deaths: 0,
          score: 0,
          isAlive: true,
          respawnTimer: 0,
          isMoving: false,
          isSprinting: false,
          isAiming: false,
          color: PLAYER_COLORS[colorIndex],
        };

        targetRoom.players[client.playerId] = newPlayer;
        client.roomCode = targetRoom.code;
        client.name = newPlayer.name;

        ws.send(JSON.stringify({ type: "room:joined", room: targetRoom, myId: client.playerId }));
        broadcastToRoom(targetRoom.code, { type: "room:update", room: targetRoom }, ws);
        break;
      }

      case "room:ready": {
        if (!client.roomCode) return;
        const room = rooms.get(client.roomCode);
        if (!room) return;

        const player = room.players[client.playerId];
        if (player) {
          player.ready = msg.ready;
          broadcastToRoom(room.code, { type: "room:update", room });
        }
        break;
      }

      case "room:start": {
        if (!client.roomCode) return;
        const room = rooms.get(client.roomCode);
        if (!room) return;

        if (room.hostId !== client.playerId) {
          ws.send(JSON.stringify({ type: "error", message: "Apenas o dono da sala pode iniciar a partida." }));
          return;
        }

        const allReady = Object.values(room.players).every(p => p.ready);
        if (!allReady) {
          ws.send(JSON.stringify({ type: "error", message: "Todos os jogadores precisam estar prontos para iniciar." }));
          return;
        }

        // Reset positions and stats for new match
        Object.values(room.players).forEach((p, index) => {
          const spawn = SPAWN_POINTS[index % SPAWN_POINTS.length];
          p.position = { ...spawn };
          p.rotation = { yaw: 0, pitch: 0 };
          p.health = 100;
          p.kills = 0;
          p.deaths = 0;
          p.score = 0;
          p.isAlive = true;
          p.respawnTimer = 0;
        });

        room.status = "in_game";
        room.timeLeft = MATCH_DURATION;
        room.winnerId = null;

        broadcastToRoom(room.code, { type: "game:start", room });
        break;
      }

      case "room:leave": {
        handleDisconnect(ws);
        break;
      }

      case "player:move": {
        if (!client.roomCode) return;
        const room = rooms.get(client.roomCode);
        if (!room || room.status !== "in_game") return;

        const player = room.players[client.playerId];
        if (player && player.isAlive) {
          player.position = msg.position;
          player.rotation = msg.rotation;
          player.isMoving = msg.isMoving;
          player.isSprinting = msg.isSprinting;
          player.isAiming = msg.isAiming;
        }
        break;
      }

      case "player:shoot": {
        if (!client.roomCode) return;
        const room = rooms.get(client.roomCode);
        if (!room || room.status !== "in_game") return;

        const shooter = room.players[client.playerId];
        if (!shooter || !shooter.isAlive) return;

        // Broadcast shot visual/audio to everyone else in room
        broadcastToRoom(
          room.code,
          {
            type: "player:shot",
            shooterId: client.playerId,
            origin: msg.origin,
            direction: msg.direction,
            hitPoint: msg.hitPoint,
          },
          ws
        );

        // Server authoritative damage validation
        if (msg.targetPlayerId && room.players[msg.targetPlayerId]) {
          const victim = room.players[msg.targetPlayerId];
          if (victim.isAlive) {
            // Check distance from origin or shooter position
            const ox = msg.origin?.x ?? shooter.position.x;
            const oy = msg.origin?.y ?? shooter.position.y;
            const oz = msg.origin?.z ?? shooter.position.z;
            const dist = Math.hypot(ox - victim.position.x, oy - victim.position.y, oz - victim.position.z);

            // Valid range check (max 100m within arena)
            if (dist < 100) {
              const damage = 25; // 4 hits to kill
              victim.health = Math.max(0, victim.health - damage);
              const killed = victim.health <= 0;

              if (killed) {
                victim.isAlive = false;
                victim.respawnTimer = 3;
                victim.deaths += 1;
                shooter.kills += 1;
                shooter.score += 100;

                const feedEvent: KillFeedItem = {
                  id: "kf_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                  killerId: shooter.id,
                  killerName: shooter.name,
                  victimId: victim.id,
                  victimName: victim.name,
                  timestamp: Date.now(),
                };
                broadcastToRoom(room.code, { type: "killfeed", event: feedEvent });

                // Automatic respawn after 3 seconds
                setTimeout(() => {
                  if (room && room.players[victim.id]) {
                    const freshSpawn = getRandomSpawn();
                    victim.position = freshSpawn;
                    victim.health = 100;
                    victim.isAlive = true;
                    victim.respawnTimer = 0;
                    broadcastToRoom(room.code, { type: "player:respawned", player: victim });
                    broadcastToRoom(room.code, { type: "room:update", room });
                  }
                }, 3000);
              }

              broadcastToRoom(room.code, {
                type: "player:hit",
                hit: {
                  victimId: victim.id,
                  attackerId: shooter.id,
                  damage,
                  remainingHealth: victim.health,
                  killed,
                },
              });

              // Instantly synchronize room scores and kills
              broadcastToRoom(room.code, { type: "room:update", room });
            }
          }
        }
        break;
      }

      case "player:respawn": {
        if (!client.roomCode) return;
        const room = rooms.get(client.roomCode);
        if (!room) return;

        const player = room.players[client.playerId];
        if (player && !player.isAlive) {
          const spawn = getRandomSpawn();
          player.position = spawn;
          player.health = 100;
          player.isAlive = true;
          player.respawnTimer = 0;
          broadcastToRoom(room.code, { type: "player:respawned", player });
        }
        break;
      }
    }
  }

  function handleDisconnect(ws: WebSocket) {
    const client = clients.get(ws);
    if (!client) return;

    if (client.roomCode) {
      const room = rooms.get(client.roomCode);
      if (room) {
        delete room.players[client.playerId];
        const remainingPlayers = Object.values(room.players);

        if (remainingPlayers.length === 0) {
          // Delete empty room
          rooms.delete(room.code);
        } else {
          // If host left, pass host to next player
          if (room.hostId === client.playerId) {
            room.hostId = remainingPlayers[0].id;
            remainingPlayers[0].isHost = true;
          }
          broadcastToRoom(room.code, { type: "room:update", room });
        }
      }
    }

    clients.delete(ws);
  }

  // Periodic tick loop for match sync delta (25Hz = 40ms)
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.status === "in_game") {
        if (room.isBotMatch) {
          const playerList = Object.values(room.players);

          playerList.forEach((p, idx) => {
            if (p.id.startsWith("bot_") && p.isAlive) {
              p.position.y = 0; // Strictly ensure bots stay on ground level

              let ai = botAIs.get(p.id);
              if (!ai) {
                ai = {
                  wpIndex: (idx * 3) % WAYPOINTS.length,
                  pauseTicks: 0,
                  shootCooldown: Math.floor(Math.random() * 20 + 10),
                  burstRemaining: 0,
                  burstTick: 0,
                  targetId: null,
                  strafeDir: Math.random() > 0.5 ? 1 : -1,
                  strafeTicks: Math.floor(Math.random() * 30 + 15),
                };
                botAIs.set(p.id, ai);
              }

              // 1. Find closest alive enemy (human player or other alive bots)
              let closestEnemy: PlayerState | null = null;
              let closestDist = Infinity;

              for (const other of playerList) {
                if (other.id !== p.id && other.isAlive) {
                  const d = Math.hypot(other.position.x - p.position.x, other.position.z - p.position.z);
                  if (d < closestDist) {
                    closestDist = d;
                    closestEnemy = other;
                  }
                }
              }

              // 2. Combat Engagement Behavior
              if (closestEnemy && closestDist < 32) {
                ai.targetId = closestEnemy.id;
                const enemyPos = closestEnemy.position;
                const dx = enemyPos.x - p.position.x;
                const dz = enemyPos.z - p.position.z;

                // Smooth aim tracking towards enemy
                const targetYaw = Math.atan2(-dx, -dz);
                const yawDiff = ((targetYaw - p.rotation.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
                p.rotation.yaw += Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), 0.22);
                p.rotation.pitch = 0;

                // Tactical Combat Movement
                p.isMoving = true;
                if (closestDist > 12) {
                  // Advance towards enemy
                  const speed = 0.15;
                  p.position.x += (dx / closestDist) * speed;
                  p.position.z += (dz / closestDist) * speed;
                } else if (closestDist < 5) {
                  // Back up if too close
                  const speed = 0.10;
                  p.position.x -= (dx / closestDist) * speed;
                  p.position.z -= (dz / closestDist) * speed;
                } else {
                  // Strafe around enemy to dodge fire
                  ai.strafeTicks--;
                  if (ai.strafeTicks <= 0) {
                    ai.strafeDir = Math.random() > 0.5 ? 1 : -1;
                    ai.strafeTicks = Math.floor(Math.random() * 30 + 15);
                  }
                  const strafeAngle = p.rotation.yaw + (Math.PI / 2) * ai.strafeDir;
                  p.position.x += -Math.sin(strafeAngle) * 0.08;
                  p.position.z += -Math.cos(strafeAngle) * 0.08;
                }

                // Clamp within arena boundaries
                p.position.x = Math.max(-36, Math.min(36, p.position.x));
                p.position.z = Math.max(-36, Math.min(36, p.position.z));

                // 3. Bot Shooting & Combat Raycast AI
                ai.shootCooldown--;
                if (ai.shootCooldown <= 0 && Math.abs(yawDiff) < 0.55) {
                  // Reset shoot cooldown (burst of rapid shots)
                  ai.shootCooldown = Math.floor(Math.random() * 12 + 10); // ~400-800ms between bursts

                  const origin = { x: p.position.x, y: 1.4, z: p.position.z };
                  const targetAim = {
                    x: enemyPos.x + (Math.random() - 0.5) * 0.4,
                    y: 1.2 + (Math.random() - 0.5) * 0.3,
                    z: enemyPos.z + (Math.random() - 0.5) * 0.4,
                  };
                  const fdx = targetAim.x - origin.x;
                  const fdy = targetAim.y - origin.y;
                  const fdz = targetAim.z - origin.z;
                  const fLen = Math.hypot(fdx, fdy, fdz) || 1;
                  const direction = { x: fdx / fLen, y: fdy / fLen, z: fdz / fLen };

                  // Broadcast visual shot tracer and audio
                  broadcastToRoom(room.code, {
                    type: "player:shot",
                    shooterId: p.id,
                    origin,
                    direction,
                    hitPoint: targetAim,
                  });

                  // Accuracy check based on distance
                  const hitProbability = Math.max(0.4, 0.85 - (closestDist * 0.015));
                  if (Math.random() < hitProbability && closestEnemy.isAlive) {
                    const damage = Math.floor(Math.random() * 8 + 18); // 18-25 damage
                    closestEnemy.health = Math.max(0, closestEnemy.health - damage);
                    const killed = closestEnemy.health <= 0;

                    if (killed) {
                      closestEnemy.isAlive = false;
                      closestEnemy.respawnTimer = 3;
                      closestEnemy.deaths += 1;
                      p.kills += 1;
                      p.score += 100;

                      const feedEvent: KillFeedItem = {
                        id: "kf_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                        killerId: p.id,
                        killerName: p.name,
                        victimId: closestEnemy.id,
                        victimName: closestEnemy.name,
                        timestamp: Date.now(),
                      };
                      broadcastToRoom(room.code, { type: "killfeed", event: feedEvent });

                      // Automatic respawn after 3 seconds
                      const victimRef = closestEnemy;
                      setTimeout(() => {
                        if (room && room.players[victimRef.id]) {
                          const freshSpawn = getRandomSpawn();
                          victimRef.position = { ...freshSpawn, y: 0 };
                          victimRef.health = 100;
                          victimRef.isAlive = true;
                          victimRef.respawnTimer = 0;
                          broadcastToRoom(room.code, { type: "player:respawned", player: victimRef });
                          broadcastToRoom(room.code, { type: "room:update", room });
                        }
                      }, 3000);
                    }

                    broadcastToRoom(room.code, {
                      type: "player:hit",
                      hit: {
                        victimId: closestEnemy.id,
                        attackerId: p.id,
                        damage,
                        remainingHealth: closestEnemy.health,
                        killed,
                      },
                    });

                    // Update room scores
                    broadcastToRoom(room.code, { type: "room:update", room });
                  }
                }
              } else {
                // 4. Waypoint Patrol when no enemy in immediate sight
                ai.targetId = null;
                if (ai.pauseTicks > 0) {
                  ai.pauseTicks--;
                  p.isMoving = false;
                } else {
                  const targetWp = WAYPOINTS[ai.wpIndex];
                  const dx = targetWp.x - p.position.x;
                  const dz = targetWp.z - p.position.z;
                  const dist = Math.hypot(dx, dz);

                  if (dist < 2.5) {
                    ai.pauseTicks = Math.floor(Math.random() * 20 + 10);
                    ai.wpIndex = (ai.wpIndex + 1) % WAYPOINTS.length;
                    p.isMoving = false;
                  } else {
                    const speed = 0.12;
                    p.position.x += (dx / dist) * speed;
                    p.position.z += (dz / dist) * speed;
                    p.rotation.yaw = Math.atan2(-dx, -dz);
                    p.isMoving = true;
                  }
                }
              }
            }
          });
        }

        broadcastToRoom(room.code, {
          type: "game:tick",
          timeLeft: room.timeLeft,
          players: room.players,
        });
      }
    }
  }, 40);

  // 1-second interval for match timer
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.status === "in_game") {
        room.timeLeft -= 1;
        if (room.timeLeft <= 0) {
          // Match ended!
          room.status = "ended";
          const leaderboard = Object.values(room.players).sort((a, b) => b.kills - a.kills || b.score - a.score);
          room.winnerId = leaderboard.length > 0 ? leaderboard[0].id : null;
          const winner = room.winnerId ? room.players[room.winnerId] : null;

          broadcastToRoom(room.code, {
            type: "game:over",
            winner: winner || null,
            leaderboard,
          });
        }
      }
    }
  }, 1000);

  // Vite middleware for development, static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Arena Strike 3D Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
