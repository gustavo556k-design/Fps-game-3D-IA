import * as THREE from 'three';
import { soundManager } from '../utils/audio';
import type { PlayerState } from '../types';

export interface GameEngineCallbacks {
  onShoot: (payload: {
    playerId: string;
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
    hitPoint: { x: number; y: number; z: number } | null;
    targetPlayerId: string | null;
  }) => void;
  onAmmoChange: (current: number, max: number) => void;
  onHitmarker: () => void;
  onAimChange?: (isAiming: boolean) => void;
  onMoveUpdate: (
    pos: { x: number; y: number; z: number },
    rot: { yaw: number; pitch: number },
    isMoving: boolean,
    isSprinting: boolean,
    isAiming: boolean
  ) => void;
}

interface RemotePlayerRecord {
  group: THREE.Group;
  targetPos: THREE.Vector3;
  targetYaw: number;
  nameSprite: THREE.Sprite;
  healthBar: THREE.Mesh;
  hitboxMesh: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  bodyMeshes: THREE.Mesh[];
  walkCycle: number;
  isAlive: boolean;
  isHitFlashing: boolean;
  fallProgress: number;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private animationFrameId: number | null = null;

  // Player state
  public myId: string = '';
  public myName: string = '';
  private isAlive: boolean = true;
  private playerPos = new THREE.Vector3(0, 1.2, 0);
  private playerVelocity = new THREE.Vector3();
  private yaw: number = 0;
  private pitch: number = 0;
  private isGrounded: boolean = true;
  private isMoving: boolean = false;
  private isSprinting: boolean = false;
  public isAiming: boolean = false;

  // Weapon state
  public currentAmmo: number = 30;
  public maxAmmo: number = 30;
  public reserveAmmo: number = 120;
  public isReloading: boolean = false;
  private lastShootTime: number = 0;
  private fireRateMs: number = 110; // ~9 rounds/sec
  private gunGroup!: THREE.Group;
  private muzzleFlash!: THREE.PointLight;
  private muzzleSprite!: THREE.Mesh;
  private gunDefaultPos = new THREE.Vector3(0.24, -0.22, -0.45);
  private gunAimPos = new THREE.Vector3(0.0, -0.165, -0.32);
  private gunRecoil = new THREE.Vector3();
  private walkBob = 0;

  // Arena & Collisions
  private collisionBoxes: THREE.Box3[] = [];
  private collidableMeshes: THREE.Mesh[] = [];
  private playerHitboxes: THREE.Mesh[] = [];
  private remotePlayersMap = new Map<string, RemotePlayerRecord>();

  // Input states
  public touchMoveVector = { x: 0, y: 0 };
  public touchLookDelta = { x: 0, y: 0 };
  public isFiringTouch: boolean = false;
  public isFiringMouse: boolean = false;
  public sensitivity: number = 1.0;
  public invertY: boolean = false;

  private keys: Record<string, boolean> = {};
  private isPointerLocked: boolean = false;

  // Tracers & particles
  private tracers: { line: THREE.Line; life: number }[] = [];
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

  // Pre-allocated reusable vectors to eliminate garbage collection stutters on mobile
  private tempMoveDir = new THREE.Vector3();
  private tempForward = new THREE.Vector3();
  private tempRight = new THREE.Vector3();

  constructor(container: HTMLElement, callbacks: GameEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.initScene();
    this.buildArena();
    this.buildFirstPersonWeapon();
    this.setupControls();
    this.animate();
  }

