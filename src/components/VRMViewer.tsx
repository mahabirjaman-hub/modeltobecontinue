/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Emotion, CharacterAnimation, LightingPreset, CameraPreset, BackgroundPreset, VRMModelMeta } from '../types';

interface VRMViewerProps {
  modelUrl: string;
  currentEmotion: Emotion;
  currentAnimation?: CharacterAnimation;
  emotionIntensity?: number;
  isSpeaking: boolean;
  analyser: AnalyserNode | null;
  lightingPreset: LightingPreset;
  cameraPreset: CameraPreset;
  backgroundPreset: BackgroundPreset;
  onModelLoaded?: (meta: VRMModelMeta) => void;
  onAvatarClick?: () => void;
}

type AnimState = 'idle' | 'walk' | 'run' | 'jump' | 'crouch';

type BoneName =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'upperChest'
  | 'neck'
  | 'head'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot';

type BonePose = Partial<Record<BoneName, [number, number, number]>> & {
  hipY?: number;
};

const BONE_NAMES: BoneName[] = [
  'hips',
  'spine',
  'chest',
  'upperChest',
  'neck',
  'head',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
];

export const VRMViewer: React.FC<VRMViewerProps> = ({
  modelUrl,
  currentEmotion,
  currentAnimation,
  emotionIntensity = 0.35,
  isSpeaking,
  analyser,
  lightingPreset,
  cameraPreset,
  backgroundPreset,
  onModelLoaded,
  onAvatarClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Persistent Scene Objects (Created ONCE)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Ground and placement refs
  const baseGroundYRef = useRef<number>(0);
  const characterLoadedRef = useRef<boolean>(false);
  const loadingInProgressRef = useRef<boolean>(false);
  const loadGenerationRef = useRef<number>(0);
  const loadedModelUrlRef = useRef<string>('');

  // Lights reference
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    rim: THREE.DirectionalLight;
  } | null>(null);

  // Animation State & Blending
  const animStateRef = useRef<AnimState>('idle');
  const animWeightsRef = useRef<Record<AnimState, number>>({
    idle: 1.0,
    walk: 0.0,
    run: 0.0,
    jump: 0.0,
    crouch: 0.0,
  });

  // Jump lifecycle
  const jumpProgressRef = useRef<number>(0);
  const isJumpingRef = useRef<boolean>(false);

  // Input state for animations (WASD / Arrows / Shift / Space / C)
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  // Dynamic props stored in refs to avoid useEffect teardown
  const currentEmotionRef = useRef<Emotion>(currentEmotion);
  currentEmotionRef.current = currentEmotion;

  const currentAnimationRef = useRef<CharacterAnimation>(currentAnimation || 'idle');
  currentAnimationRef.current = currentAnimation || (isSpeaking ? 'talking' : 'idle');

  const emotionIntensityRef = useRef<number>(emotionIntensity);
  emotionIntensityRef.current = emotionIntensity;

  const isSpeakingRef = useRef<boolean>(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const analyserRef = useRef<AnalyserNode | null>(analyser);
  analyserRef.current = analyser;

  const onAvatarClickRef = useRef(onAvatarClick);
  onAvatarClickRef.current = onAvatarClick;

  const onModelLoadedRef = useRef(onModelLoaded);
  onModelLoadedRef.current = onModelLoaded;

  // Blinking & Speech
  const blinkTimerRef = useRef<number>(2.8);
  const isBlinkingRef = useRef<boolean>(false);
  const blinkProgressRef = useRef<number>(0);
  const doubleBlinkDelayRef = useRef<number>(0);
  const speechClockRef = useRef<number>(0);
  const audioFreqArrayRef = useRef<Uint8Array | null>(null);
  const audioTimeArrayRef = useRef<Uint8Array | null>(null);
  const pokeTimerRef = useRef<number>(0);

  // Viseme state for smooth attack/release interpolation
  const visemeStateRef = useRef<{
    aa: number;
    ih: number;
    ou: number;
    ee: number;
    oh: number;
    rms: number;
  }>({
    aa: 0,
    ih: 0,
    ou: 0,
    ee: 0,
    oh: 0,
    rms: 0,
  });

  // Expression morph weights
  const emotionWeightsRef = useRef<Record<string, number>>({
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
    surprised: 0,
    neutral: 1,
    blink: 0,
    blinkLeft: 0,
    blinkRight: 0,
    aa: 0,
    ih: 0,
    ou: 0,
    ee: 0,
    oh: 0,
  });

  // ==========================================
  // PROCEDURAL HUMANOID POSE GENERATORS
  // ==========================================

  // 1. IDLE: Natural, relaxed, completely upright, directly facing the screen/user
  const getIdlePose = (time: number): BonePose => {
    const breath = Math.sin(time * 1.5);

    return {
      hipY: 0,
      hips: [0, 0, 0], // Torso completely straight, no twisting, no sideways lean
      spine: [breath * 0.005, 0, 0], // Gentle breathing on X only, 0 twist on Y/Z
      chest: [breath * 0.008, 0, 0], // Gentle breathing on X only, 0 twist on Y/Z
      upperChest: [0, 0, 0],
      neck: [0, 0, 0], // Straight upright neck
      head: [0, 0, 0], // Centered, looking directly at camera/screen
      // Left arm: hangs naturally downward beside the thigh/hip
      leftUpperArm: [0.04, 0, 1.38],
      leftLowerArm: [0, 0, 0.05],
      leftHand: [0, 0, 0],
      // Right arm: hangs naturally downward beside the thigh/hip
      rightUpperArm: [0.04, 0, -1.38],
      rightLowerArm: [0, 0, -0.05],
      rightHand: [0, 0, 0],
      // Both legs naturally straight, feet flat on ground
      leftUpperLeg: [0, 0, 0],
      leftLowerLeg: [0, 0, 0],
      leftFoot: [0, 0, 0],
      rightUpperLeg: [0, 0, 0],
      rightLowerLeg: [0, 0, 0],
      rightFoot: [0, 0, 0],
    };
  };

  // 2. WALK: Natural coordinated stride, arms hanging downward swinging gently
  const getWalkPose = (time: number): BonePose => {
    const p = time * 4.0;
    const sinP = Math.sin(p);

    return {
      hipY: Math.abs(sinP) * 0.02,
      hips: [0, 0, sinP * 0.015],
      spine: [0, -sinP * 0.025, 0],
      chest: [0, -sinP * 0.015, 0],
      neck: [0, 0, 0],
      head: [0, 0, 0],
      // Arms hanging downward beside thighs while swinging naturally
      leftUpperArm: [0.04 - sinP * 0.22, 0, 1.36],
      leftLowerArm: [0, 0, 0.05 + Math.max(0, -sinP) * 0.08],
      leftHand: [0, 0, 0],
      rightUpperArm: [0.04 + sinP * 0.22, 0, -1.36],
      rightLowerArm: [0, 0, -0.05 - Math.max(0, sinP) * 0.08],
      rightHand: [0, 0, 0],
      // Leg stride with natural knee bend on trailing leg
      leftUpperLeg: [sinP * 0.38, 0, 0],
      leftLowerLeg: [Math.max(0, -sinP) * 0.45, 0, 0],
      leftFoot: [sinP * 0.12, 0, 0],
      rightUpperLeg: [-sinP * 0.38, 0, 0],
      rightLowerLeg: [Math.max(0, sinP) * 0.45, 0, 0],
      rightFoot: [-sinP * 0.12, 0, 0],
    };
  };

  // 3. RUN: Dynamic running pose, bent elbows, forward tilt
  const getRunPose = (time: number): BonePose => {
    const rp = time * 7.2;
    const sinRp = Math.sin(rp);

    return {
      hipY: Math.abs(sinRp) * 0.05,
      hips: [0.06, 0, sinRp * 0.02],
      spine: [0.12, -sinRp * 0.04, 0],
      chest: [0.06, -sinRp * 0.02, 0],
      neck: [0, 0, 0],
      head: [-0.04, 0, 0],
      leftUpperArm: [-sinRp * 0.45, 0, 1.0],
      leftLowerArm: [0, 0, 0.35],
      leftHand: [0, 0, 0],
      rightUpperArm: [sinRp * 0.45, 0, -1.0],
      rightLowerArm: [0, 0, -0.35],
      rightHand: [0, 0, 0],
      // Dynamic leg stride with knee lift
      leftUpperLeg: [sinRp * 0.68, 0, 0],
      leftLowerLeg: [Math.max(0, -sinRp) * 0.85, 0, 0],
      leftFoot: [sinRp * 0.22, 0, 0],
      rightUpperLeg: [-sinRp * 0.68, 0, 0],
      rightLowerLeg: [Math.max(0, sinRp) * 0.85, 0, 0],
      rightFoot: [-sinRp * 0.22, 0, 0],
    };
  };

  // 4. JUMP: Natural jump takeoff, airborne tuck, landing recovery
  const getJumpPose = (progress: number): BonePose => {
    const arc = Math.sin(progress * Math.PI);

    return {
      hipY: arc * 0.38,
      hips: [0, 0, 0],
      spine: [-0.04 * arc, 0, 0],
      chest: [0, 0, 0],
      neck: [0, 0, 0],
      head: [0, 0, 0],
      leftUpperArm: [-0.15 * arc, 0, 1.38 - 0.3 * arc],
      leftLowerArm: [0, 0, 0.05 + 0.1 * arc],
      leftHand: [0, 0, 0],
      rightUpperArm: [-0.15 * arc, 0, -1.38 + 0.3 * arc],
      rightLowerArm: [0, 0, -0.05 - 0.1 * arc],
      rightHand: [0, 0, 0],
      leftUpperLeg: [0.42 * arc, 0, 0],
      leftLowerLeg: [0.6 * arc, 0, 0],
      leftFoot: [-0.25 * arc, 0, 0],
      rightUpperLeg: [0.42 * arc, 0, 0],
      rightLowerLeg: [0.6 * arc, 0, 0],
      rightFoot: [-0.25 * arc, 0, 0],
    };
  };

  // 5. CROUCH: Natural crouching pose, knees bent forward, spine balanced
  const getCrouchPose = (): BonePose => {
    return {
      hipY: -0.26,
      hips: [0.06, 0, 0],
      spine: [0.24, 0, 0],
      chest: [0.12, 0, 0],
      neck: [0, 0, 0],
      head: [-0.18, 0, 0],
      leftUpperArm: [0.15, 0, 1.25],
      leftLowerArm: [0, 0, 0.1],
      leftHand: [0, 0, 0],
      rightUpperArm: [0.15, 0, -1.25],
      rightLowerArm: [0, 0, -0.1],
      rightHand: [0, 0, 0],
      leftUpperLeg: [0.92, 0, 0],
      leftLowerLeg: [1.32, 0, 0],
      leftFoot: [-0.38, 0, 0],
      rightUpperLeg: [0.92, 0, 0],
      rightLowerLeg: [1.32, 0, 0],
      rightFoot: [-0.38, 0, 0],
    };
  };

  // Apply default neutral pose immediately after resetting skeleton transforms
  const applyNeutralPose = (vrm: VRM) => {
    if (vrm.humanoid) {
      // Reset all humanoid bones to clean rest pose first
      vrm.humanoid.resetNormalizedPose();
    }

    const idlePose = getIdlePose(0);
    for (const name of BONE_NAMES) {
      const bone = vrm.humanoid?.getNormalizedBoneNode(name);
      if (bone) {
        const rot = idlePose[name] || [0, 0, 0];
        bone.rotation.set(rot[0], rot[1], rot[2]);
      }
    }
  };

  // Lighting updater
  const updateLights = useCallback((preset: LightingPreset) => {
    if (!lightsRef.current) return;
    const { ambient, key, fill, rim } = lightsRef.current;

    switch (preset) {
      case 'cyberpunk':
        ambient.color.setHex(0x1a0933);
        ambient.intensity = 1.8;
        key.color.setHex(0x00f0ff);
        key.intensity = 2.4;
        key.position.set(1.5, 2.0, 1.5);
        fill.color.setHex(0xff007f);
        fill.intensity = 1.8;
        fill.position.set(-1.5, 1.0, 1.0);
        rim.color.setHex(0x8a2be2);
        rim.intensity = 3.2;
        rim.position.set(0, 2.5, -2.0);
        break;
      case 'sunset':
        ambient.color.setHex(0x3a1f1d);
        ambient.intensity = 1.5;
        key.color.setHex(0xffaa55);
        key.intensity = 2.8;
        key.position.set(2.0, 1.8, 1.5);
        fill.color.setHex(0x8b3a62);
        fill.intensity = 1.2;
        fill.position.set(-1.5, 1.0, 1.0);
        rim.color.setHex(0xffd700);
        rim.intensity = 2.5;
        rim.position.set(0, 2.0, -1.8);
        break;
      case 'neon':
        ambient.color.setHex(0x101a2c);
        ambient.intensity = 1.4;
        key.color.setHex(0x39ff14);
        key.intensity = 2.2;
        key.position.set(1.5, 1.8, 1.5);
        fill.color.setHex(0x00d4ff);
        fill.intensity = 1.8;
        fill.position.set(-1.5, 1.0, 1.0);
        rim.color.setHex(0xff1493);
        rim.intensity = 3.0;
        rim.position.set(0, 2.5, -2.0);
        break;
      case 'soft':
        ambient.color.setHex(0x404040);
        ambient.intensity = 1.6;
        key.color.setHex(0xfffaed);
        key.intensity = 1.8;
        key.position.set(1.0, 2.0, 1.8);
        fill.color.setHex(0xe6f2ff);
        fill.intensity = 1.0;
        fill.position.set(-1.2, 1.2, 1.2);
        rim.color.setHex(0xffffff);
        rim.intensity = 1.4;
        rim.position.set(0, 2.0, -1.5);
        break;
      case 'studio':
      default:
        ambient.color.setHex(0x333333);
        ambient.intensity = 1.8;
        key.color.setHex(0xffffff);
        key.intensity = 2.2;
        key.position.set(1.2, 2.2, 1.8);
        fill.color.setHex(0xd0e0ff);
        fill.intensity = 1.2;
        fill.position.set(-1.4, 1.2, 1.2);
        rim.color.setHex(0xffffff);
        rim.intensity = 2.0;
        rim.position.set(0, 2.2, -1.8);
        break;
    }
  }, []);

  // Update lights on preset change without re-creating scene
  useEffect(() => {
    updateLights(lightingPreset);
  }, [lightingPreset, updateLights]);

  // Handle camera presets smoothly
  useEffect(() => {
    const cameraPresetsConfig: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
      portrait: { pos: [0, 0.98, 2.55], target: [0, 0.98, 0] },
      upper: { pos: [0, 0.98, 2.55], target: [0, 0.98, 0] },
      full: { pos: [0, 0.98, 2.55], target: [0, 0.98, 0] },
    };

    const preset = cameraPresetsConfig[cameraPreset];
    if (!preset || !cameraRef.current || !controlsRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const startPos = camera.position.clone();
    const targetPos = new THREE.Vector3(preset.pos[0], preset.pos[1], preset.pos[2]);
    const startTarget = controls.target.clone();
    const targetTarget = new THREE.Vector3(preset.target[0], preset.target[1], preset.target[2]);

    let progress = 0;
    const duration = 0.5;
    let animId: number;

    const animateTransition = () => {
      progress += 0.05;
      const t = Math.min(progress / duration, 1.0);
      const ease = 0.5 - Math.cos(t * Math.PI) / 2;

      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTarget, targetTarget, ease);
      controls.update();

      if (t < 1.0) {
        animId = requestAnimationFrame(animateTransition);
      }
    };

    animId = requestAnimationFrame(animateTransition);
    return () => cancelAnimationFrame(animId);
  }, [cameraPreset]);

  // =======================================================
  // LOAD VRM MODEL WITH RACE CONDITION & PERSISTENCE SAFETY
  // =======================================================
  const loadVRM = useCallback((url: string) => {
    if (!sceneRef.current) return;

    // Prevent duplicate loading if already loaded
    if (characterLoadedRef.current && loadedModelUrlRef.current === url && vrmRef.current) {
      return;
    }

    if (loadingInProgressRef.current) {
      return;
    }

    loadingInProgressRef.current = true;
    const thisLoadGen = ++loadGenerationRef.current;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let finalUrl = url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      finalUrl = `/api/model-proxy?url=${encodeURIComponent(url)}`;
    }

    loader.load(
      finalUrl,
      (gltf) => {
        // Abort if superseded by newer load call
        if (thisLoadGen !== loadGenerationRef.current) {
          loadingInProgressRef.current = false;
          return;
        }

        const vrm: VRM = gltf.userData.vrm;
        if (!vrm) {
          console.error('Loaded file does not contain a valid VRM avatar.');
          loadingInProgressRef.current = false;
          return;
        }

        // Remove previous character cleanly if replacing model
        if (vrmRef.current) {
          sceneRef.current?.remove(vrmRef.current.scene);
          VRMUtils.deepDispose(vrmRef.current.scene);
        }

        // VRM 0.0 models need 180 deg rotation to face camera
        VRMUtils.rotateVRM0(vrm);

        // Crucial: Traverse all meshes and disable frustum culling to prevent sudden vanishing!
        vrm.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.frustumCulled = false;
            obj.castShadow = true;
            obj.receiveShadow = true;
            const mesh = obj as THREE.Mesh;
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach((mat) => {
                  if ('roughness' in mat) {
                    (mat as any).roughness = Math.min((mat as any).roughness ?? 0.6, 0.75);
                  }
                });
              } else if ('roughness' in mesh.material) {
                (mesh.material as any).roughness = Math.min((mesh.material as any).roughness ?? 0.6, 0.75);
              }
            }
          }
        });

        // Calculate actual bounding box to place feet exactly on the ground
        vrm.scene.updateMatrixWorld(true);
        const bbox = new THREE.Box3().setFromObject(vrm.scene);
        const lowestPoint = bbox.min.y;
        const groundOffsetY = -lowestPoint;

        baseGroundYRef.current = groundOffsetY;
        vrm.scene.position.set(0, groundOffsetY, 0);
        // Face the screen/camera directly (chest, stomach, face, shoulders facing user)
        vrm.scene.rotation.set(0, Math.PI, 0);
        vrm.scene.visible = true;

        // Apply natural neutral pose immediately upon load
        applyNeutralPose(vrm);

        // Center camera squarely on the middle area of the character
        vrm.scene.updateMatrixWorld(true);
        const finalBbox = new THREE.Box3().setFromObject(vrm.scene);
        const centerY = (finalBbox.min.y + finalBbox.max.y) / 2;
        const modelHeight = finalBbox.max.y - finalBbox.min.y;

        if (cameraRef.current && controlsRef.current) {
          const fovRad = (cameraRef.current.fov * Math.PI) / 180;
          // Zoomed additional 10% closer (approx 1.43x total magnification)
          const fitDistance = (((modelHeight / 2) / Math.tan(fovRad / 2) * 1.25) / 1.30) / 1.10;
          // Shift body down 10% by framing camera target 10% higher on model
          const targetY = centerY + (modelHeight * 0.10);
          cameraRef.current.position.set(0, targetY, fitDistance);
          controlsRef.current.target.set(0, targetY, 0);
          controlsRef.current.update();
        }

        // Add character instance to scene permanently
        sceneRef.current?.add(vrm.scene);
        vrmRef.current = vrm;
        characterLoadedRef.current = true;
        loadedModelUrlRef.current = url;
        loadingInProgressRef.current = false;

        // Extract metadata safely
        const rawMeta = vrm.meta as any;
        const meta: VRMModelMeta = {
          title: rawMeta?.name || rawMeta?.title || 'Virtual Assistant',
          author: rawMeta?.authors?.[0] || rawMeta?.author || rawMeta?.contactInformation || '3D Creator',
          version: rawMeta?.version || '1.0',
        };

        onModelLoadedRef.current?.(meta);
      },
      undefined,
      (error) => {
        console.error('Error loading VRM model:', error);
        loadingInProgressRef.current = false;
      }
    );
  }, []);

  // =========================================================================
  // PERSISTENT SCENE INITIALIZATION (Runs ONCE on mount, NEVER tears down)
  // =========================================================================
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = null; // Transparent to preserve bg-neutral-950
    sceneRef.current = scene;

    // 2. Camera: Positioned to frame upright character (zoomed 10% more, body shifted 10% below)
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 25.0);
    camera.position.set(0, 0.98, 2.55);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and soft shadow maps
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 4. OrbitControls - LOCKED: no rotating, no panning, no zooming
    const controls = new OrbitControls(camera, canvas);
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.target.set(0, 0.98, 0);
    controlsRef.current = controls;

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0x333333, 1.8);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(1.2, 2.2, 1.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0001;

    const fillLight = new THREE.DirectionalLight(0xd0e0ff, 1.2);
    fillLight.position.set(-1.4, 1.2, 1.2);

    const rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
    rimLight.position.set(0, 2.2, -1.8);

    scene.add(ambientLight);
    scene.add(keyLight);
    scene.add(fillLight);
    scene.add(rimLight);

    lightsRef.current = {
      ambient: ambientLight,
      key: keyLight,
      fill: fillLight,
      rim: rimLight,
    };

    // Soft ground contact shadow plane (Feet resting at Y = 0)
    const groundGeo = new THREE.PlaneGeometry(8, 8);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Initial Model Loading
    loadVRM(modelUrl);

    // =========================================================================
    // SINGLE PERSISTENT ANIMATION & RENDER LOOP
    // Character is locked in position and rotation, facing camera continuously
    // =========================================================================
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min(clockRef.current.getDelta(), 0.1);
      const elapsedTime = clockRef.current.getElapsedTime();

      const vrm = vrmRef.current;
      if (vrm && characterLoadedRef.current) {
        // Ensure character remains visible at all times
        vrm.scene.visible = true;

        // Position and rotation permanently fixed:
        // Positioned firmly at ground Y, facing directly toward camera (rotation.y = Math.PI)
        vrm.scene.position.set(0, baseGroundYRef.current, 0);
        vrm.scene.rotation.set(0, Math.PI, 0);

        // Determine active animation state (idle, talking, happy, sad, surprised, thinking, excited, sleepy)
        const animState = isSpeakingRef.current
          ? (currentAnimationRef.current === 'idle' ? 'talking' : currentAnimationRef.current)
          : currentAnimationRef.current;

        // Character remains strictly facing camera, body front toward user
        let activePose = getIdlePose(elapsedTime);

        // Procedural gesture variations
        if (animState === 'talking') {
          const nod = Math.sin(elapsedTime * 3.5) * 0.035;
          const armGesture = Math.sin(elapsedTime * 2.2) * 0.04;
          activePose = {
            ...activePose,
            head: [nod, 0, 0],
            chest: [nod * 0.4, 0, 0],
            leftUpperArm: [0.06 + armGesture, 0, 1.34],
            leftLowerArm: [0, 0, 0.12 + armGesture],
            rightUpperArm: [0.06 - armGesture, 0, -1.34],
            rightLowerArm: [0, 0, -0.12 - armGesture],
          };
        } else if (animState === 'happy') {
          const sway = Math.sin(elapsedTime * 1.8) * 0.025;
          activePose = {
            ...activePose,
            spine: [0, 0, sway * 0.5],
            head: [-0.02, 0, sway],
            leftUpperArm: [0.05, 0, 1.34],
            rightUpperArm: [0.05, 0, -1.34],
          };
        } else if (animState === 'thinking') {
          activePose = {
            ...activePose,
            head: [-0.03, 0.06, 0.05],
            rightUpperArm: [0.28, 0, -1.15],
            rightLowerArm: [0, 0, -0.55],
          };
        } else if (animState === 'excited') {
          const bounce = Math.sin(elapsedTime * 4.0) * 0.015;
          activePose = {
            ...activePose,
            spine: [bounce, 0, 0],
            head: [-0.03, 0, Math.sin(elapsedTime * 2.5) * 0.025],
            leftUpperArm: [0.08, 0, 1.32],
            rightUpperArm: [0.08, 0, -1.32],
          };
        } else if (animState === 'sad') {
          activePose = {
            ...activePose,
            head: [0.12, 0, 0],
            chest: [0.04, 0, 0],
          };
        } else if (animState === 'surprised') {
          activePose = {
            ...activePose,
            head: [-0.06, 0, 0],
            chest: [-0.03, 0, 0],
          };
        } else if (animState === 'sleepy') {
          const slowBreath = Math.sin(elapsedTime * 0.8) * 0.01;
          activePose = {
            ...activePose,
            head: [0.07 + slowBreath, 0, 0],
            spine: [slowBreath, 0, 0],
          };
        }

        // Apply smooth procedural rotations to humanoid bones
        for (const name of BONE_NAMES) {
          const boneNode = vrm.humanoid?.getNormalizedBoneNode(name);
          if (!boneNode) continue;

          const rTarget = activePose[name] || [0, 0, 0];
          boneNode.rotation.set(rTarget[0], rTarget[1], rTarget[2]);
        }

        // 6. Natural Irregular Eye Blinking with Double-Blink Probability
        if (doubleBlinkDelayRef.current > 0) {
          doubleBlinkDelayRef.current -= delta;
          if (doubleBlinkDelayRef.current <= 0 && !isBlinkingRef.current) {
            isBlinkingRef.current = true;
            blinkProgressRef.current = 0;
          }
        } else {
          blinkTimerRef.current -= delta;
          if (blinkTimerRef.current <= 0 && !isBlinkingRef.current) {
            isBlinkingRef.current = true;
            blinkProgressRef.current = 0;
          }
        }

        let currentBlinkWeight = 0;
        if (isBlinkingRef.current) {
          blinkProgressRef.current += delta * 9.5; // ~160ms eyelid cycle
          if (blinkProgressRef.current >= Math.PI) {
            isBlinkingRef.current = false;
            currentBlinkWeight = 0;
            // 18% chance of triggering an authentic natural double-blink
            if (Math.random() < 0.18) {
              doubleBlinkDelayRef.current = 0.16 + Math.random() * 0.12;
            } else {
              blinkTimerRef.current = 2.6 + Math.random() * 4.2;
            }
          } else {
            currentBlinkWeight = Math.sin(blinkProgressRef.current);
          }
        }

        // 7. Real-Time Audio-Driven Lip-Sync (Formant & RMS Energy Pipeline)
        let targetA = 0;
        let targetI = 0;
        let targetU = 0;
        let targetE = 0;
        let targetO = 0;
        let currentRms = 0;

        const analyser = analyserRef.current;
        if (isSpeakingRef.current && analyser) {
          speechClockRef.current += delta;
          const binCount = analyser.frequencyBinCount;
          const fftSize = analyser.fftSize;

          if (!audioFreqArrayRef.current || audioFreqArrayRef.current.length !== binCount) {
            audioFreqArrayRef.current = new Uint8Array(binCount);
          }
          if (!audioTimeArrayRef.current || audioTimeArrayRef.current.length !== fftSize) {
            audioTimeArrayRef.current = new Uint8Array(fftSize);
          }

          // A. Time-Domain True RMS Amplitude
          analyser.getByteTimeDomainData(audioTimeArrayRef.current);
          let sumSq = 0;
          const timeLen = audioTimeArrayRef.current.length;
          for (let i = 0; i < timeLen; i++) {
            const norm = (audioTimeArrayRef.current[i] - 128) / 128.0;
            sumSq += norm * norm;
          }
          currentRms = Math.sqrt(sumSq / timeLen);
          visemeStateRef.current.rms = THREE.MathUtils.lerp(visemeStateRef.current.rms, currentRms, 0.35);

          // B. Frequency-Domain Formant Band Distribution
          analyser.getByteFrequencyData(audioFreqArrayRef.current);
          const freqData = audioFreqArrayRef.current;

          // Split into 3 phonetic formant ranges:
          // Low (150Hz - 800Hz): Bins ~2-9 (vowels: aa, oh, ou)
          let lowSum = 0;
          const lowEnd = Math.min(10, binCount);
          for (let i = 2; i < lowEnd; i++) lowSum += freqData[i];
          const lowEnergy = lowSum / (lowEnd - 2 || 1);

          // Mid (800Hz - 2500Hz): Bins ~10-28 (vowels: ee, ih, aa)
          let midSum = 0;
          const midEnd = Math.min(29, binCount);
          for (let i = lowEnd; i < midEnd; i++) midSum += freqData[i];
          const midEnergy = midSum / (midEnd - lowEnd || 1);

          // High (2500Hz - 6000Hz): Bins ~29-70 (consonants, sibilants, airy vocal resonance)
          let highSum = 0;
          const highEnd = Math.min(72, binCount);
          for (let i = midEnd; i < highEnd; i++) highSum += freqData[i];
          const highEnergy = highSum / (highEnd - midEnd || 1);

          const totalEnergy = lowEnergy + midEnergy + highEnergy + 0.001;
          const lowRatio = lowEnergy / totalEnergy;
          const midRatio = midEnergy / totalEnergy;
          const highRatio = highEnergy / totalEnergy;

          // Silence Cutoff: If RMS is below ambient silence threshold (~0.015),
          // Columbina's mouth smoothly closes (no phantom mouth movement during pauses!)
          const silenceThreshold = 0.015;
          if (currentRms > silenceThreshold) {
            // Mouth opening scales gracefully with vocal volume (subtle speaking = gentle open, loud = full open)
            const mouthOpen = THREE.MathUtils.clamp((currentRms - silenceThreshold) / 0.12, 0, 1.0);

            // Formant phoneme mapping
            targetA = mouthOpen * (lowRatio * 0.7 + midRatio * 0.5);
            targetO = mouthOpen * (lowRatio * 0.9 * (1.0 - highRatio));
            targetU = mouthOpen * (lowRatio * 0.65 * (1.0 - midRatio));
            targetE = mouthOpen * (midRatio * 0.8 + highRatio * 0.35);
            targetI = mouthOpen * (highRatio * 0.65 + midRatio * 0.5);
          }

          // Procedural speaking micro-nod synchronized with vocal energy
          const headBone = vrm.humanoid?.getNormalizedBoneNode('head');
          if (headBone) {
            const nodAngle = THREE.MathUtils.clamp(visemeStateRef.current.rms * 0.12, 0, 0.035);
            headBone.rotation.x += nodAngle;
          }
        } else {
          speechClockRef.current = 0;
          visemeStateRef.current.rms = THREE.MathUtils.lerp(visemeStateRef.current.rms, 0, 0.2);
        }

        // Asymmetric Attack/Release Viseme Smoothing:
        // Attack is rapid (~25ms, lerp 0.45) so mouth opens immediately with vocal syllables
        // Release is gentle (~60ms, lerp 0.18) so mouth decays smoothly without snapping
        const smoothViseme = (cur: number, tgt: number) => {
          const factor = tgt > cur ? 0.45 : 0.18;
          return THREE.MathUtils.lerp(cur, tgt, factor);
        };

        visemeStateRef.current.aa = smoothViseme(visemeStateRef.current.aa, targetA);
        visemeStateRef.current.ih = smoothViseme(visemeStateRef.current.ih, targetI);
        visemeStateRef.current.ou = smoothViseme(visemeStateRef.current.ou, targetU);
        visemeStateRef.current.ee = smoothViseme(visemeStateRef.current.ee, targetE);
        visemeStateRef.current.oh = smoothViseme(visemeStateRef.current.oh, targetO);

        const vowelA = visemeStateRef.current.aa;
        const vowelI = visemeStateRef.current.ih;
        const vowelU = visemeStateRef.current.ou;
        const vowelE = visemeStateRef.current.ee;
        const vowelO = visemeStateRef.current.oh;

        // 8. Expression Morphs (Full mapping of allowed emotions + Fish Audio Emotion System)
        const emotion = currentEmotionRef.current;
        const intensity = emotionIntensityRef.current;
        const subtleSmile = (emotion === 'neutral' || emotion === 'relaxed' || emotion === 'calm' || emotion === 'gentle' || emotion === 'mysterious' || emotion === 'intimate') ? 0.14 : 0.0;

        let targetHappy = subtleSmile;
        let targetAngry = 0;
        let targetSad = 0;
        let targetRelaxed = (emotion === 'neutral' ? 0.2 : 0);
        let targetSurprised = 0;
        let targetNeutral = (emotion === 'neutral' ? 0.8 : 0);
        let targetBlinkLeft = (emotion === 'wink' ? 1.0 : 0);

        switch (emotion) {
          // Fish Audio Core Emotions:
          case 'gentle':
            targetRelaxed = 0.8 * intensity;
            targetHappy = 0.22 * intensity;
            targetNeutral = 0.5;
            break;
          case 'friendly':
            targetHappy = 0.65 * intensity;
            targetRelaxed = 0.35 * intensity;
            targetNeutral = 0.4;
            break;
          case 'playful':
            targetHappy = 0.75 * intensity;
            targetBlinkLeft = 0.4 * intensity;
            targetRelaxed = 0.25;
            break;
          case 'mysterious':
            targetRelaxed = 0.45 * intensity;
            targetNeutral = 0.7;
            targetHappy = 0.1;
            break;
          case 'empathetic':
            targetRelaxed = 0.6 * intensity;
            targetSad = 0.2 * intensity;
            targetNeutral = 0.4;
            break;
          case 'intimate':
            targetRelaxed = 0.75 * intensity;
            targetHappy = 0.25 * intensity;
            targetNeutral = 0.3;
            break;
          case 'cheerful':
            targetHappy = 0.85 * intensity;
            targetRelaxed = 0.3;
            break;
          case 'enthusiastic':
            targetHappy = 0.9 * intensity;
            targetSurprised = 0.3 * intensity;
            break;
          case 'confident':
            targetRelaxed = 0.5 * intensity;
            targetHappy = 0.25 * intensity;
            targetNeutral = 0.6;
            break;
          case 'serious':
            targetNeutral = 0.85;
            targetRelaxed = 0.15;
            break;
          case 'authoritative':
            targetNeutral = 0.85;
            targetAngry = 0.25 * intensity;
            break;
          case 'dramatic':
            targetSurprised = 0.45 * intensity;
            targetNeutral = 0.6;
            break;
          case 'sexy':
            targetRelaxed = 0.6 * intensity;
            targetHappy = 0.3 * intensity;
            targetBlinkLeft = 0.25 * intensity;
            break;
          case 'professional':
            targetNeutral = 0.85;
            targetRelaxed = 0.25;
            break;

          // Standard & Character Emotions:
          case 'happy':
            targetHappy = 0.95 * intensity;
            targetRelaxed = 0.2;
            break;
          case 'excited':
            targetHappy = 1.0 * intensity;
            targetSurprised = 0.35 * intensity;
            break;
          case 'sad':
            targetSad = 0.95 * intensity;
            break;
          case 'worried':
            targetSad = 0.65 * intensity;
            targetSurprised = 0.3 * intensity;
            break;
          case 'angry':
            targetAngry = 0.75 * intensity;
            break;
          case 'surprised':
            targetSurprised = 0.95 * intensity;
            break;
          case 'shy':
            targetRelaxed = 0.6 * intensity;
            targetHappy = 0.35 * intensity;
            break;
          case 'curious':
            targetSurprised = 0.4 * intensity;
            targetHappy = 0.25 * intensity;
            break;
          case 'calm':
            targetRelaxed = 0.85 * intensity;
            targetNeutral = 0.4;
            targetHappy = 0.15;
            break;
          case 'sleepy':
            targetRelaxed = 0.95 * intensity;
            break;
          case 'thinking':
            targetRelaxed = 0.4 * intensity;
            targetNeutral = 0.6;
            break;
          case 'relaxed':
            targetRelaxed = 0.85 * intensity;
            targetHappy = 0.15;
            break;
          case 'wink':
            targetBlinkLeft = 1.0;
            targetHappy = 0.45;
            break;
          case 'neutral':
          default:
            targetNeutral = 0.8;
            targetHappy = 0.12;
            break;
        }

        const finalBlink = Math.max(currentBlinkWeight, emotion === 'sleepy' ? 0.45 : 0);

        const targetWeights: Record<string, number> = {
          happy: targetHappy,
          angry: targetAngry,
          sad: targetSad,
          relaxed: targetRelaxed,
          surprised: targetSurprised,
          neutral: targetNeutral,
          blink: finalBlink,
          blinkLeft: targetBlinkLeft,
          blinkRight: 0.0,
          aa: vowelA,
          ih: vowelI,
          ou: vowelU,
          ee: vowelE,
          oh: vowelO,
        };

        if (pokeTimerRef.current > 0) {
          pokeTimerRef.current -= delta;
          targetWeights.happy = 0.9;
          targetWeights.surprised = 0.3;
        }

        if (vrm.expressionManager) {
          const lerpSpeed = 0.22;
          for (const key of Object.keys(targetWeights)) {
            const cur = emotionWeightsRef.current[key] || 0;
            const target = targetWeights[key];
            const next = THREE.MathUtils.lerp(cur, target, lerpSpeed);
            emotionWeightsRef.current[key] = next;

            try {
              vrm.expressionManager.setValue(key, next);
            } catch (e) {
              // Ignore unsupported expressions
            }
          }
        }

        // 9. Update Spring Bone physics & VRM internal systems
        vrm.update(delta);
      }

      // Render Scene
      renderer.render(scene, camera);
    };

    animate();

    // ResizeObserver for window and container resizes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    // Cleanup ONLY on component unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
      }
    };
  }, []); // Run ONCE on mount

  // Watch for external modelUrl changes if user changes modelUrl prop
  useEffect(() => {
    if (modelUrl && modelUrl !== loadedModelUrlRef.current) {
      loadVRM(modelUrl);
    }
  }, [modelUrl, loadVRM]);

  return (
    <div ref={containerRef} id="vrm-viewer-container" className="relative w-full h-full select-none overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} id="vrm-webgl-canvas" className="w-full h-full cursor-default block select-none pointer-events-none" />
    </div>
  );
};