  private initScene() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    // Clean bright white/soft-neutral ambient scene
    this.scene.background = new THREE.Color('#f1f5f9');
    this.scene.fog = new THREE.FogExp2('#f1f5f9', 0.008);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.05, 150);
    this.camera.position.set(0, 1.6, 0);
    // YXZ rotation order ensures yaw turns horizontally without tilting camera sideways
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      precision: 'mediump',
      antialias: true,
      stencil: false,
    });
    this.renderer.setSize(width, height);

    // Optimize DPR for mobile web: retina/high-DPI screens can be 3x-4x which overheats mobile GPUs
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
    // On mobile, lock DPR to 1.0 max. Rendering 1080p+ 3D on a phone browser destroys frame rates.
    const targetDPR = isMobile ? Math.min(window.devicePixelRatio, 1.0) : Math.min(window.devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(targetDPR);

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = false;
    this.container.appendChild(this.renderer.domElement);

    // Uniform, clean lighting without heavy shadow passes
    const hemiLight = new THREE.HemisphereLight('#ffffff', '#cbd5e1', 1.05);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 0.95);
    dirLight.position.set(30, 50, 25);
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight('#cbd5e1', 0.4);
    fillLight.position.set(-30, 25, -25);
    this.scene.add(fillLight);

    window.addEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  // Clean, modern, expanded tactical arena (96m x 96m) without crate textures, without floor lines, and without heavy shadows
  private buildArena() {
    // 1. Pure solid architectural materials (No heavy textures, lightweight Lambert materials)
    const floorMat = new THREE.MeshLambertMaterial({
      color: '#f8fafc', // Solid clean pristine light ground, completely seamless without lines
    });

    const wallMat = new THREE.MeshLambertMaterial({
      color: '#ffffff', // Pure solid white walls
    });

    const trimMat = new THREE.MeshLambertMaterial({
      color: '#0f172a', // Dark modern architectural trims
    });

    const blueSolidMat = new THREE.MeshLambertMaterial({
      color: '#2563eb', // Solid vibrant blue
    });

    const redSolidMat = new THREE.MeshLambertMaterial({
      color: '#dc2626', // Solid vibrant red
    });

    const platformMat = new THREE.MeshLambertMaterial({
      color: '#1e293b', // Modern dark tactical slate
    });

    const stepMat = new THREE.MeshLambertMaterial({
      color: '#334155', // Walkable low steps
    });

    // 2. Main Expanded Arena Floor (96m x 96m - Clean solid surface with NO grid lines)
    const floorGeo = new THREE.PlaneGeometry(96, 96);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // 3. Perimeter Containment Walls (Height 6m, boundary +/-48m)
    const wallH = 6;
    // North wall
    this.addStaticBox(new THREE.Vector3(0, wallH / 2, -48), new THREE.Vector3(96, wallH, 1), wallMat);
    this.addStaticBox(new THREE.Vector3(0, wallH + 0.15, -48), new THREE.Vector3(96.2, 0.3, 1.2), trimMat);

    // South wall
    this.addStaticBox(new THREE.Vector3(0, wallH / 2, 48), new THREE.Vector3(96, wallH, 1), wallMat);
    this.addStaticBox(new THREE.Vector3(0, wallH + 0.15, 48), new THREE.Vector3(96.2, 0.3, 1.2), trimMat);

    // East wall
    this.addStaticBox(new THREE.Vector3(48, wallH / 2, 0), new THREE.Vector3(1, wallH, 96), wallMat);
    this.addStaticBox(new THREE.Vector3(48, wallH + 0.15, 0), new THREE.Vector3(1.2, 0.3, 96.2), trimMat);

    // West wall
    this.addStaticBox(new THREE.Vector3(-48, wallH / 2, 0), new THREE.Vector3(1, wallH, 96), wallMat);
    this.addStaticBox(new THREE.Vector3(-48, wallH + 0.15, 0), new THREE.Vector3(1.2, 0.3, 96.2), trimMat);

    // 4. Central Plaza (Praça Central) - 16m x 16m raised combat deck
    this.addStaticBox(new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(16, 0.5, 16), platformMat);

    // Walkable low steps on 4 sides (Height 0.25m, width 6m, depth 1.4m)
    this.addStaticBox(new THREE.Vector3(0, 0.125, -8.7), new THREE.Vector3(6, 0.25, 1.4), stepMat);
    this.addStaticBox(new THREE.Vector3(0, 0.125, 8.7), new THREE.Vector3(6, 0.25, 1.4), stepMat);
    this.addStaticBox(new THREE.Vector3(-8.7, 0.125, 0), new THREE.Vector3(1.4, 0.25, 6), stepMat);
    this.addStaticBox(new THREE.Vector3(8.7, 0.125, 0), new THREE.Vector3(1.4, 0.25, 6), stepMat);

    // Central Core Monument
    this.addStaticBox(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(3.2, 2.0, 3.2), trimMat);

    // 4 Deck Tactical Pillars
    this.addStaticBox(new THREE.Vector3(5, 1.4, -5), new THREE.Vector3(1.6, 1.8, 1.6), blueSolidMat);
    this.addStaticBox(new THREE.Vector3(-5, 1.4, -5), new THREE.Vector3(1.6, 1.8, 1.6), redSolidMat);
    this.addStaticBox(new THREE.Vector3(5, 1.4, 5), new THREE.Vector3(1.6, 1.8, 1.6), redSolidMat);
    this.addStaticBox(new THREE.Vector3(-5, 1.4, 5), new THREE.Vector3(1.6, 1.8, 1.6), blueSolidMat);

    // 5. North Sector - Blue Outpost & High Ground (z: -24 to -38)
    this.addStaticBox(new THREE.Vector3(0, 0.5, -34), new THREE.Vector3(18, 1.0, 7), platformMat);
    this.addStaticBox(new THREE.Vector3(-10, 0.25, -34), new THREE.Vector3(2, 0.5, 5), stepMat);
    this.addStaticBox(new THREE.Vector3(10, 0.25, -34), new THREE.Vector3(2, 0.5, 5), stepMat);
    this.addStaticBox(new THREE.Vector3(0, 1.4, -30.5), new THREE.Vector3(14, 0.8, 0.8), blueSolidMat);
    this.addStaticBox(new THREE.Vector3(-16, 1.1, -26), new THREE.Vector3(4, 2.2, 2), blueSolidMat);
    this.addStaticBox(new THREE.Vector3(16, 1.1, -26), new THREE.Vector3(4, 2.2, 2), blueSolidMat);
    this.addStaticBox(new THREE.Vector3(0, 0.7, -20), new THREE.Vector3(8, 1.4, 1.2), blueSolidMat);

    // 6. South Sector - Red Outpost & High Ground (z: 24 to 38)
    this.addStaticBox(new THREE.Vector3(0, 0.5, 34), new THREE.Vector3(18, 1.0, 7), platformMat);
    this.addStaticBox(new THREE.Vector3(-10, 0.25, 34), new THREE.Vector3(2, 0.5, 5), stepMat);
    this.addStaticBox(new THREE.Vector3(10, 0.25, 34), new THREE.Vector3(2, 0.5, 5), stepMat);
    this.addStaticBox(new THREE.Vector3(0, 1.4, 30.5), new THREE.Vector3(14, 0.8, 0.8), redSolidMat);
    this.addStaticBox(new THREE.Vector3(-16, 1.1, 26), new THREE.Vector3(4, 2.2, 2), redSolidMat);
    this.addStaticBox(new THREE.Vector3(16, 1.1, 26), new THREE.Vector3(4, 2.2, 2), redSolidMat);
    this.addStaticBox(new THREE.Vector3(0, 0.7, 20), new THREE.Vector3(8, 1.4, 1.2), redSolidMat);

    // 7. East Sector - Tactical Alley & Cover Blocks (x: 22 to 38)
    this.addStaticBox(new THREE.Vector3(30, 1.2, -12), new THREE.Vector3(4, 2.4, 10), redSolidMat);
    this.addStaticBox(new THREE.Vector3(30, 1.2, 12), new THREE.Vector3(4, 2.4, 10), blueSolidMat);
    this.addStaticBox(new THREE.Vector3(38, 1.0, 0), new THREE.Vector3(2, 2.0, 12), redSolidMat);
    this.addStaticBox(new THREE.Vector3(22, 0.8, 0), new THREE.Vector3(2, 1.6, 6), blueSolidMat);

    // 8. West Sector - Tactical Alley & Cover Blocks (x: -22 to -38)
    this.addStaticBox(new THREE.Vector3(-30, 1.2, -12), new THREE.Vector3(4, 2.4, 10), blueSolidMat);
    this.addStaticBox(new THREE.Vector3(-30, 1.2, 12), new THREE.Vector3(4, 2.4, 10), redSolidMat);
    this.addStaticBox(new THREE.Vector3(-38, 1.0, 0), new THREE.Vector3(2, 2.0, 12), blueSolidMat);
    this.addStaticBox(new THREE.Vector3(-22, 0.8, 0), new THREE.Vector3(2, 1.6, 6), redSolidMat);

    // 9. Diagonal Flank Towers (Height 3m)
    this.addStaticBox(new THREE.Vector3(-18, 1.5, -18), new THREE.Vector3(3.2, 3.0, 3.2), blueSolidMat);
    this.addStaticBox(new THREE.Vector3(18, 1.5, -18), new THREE.Vector3(3.2, 3.0, 3.2), redSolidMat);
    this.addStaticBox(new THREE.Vector3(-18, 1.5, 18), new THREE.Vector3(3.2, 3.0, 3.2), redSolidMat);
    this.addStaticBox(new THREE.Vector3(18, 1.5, 18), new THREE.Vector3(3.2, 3.0, 3.2), blueSolidMat);

    // 10. Outer Perimeter Corner Bunkers
    this.addStaticBox(new THREE.Vector3(-34, 1.2, -34), new THREE.Vector3(4, 2.4, 4), blueSolidMat);
    this.addStaticBox(new THREE.Vector3(34, 1.2, -34), new THREE.Vector3(4, 2.4, 4), redSolidMat);
    this.addStaticBox(new THREE.Vector3(-34, 1.2, 34), new THREE.Vector3(4, 2.4, 4), redSolidMat);
    this.addStaticBox(new THREE.Vector3(34, 1.2, 34), new THREE.Vector3(4, 2.4, 4), blueSolidMat);
  }

  private addStaticBox(pos: THREE.Vector3, size: THREE.Vector3, mat: THREE.Material) {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    // Axis-aligned collision box
    const min = new THREE.Vector3(pos.x - size.x / 2, pos.y - size.y / 2, pos.z - size.z / 2);
    const max = new THREE.Vector3(pos.x + size.x / 2, pos.y + size.y / 2, pos.z + size.z / 2);
    this.collisionBoxes.push(new THREE.Box3(min, max));
    this.collidableMeshes.push(mesh);
  }

  // First-Person sci-fi blaster weapon attached to camera
  private buildFirstPersonWeapon() {
    this.gunGroup = new THREE.Group();

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#181a20', roughness: 0.3, metalness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.38), bodyMat);
    this.gunGroup.add(body);

    // Barrel
    const barrelMat = new THREE.MeshStandardMaterial({ color: '#2a2e38', roughness: 0.2, metalness: 0.9 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 12), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.28);
    this.gunGroup.add(barrel);

    // Magazine
    const magMat = new THREE.MeshStandardMaterial({ color: '#0f1115', roughness: 0.5 });
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), magMat);
    mag.position.set(0, -0.07, -0.04);
    mag.rotation.x = 0.15;
    this.gunGroup.add(mag);

    // Holographic sight rail
    const sightMat = new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.2, metalness: 0.8 });
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.08), sightMat);
    sight.position.set(0, 0.055, -0.05);
    this.gunGroup.add(sight);

    // Glowing energy tube
    const glowMat = new THREE.MeshBasicMaterial({ color: '#06b6d4' });
    const glowTube = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.015, 0.22), glowMat);
    glowTube.position.set(0, 0.01, -0.08);
    this.gunGroup.add(glowTube);

    // Muzzle light & flash sprite
    this.muzzleFlash = new THREE.PointLight('#ffaa33', 0, 8);
    this.muzzleFlash.position.set(0, 0.015, -0.42);
    this.gunGroup.add(this.muzzleFlash);

    const flashGeo = new THREE.OctahedronGeometry(0.06);
    const flashMat = new THREE.MeshBasicMaterial({ color: '#ffea75', transparent: true, opacity: 0 });
    this.muzzleSprite = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleSprite.position.set(0, 0.015, -0.42);
    this.gunGroup.add(this.muzzleSprite);

    this.gunGroup.position.copy(this.gunDefaultPos);
    this.camera.add(this.gunGroup);
    this.scene.add(this.camera);
  }

  private setupControls() {
    // Keyboard listeners
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR') {
        this.reload();
      }
      if (e.code === 'Space') {
        this.jump();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Pointer Lock for PC mouse controls
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (!this.isPointerLocked && window.matchMedia('(pointer: fine)').matches) {
        canvas.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;
      const sens = 0.0022 * this.sensitivity;
      this.yaw -= e.movementX * sens;
      const pitchDelta = e.movementY * sens * (this.invertY ? -1 : 1);
      this.pitch = Math.max(-Math.PI * 0.44, Math.min(Math.PI * 0.44, this.pitch - pitchDelta));
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.isPointerLocked) {
        this.isFiringMouse = true;
        this.shoot();
      } else if (e.button === 2 && this.isPointerLocked) {
        this.setAiming(true);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isFiringMouse = false;
      } else if (e.button === 2) {
        this.setAiming(false);
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.isPointerLocked) e.preventDefault();
    });
  }

  public setSpawnPosition(pos: { x: number; y: number; z: number }) {
    this.playerPos.set(pos.x, pos.y, pos.z);
    this.playerVelocity.set(0, 0, 0);
    this.camera.position.set(pos.x, pos.y + 0.6, pos.z);
  }

  public setAlive(alive: boolean) {
    this.isAlive = alive;
    if (!alive) {
      this.gunGroup.visible = false;
      this.isFiringMouse = false;
      this.isFiringTouch = false;
    } else {
      this.gunGroup.visible = true;
    }
  }

  public setAiming(aim: boolean) {
    if (this.isAiming !== aim) {
      this.isAiming = aim;
      if (this.callbacks.onAimChange) {
        this.callbacks.onAimChange(aim);
      }
    }
  }

  public jump() {
    if (!this.isAlive || !this.isGrounded) return;
    this.playerVelocity.y = 6.2;
    this.isGrounded = false;
    soundManager.playJump();
  }

  public reload() {
    if (this.isReloading || this.currentAmmo >= this.maxAmmo || this.reserveAmmo <= 0) return;
    this.isReloading = true;
    soundManager.playReload();

    setTimeout(() => {
      const needed = this.maxAmmo - this.currentAmmo;
      const toLoad = Math.min(needed, this.reserveAmmo);
      this.currentAmmo += toLoad;
      this.reserveAmmo -= toLoad;
      this.isReloading = false;
      this.callbacks.onAmmoChange(this.currentAmmo, this.maxAmmo);
    }, 1500);
  }

  public shoot() {
    if (!this.isAlive || this.isReloading) return;
    const now = performance.now();
    if (now - this.lastShootTime < this.fireRateMs) return;

    if (this.currentAmmo <= 0) {
      this.reload();
      return;
    }

    this.lastShootTime = now;
    this.currentAmmo--;
    this.callbacks.onAmmoChange(this.currentAmmo, this.maxAmmo);

    // Recoil
    soundManager.playShoot();
    this.gunRecoil.z = this.isAiming ? 0.04 : 0.08;
    this.gunRecoil.y = this.isAiming ? 0.015 : 0.03;
    this.pitch += this.isAiming ? 0.007 : 0.015;

    // Flash
    this.muzzleFlash.intensity = 3.5;
    (this.muzzleSprite.material as THREE.MeshBasicMaterial).opacity = 0.9;
    setTimeout(() => {
      this.muzzleFlash.intensity = 0;
      (this.muzzleSprite.material as THREE.MeshBasicMaterial).opacity = 0;
    }, 45);

    // High-precision raycast
    const raycaster = new THREE.Raycaster();
    const spreadX = this.isAiming ? 0 : (Math.random() - 0.5) * 0.014;
    const spreadY = this.isAiming ? 0 : (Math.random() - 0.5) * 0.014;
    raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), this.camera);

    // 1. Raycast against static arena obstacles
    const arenaIntersects = raycaster.intersectObjects(this.collidableMeshes, false);
    const closestArenaDist = arenaIntersects.length > 0 ? arenaIntersects[0].distance : Infinity;

    // 2. Raycast against active player hitboxes
    const activeHitboxes = this.playerHitboxes.filter((h) => h.visible);
    const playerIntersects = raycaster.intersectObjects(activeHitboxes, false);

    let targetPlayerId: string | null = null;
    let hitPoint: { x: number; y: number; z: number } | null = null;

    if (playerIntersects.length > 0 && playerIntersects[0].distance < closestArenaDist) {
      // Direct hit on enemy player!
      const hit = playerIntersects[0];
      targetPlayerId = hit.object.userData.playerId;
      hitPoint = { x: hit.point.x, y: hit.point.y, z: hit.point.z };

      this.callbacks.onHitmarker();
      soundManager.playHitmarker();
      this.spawnImpactParticles(hit.point, '#ef4444');
    } else if (arenaIntersects.length > 0) {
      // Hit wall/floor obstacle
      const hit = arenaIntersects[0];
      hitPoint = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
      this.spawnImpactParticles(hit.point, '#cbd5e1');
    }

    // Tracer visual
    const origin = new THREE.Vector3();
    this.gunGroup.getWorldPosition(origin);
    const direction = raycaster.ray.direction.clone();
    const dest = hitPoint
      ? new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z)
      : origin.clone().add(direction.clone().multiplyScalar(60));
    this.createTracer(origin, dest);

    // Emit shoot to server
    this.callbacks.onShoot({
      playerId: this.myId,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      hitPoint,
      targetPlayerId,
    });
  }

  private createTracer(start: THREE.Vector3, end: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  }

  public handleRemoteShot(
    _shooterId: string,
    origin: { x: number; y: number; z: number },
    _direction: { x: number; y: number; z: number },
    hitPoint: { x: number; y: number; z: number } | null
  ) {
    const start = new THREE.Vector3(origin.x, origin.y, origin.z);
    const end = hitPoint
      ? new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z)
      : start.clone().add(new THREE.Vector3(0, 0, -30));
    this.createTracer(start, end);
    soundManager.playShoot();
  }

  // Handle visual impact and death on a player
  public handlePlayerHit(victimId: string, remainingHealth: number, killed: boolean) {
    const record = this.remotePlayersMap.get(victimId);
    if (!record) return;

    // Flash character red
    record.isHitFlashing = true;
    record.bodyMeshes.forEach((mesh) => {
      if (mesh.material && 'color' in mesh.material) {
        (mesh.material as any).color.set('#ff2222');
      }
    });

    setTimeout(() => {
      record.isHitFlashing = false;
      record.bodyMeshes.forEach((mesh) => {
        if (mesh.material && 'color' in mesh.material && mesh.userData.originalColor) {
          (mesh.material as any).color.set(mesh.userData.originalColor);
        }
      });
    }, 150);

    // Update health bar
    const hpRatio = Math.max(0, remainingHealth / 100);
    record.healthBar.scale.x = hpRatio;
    (record.healthBar.material as THREE.MeshBasicMaterial).color.set(
      hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444'
    );

    if (killed) {
      record.isAlive = false;
      record.hitboxMesh.visible = false;
    }
  }

  private spawnImpactParticles(pos: THREE.Vector3, colorHex: string) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const pMesh = new THREE.Mesh(geo, mat);
      pMesh.position.copy(pos);
      this.scene.add(pMesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 4
      );
      this.particles.push({ mesh: pMesh, vel, life: 0.28 });
    }
  }

  // Update remote player models
  public updateRemotePlayers(players: Record<string, PlayerState>) {
    // Remove disconnected players
    for (const [id, remote] of this.remotePlayersMap.entries()) {
      if (!players[id] || id === this.myId) {
        this.scene.remove(remote.group);
        const idx = this.playerHitboxes.indexOf(remote.hitboxMesh);
        if (idx !== -1) this.playerHitboxes.splice(idx, 1);
        this.remotePlayersMap.delete(id);
      }
    }

    // Add or update
    for (const [id, player] of Object.entries(players)) {
      if (id === this.myId) continue;

      let remote = this.remotePlayersMap.get(id);
      if (!remote) {
        remote = this.createRealisticFPSAvatar(player);
        this.remotePlayersMap.set(id, remote);
        this.playerHitboxes.push(remote.hitboxMesh);
        this.scene.add(remote.group);
      }

      remote.targetPos.set(player.position.x, player.position.y, player.position.z);
      remote.targetYaw = player.rotation.yaw;
      remote.isAlive = player.isAlive;
      remote.hitboxMesh.visible = player.isAlive;

      if (!player.isAlive) {
        remote.nameSprite.visible = false;
        remote.healthBar.visible = false;
      } else {
        remote.nameSprite.visible = true;
        remote.healthBar.visible = true;
        remote.fallProgress = 0;
        remote.group.rotation.x = 0;
      }

      // Update health bar scale
      const hpRatio = Math.max(0, player.health / 100);
      remote.healthBar.scale.x = hpRatio;
      (remote.healthBar.material as THREE.MeshBasicMaterial).color.set(
        hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444'
      );
    }
  }

  // Realistic 3D FPS Character Model (Tactical Operator / Combat Soldier)
  private createRealisticFPSAvatar(player: PlayerState): RemotePlayerRecord {
    const group = new THREE.Group();
    const bodyMeshes: THREE.Mesh[] = [];

    const playerColor = player.color || '#2563eb';

    // Materials
    const uniformMat = new THREE.MeshStandardMaterial({
      color: '#1e293b', // Tactical combat uniform
      roughness: 0.6,
      metalness: 0.1,
    });
    const vestMat = new THREE.MeshStandardMaterial({
      color: '#334155', // Plate carrier vest
      roughness: 0.5,
      metalness: 0.15,
    });
    const insigniaMat = new THREE.MeshStandardMaterial({
      color: playerColor, // Team/Player identification flag & accents
      roughness: 0.4,
      metalness: 0.2,
    });
    const gearMat = new THREE.MeshStandardMaterial({
      color: '#0f172a', // Matte black tactical gear / pouches / holster
      roughness: 0.7,
      metalness: 0.2,
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: '#1e293b', // Ballistic FAST helmet
      roughness: 0.4,
      metalness: 0.25,
    });
    const goggleMat = new THREE.MeshStandardMaterial({
      color: '#0284c7', // Reflective ballistic tactical goggles
      roughness: 0.1,
      metalness: 0.9,
    });
    const gunMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.3,
      metalness: 0.75,
    });

    const registerMesh = (m: THREE.Mesh, origColor: string) => {
      m.userData = { originalColor: origColor, playerId: player.id };
      bodyMeshes.push(m);
      return m;
    };

    // 1. Torso & Tactical Plate Carrier
    const torsoGroup = new THREE.Group();
    // Inner uniform body
    const bodyMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.26), uniformMat), '#1e293b');
    bodyMesh.position.y = 0.95;
    torsoGroup.add(bodyMesh);

    // Plate carrier vest (chest armor)
    const vestMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.3), vestMat), '#334155');
    vestMesh.position.set(0, 0.98, 0);
    torsoGroup.add(vestMesh);

    // Team color identification Velcro patch on chest
    const patchMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.02), insigniaMat), playerColor);
    patchMesh.position.set(0, 1.05, 0.155);
    torsoGroup.add(patchMesh);

    // Triple rifle magazine pouches on chest
    for (let i = -1; i <= 1; i++) {
      const magPouch = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.06), gearMat), '#0f172a');
      magPouch.position.set(i * 0.1, 0.88, 0.16);
      torsoGroup.add(magPouch);
    }

    // Tactical combat belt with buckle & side pouch
    const beltMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.28), gearMat), '#0f172a');
    beltMesh.position.set(0, 0.68, 0);
    torsoGroup.add(beltMesh);

    const radioPouch = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.07), gearMat), '#0f172a');
    radioPouch.position.set(-0.21, 1.1, -0.02);
    torsoGroup.add(radioPouch);

    group.add(torsoGroup);

    // 2. Realistic Head & Tactical FAST Helmet
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.35, 0);

    // Balaclava head
    const faceMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), uniformMat), '#1e293b');
    faceMesh.position.y = 0.12;
    headGroup.add(faceMesh);

    // Curved ballistic helmet dome
    const helmetGeo = new THREE.SphereGeometry(0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const helmetMesh = registerMesh(new THREE.Mesh(helmetGeo, helmetMat), '#1e293b');
    helmetMesh.position.set(0, 0.18, -0.01);
    headGroup.add(helmetMesh);

    // NVG forehead mount shroud
    const nvgMount = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.04), gearMat), '#0f172a');
    nvgMount.position.set(0, 0.22, 0.14);
    headGroup.add(nvgMount);

    // Tactical goggles over eyes with reflective lens
    const goggleMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.06), goggleMat), '#0284c7');
    goggleMesh.position.set(0, 0.14, 0.11);
    headGroup.add(goggleMesh);

    // Tactical communications headset (ear cups)
    const leftEar = registerMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), gearMat), '#0f172a');
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-0.125, 0.12, 0);
    headGroup.add(leftEar);

    const rightEar = registerMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), gearMat), '#0f172a');
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(0.125, 0.12, 0);
    headGroup.add(rightEar);

    group.add(headGroup);

    // 3. Arms & Hands holding realistic Assault Rifle
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.29, 1.2, 0.02);
    const lUpperArm = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.32, 0.12), uniformMat), '#1e293b');
    lUpperArm.position.y = -0.16;
    leftArm.add(lUpperArm);

    // Left forearm angled forward to support weapon handguard
    const lForearm = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.1), uniformMat), '#1e293b');
    lForearm.position.set(0.08, -0.32, 0.14);
    lForearm.rotation.x = -0.8;
    lForearm.rotation.y = -0.4;
    leftArm.add(lForearm);
    group.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.29, 1.2, 0.02);
    const rUpperArm = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.32, 0.12), uniformMat), '#1e293b');
    rUpperArm.position.y = -0.16;
    rightArm.add(rUpperArm);

    // Right forearm holding pistol grip
    const rForearm = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.1), uniformMat), '#1e293b');
    rForearm.position.set(-0.06, -0.3, 0.12);
    rForearm.rotation.x = -0.7;
    rForearm.rotation.y = 0.2;
    rightArm.add(rForearm);
    group.add(rightArm);

    // 4. Realistic Assault Rifle (Carbine in tactical ready stance)
    const rifleGroup = new THREE.Group();
    rifleGroup.position.set(0.12, 0.95, 0.34);
    rifleGroup.rotation.y = -0.1;

    // Upper/Lower Receiver
    const recMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.36), gunMat), '#0f172a');
    rifleGroup.add(recMesh);

    // Barrel & Flash Hider
    const bMesh = registerMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 10), gunMat), '#0f172a');
    bMesh.rotation.x = Math.PI / 2;
    bMesh.position.set(0, 0.015, 0.26);
    rifleGroup.add(bMesh);

    // Handguard
    const hgMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.2), gunMat), '#0f172a');
    hgMesh.position.set(0, 0.01, 0.18);
    rifleGroup.add(hgMesh);

    // Holographic Optic Sight
    const sightMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.08), gunMat), '#0f172a');
    sightMesh.position.set(0, 0.065, 0.02);
    rifleGroup.add(sightMesh);

    // Red Dot Sight Reticle
    const reticle = new THREE.Mesh(new THREE.CircleGeometry(0.008, 8), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    reticle.position.set(0, 0.065, 0.065);
    rifleGroup.add(reticle);

    // Curved 30-round Magazine
    const magMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.14, 0.07), gearMat), '#0f172a');
    magMesh.position.set(0, -0.09, 0.04);
    magMesh.rotation.x = 0.2;
    rifleGroup.add(magMesh);

    // Tactical Crane Buttstock
    const stockMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.16), gearMat), '#0f172a');
    stockMesh.position.set(0, 0.005, -0.22);
    rifleGroup.add(stockMesh);

    group.add(rifleGroup);

    // 5. Legs & Tactical Combat Boots
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.13, 0.65, 0);
    const lLegMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.18), uniformMat), '#1e293b');
    lLegMesh.position.y = -0.22;
    leftLeg.add(lLegMesh);

    // Knee pad
    const lKnee = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), gearMat), '#0f172a');
    lKnee.position.set(0, -0.22, 0.1);
    leftLeg.add(lKnee);

    // Tactical combat boot
    const lBoot = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.24), gearMat), '#0f172a');
    lBoot.position.set(0, -0.52, 0.02);
    leftLeg.add(lBoot);
    group.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.13, 0.65, 0);
    const rLegMesh = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.18), uniformMat), '#1e293b');
    rLegMesh.position.y = -0.22;
    rightLeg.add(rLegMesh);

    // Knee pad
    const rKnee = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), gearMat), '#0f172a');
    rKnee.position.set(0, -0.22, 0.1);
    rightLeg.add(rKnee);

    // Tactical combat boot
    const rBoot = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.24), gearMat), '#0f172a');
    rBoot.position.set(0, -0.52, 0.02);
    rightLeg.add(rBoot);
    group.add(rightLeg);

    // 6. Name billboard sprite
    const nameSprite = this.createNameSprite(player.name);
    nameSprite.position.set(0, 1.95, 0);
    group.add(nameSprite);

    // 7. Health bar overhead
    const hbGroup = new THREE.Group();
    hbGroup.position.set(0, 1.76, 0);
    const hbBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.08),
      new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.DoubleSide })
    );
    hbGroup.add(hbBg);

    const healthBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.76, 0.06),
      new THREE.MeshBasicMaterial({ color: '#10b981', side: THREE.DoubleSide })
    );
    healthBar.position.z = 0.01;
    hbGroup.add(healthBar);
    group.add(hbGroup);

    // 8. Invisible Cylinder Raycast Hitbox (Guarantees 100% reliable hit detection)
    const hitboxGeo = new THREE.CylinderGeometry(0.46, 0.46, 1.85, 12);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitboxMesh = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitboxMesh.position.y = 0.95;
    hitboxMesh.userData = { playerId: player.id };
    group.add(hitboxMesh);

    group.position.set(player.position.x, player.position.y, player.position.z);

    return {
      group,
      targetPos: new THREE.Vector3(player.position.x, player.position.y, player.position.z),
      targetYaw: player.rotation.yaw,
      nameSprite,
      healthBar,
      hitboxMesh,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      bodyMeshes,
      walkCycle: 0,
      isAlive: player.isAlive,
      isHitFlashing: false,
      fallProgress: 0,
    };
  }

  private createNameSprite(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.roundRect(8, 8, 240, 48, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 128, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.5, 0.38, 1);
    return sprite;
  }

  // Physics and movement integration
  private updatePlayer(delta: number) {
    if (!this.isAlive) return;

    // 1. Process touch or keyboard input
    let moveForward = 0;
    let moveRight = 0;

    // Keyboard (WASD)
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveForward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveForward -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveRight -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveRight += 1;

    // Virtual Joystick
    if (this.touchMoveVector.x !== 0 || this.touchMoveVector.y !== 0) {
      moveRight += this.touchMoveVector.x;
      moveForward -= this.touchMoveVector.y;
    }

    // Touch look drag
    if (this.touchLookDelta.x !== 0 || this.touchLookDelta.y !== 0) {
      const touchSens = 0.0035 * this.sensitivity;
      this.yaw -= this.touchLookDelta.x * touchSens;
      const pDelta = this.touchLookDelta.y * touchSens * (this.invertY ? -1 : 1);
      this.pitch = Math.max(-Math.PI * 0.44, Math.min(Math.PI * 0.44, this.pitch - pDelta));
      this.touchLookDelta.x = 0;
      this.touchLookDelta.y = 0;
    }

    // Continuous fire while holding button
    if (this.isFiringTouch || this.isFiringMouse) {
      this.shoot();
    }

    // Determine sprint state
    this.isSprinting =
      (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touchMoveVector.y < -0.65) &&
      moveForward > 0;

    const baseSpeed = this.isAiming ? 2.8 : this.isSprinting ? 7.2 : 4.8;
    this.isMoving = Math.abs(moveForward) > 0.05 || Math.abs(moveRight) > 0.05;

    // Direction vector relative to yaw using pre-allocated vectors (no GC allocations)
    this.tempForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.tempRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.tempMoveDir
      .set(0, 0, 0)
      .addScaledVector(this.tempForward, moveForward)
      .addScaledVector(this.tempRight, moveRight);

    if (this.tempMoveDir.lengthSq() > 0) {
      this.tempMoveDir.normalize().multiplyScalar(baseSpeed * delta);
    }

    // 2. Horizontal Collision Detection against clean AABB boxes
    const playerRadius = 0.38;

    // X movement
    const testX = this.playerPos.x + this.tempMoveDir.x;
    let collideX = false;
    for (const box of this.collisionBoxes) {
      if (
        testX + playerRadius > box.min.x &&
        testX - playerRadius < box.max.x &&
        this.playerPos.z + playerRadius > box.min.z &&
        this.playerPos.z - playerRadius < box.max.z &&
        this.playerPos.y + 0.2 < box.max.y &&
        this.playerPos.y + 1.6 > box.min.y
      ) {
        collideX = true;
        break;
      }
    }
    if (!collideX) {
      this.playerPos.x = Math.max(-46.8, Math.min(46.8, testX));
    }

    // Z movement
    const testZ = this.playerPos.z + this.tempMoveDir.z;
    let collideZ = false;
    for (const box of this.collisionBoxes) {
      if (
        this.playerPos.x + playerRadius > box.min.x &&
        this.playerPos.x - playerRadius < box.max.x &&
        testZ + playerRadius > box.min.z &&
        testZ - playerRadius < box.max.z &&
        this.playerPos.y + 0.2 < box.max.y &&
        this.playerPos.y + 1.6 > box.min.y
      ) {
        collideZ = true;
        break;
      }
    }
    if (!collideZ) {
      this.playerPos.z = Math.max(-46.8, Math.min(46.8, testZ));
    }

    // 3. Vertical Physics & Step Climbing
    this.playerVelocity.y -= 19.6 * delta; // Gravity
    const nextY = this.playerPos.y + this.playerVelocity.y * delta;

    // Check highest floor/platform under player
    let groundY = 0; // Default ground floor level
    for (const box of this.collisionBoxes) {
      if (
        this.playerPos.x + playerRadius > box.min.x &&
        this.playerPos.x - playerRadius < box.max.x &&
        this.playerPos.z + playerRadius > box.min.z &&
        this.playerPos.z - playerRadius < box.max.z
      ) {
        if (box.max.y <= this.playerPos.y + 0.35) {
          groundY = Math.max(groundY, box.max.y);
        }
      }
    }

    if (nextY <= groundY) {
      this.playerPos.y = groundY;
      this.playerVelocity.y = 0;
      this.isGrounded = true;
    } else {
      this.playerPos.y = nextY;
      this.isGrounded = false;
    }

    // Camera follow head (YXZ order guarantees horizontal yaw turning without tilting)
    this.camera.position.set(this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // Weapon sway & ADS interpolation
    const targetGunPos = this.isAiming ? this.gunAimPos : this.gunDefaultPos;
    this.gunGroup.position.lerp(targetGunPos, delta * 15);

    // Aim FOV zoom
    const targetFov = this.isAiming ? 52 : 75;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 12);
    this.camera.updateProjectionMatrix();

    // Weapon bobbing when moving
    if (this.isMoving && this.isGrounded) {
      this.walkBob += delta * (this.isSprinting ? 16 : 10);
      const bobX = Math.cos(this.walkBob) * (this.isAiming ? 0.002 : 0.008);
      const bobY = Math.abs(Math.sin(this.walkBob)) * (this.isAiming ? 0.002 : 0.008);
      this.gunGroup.position.x += bobX;
      this.gunGroup.position.y += bobY;
    }

    // Recoil recovery
    this.gunRecoil.lerp(new THREE.Vector3(0, 0, 0), delta * 18);
    this.gunGroup.position.add(this.gunRecoil);

    // Broadcast move to callbacks
    this.callbacks.onMoveUpdate(
      { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
      { yaw: this.yaw, pitch: this.pitch },
      this.isMoving,
      this.isSprinting,
      this.isAiming
    );
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);

    this.updatePlayer(delta);

    // Animate & Interpolate remote players
    this.remotePlayersMap.forEach((remote) => {
      if (remote.isAlive) {
        // Move towards target position smoothly without teleports
        const dist = remote.group.position.distanceTo(remote.targetPos);
        if (dist > 8) {
          // Snap instantly if player respawned or joined across arena
          remote.group.position.copy(remote.targetPos);
        } else {
          remote.group.position.lerp(remote.targetPos, Math.min(1, delta * 14));
        }

        // Shortest angle rotation lerp to prevent 360-degree spinning
        const yawDiff = ((remote.targetYaw - remote.group.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
        remote.group.rotation.y += yawDiff * Math.min(1, delta * 14);

        // Walk animation
        if (dist > 0.04) {
          remote.walkCycle += delta * 11;
          const legAngle = Math.sin(remote.walkCycle) * 0.5;
          remote.leftLeg.rotation.x = legAngle;
          remote.rightLeg.rotation.x = -legAngle;
          remote.leftArm.rotation.x = -legAngle * 0.4;
        } else {
          remote.leftLeg.rotation.x = THREE.MathUtils.lerp(remote.leftLeg.rotation.x, 0, delta * 8);
          remote.rightLeg.rotation.x = THREE.MathUtils.lerp(remote.rightLeg.rotation.x, 0, delta * 8);
          remote.leftArm.rotation.x = THREE.MathUtils.lerp(remote.leftArm.rotation.x, 0, delta * 8);
        }
      } else {
        // Elimination tumble / fall animation
        remote.fallProgress = Math.min(1, remote.fallProgress + delta * 3);
        remote.group.rotation.x = THREE.MathUtils.lerp(0, Math.PI / 2, remote.fallProgress);
        remote.group.position.y = THREE.MathUtils.lerp(remote.group.position.y, 0.25, remote.fallProgress);
      }

      remote.nameSprite.lookAt(this.camera.position);
      remote.healthBar.parent?.lookAt(this.camera.position);
    });

    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= delta;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      p.vel.y -= 9.8 * delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.forceContextLoss?.();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
