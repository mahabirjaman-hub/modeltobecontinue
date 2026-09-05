import React, { useState } from 'react';
import {
  AssistantConfig,
  Emotion,
  LightingPreset,
  CameraPreset,
  BackgroundPreset,
  VRMModelMeta,
} from '../types';
import {
  Settings,
  Camera,
  Sun,
  Palette,
  Smile,
  Sliders,
  Upload,
  Link,
  Volume2,
  User,
  X,
  Sparkles,
  Info,
  Check,
  Play,
  Brain,
  Cpu,
  Database,
  RefreshCw,
} from 'lucide-react';
import { audioService } from '../services/audioService';
import { memoryService } from '../services/memoryService';

interface StudioControlsProps {
  config: AssistantConfig;
  modelMeta: VRMModelMeta | null;
  availableVoices: SpeechSynthesisVoice[];
  currentEmotion: Emotion;
  onUpdateConfig: (partial: Partial<AssistantConfig>) => void;
  onTriggerEmotion: (emotion: Emotion) => void;
  onCustomModelUpload: (file: File) => void;
  onResetModel: () => void;
}

export const StudioControls: React.FC<StudioControlsProps> = ({
  config,
  modelMeta,
  availableVoices,
  currentEmotion,
  onUpdateConfig,
  onTriggerEmotion,
  onCustomModelUpload,
  onResetModel,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'avatar' | 'voice' | 'brain' | 'environment'>('avatar');
  const [customUrlInput, setCustomUrlInput] = useState<string>(config.modelUrl);
  const [isTestingVoice, setIsTestingVoice] = useState<boolean>(false);
  const [memoryState, setMemoryState] = useState(() => memoryService.getMemory());
  const [newPrefInput, setNewPrefInput] = useState('');

  const refreshMemory = () => {
    setMemoryState(memoryService.getMemory());
  };

  const handleAddPreference = () => {
    if (!newPrefInput.trim()) return;
    memoryService.addPreference(newPrefInput.trim());
    setNewPrefInput('');
    refreshMemory();
  };

  const handleClearMemory = () => {
    memoryService.clearMemory();
    refreshMemory();
  };

  const handleTestVoice = async () => {
    if (isTestingVoice) return;
    setIsTestingVoice(true);
    const testPhrase =
      "Hello... it feels so quiet and serene with you here. I am speaking softly... with an innocent warmth, just for you.";

    if (config.ttsEngine === 'fish') {
      await audioService.speakFishAudio(testPhrase, {
        referenceId: config.fishReferenceId || 'f2aed07c91614db28daaaa849150cc6e',
        onStart: () => setIsTestingVoice(true),
        onEnd: () => setIsTestingVoice(false),
        onError: () => {
          // Fallback to local synth
          audioService.speak(testPhrase, {
            voiceURI: config.selectedVoiceURI,
            pitch: config.voicePitch,
            rate: config.voiceSpeed,
            volume: 0.85,
            onStart: () => setIsTestingVoice(true),
            onEnd: () => setIsTestingVoice(false),
            onError: () => setIsTestingVoice(false),
          });
        },
      });
    } else if (config.ttsEngine === 'gemini') {
      await audioService.speakGeminiTTS(testPhrase, {
        voice: 'Aoede',
        onStart: () => setIsTestingVoice(true),
        onEnd: () => setIsTestingVoice(false),
        onError: () => {
          audioService.speak(testPhrase, {
            voiceURI: config.selectedVoiceURI,
            pitch: config.voicePitch,
            rate: config.voiceSpeed,
            volume: 0.85,
            onStart: () => setIsTestingVoice(true),
            onEnd: () => setIsTestingVoice(false),
            onError: () => setIsTestingVoice(false),
          });
        },
      });
    } else {
      audioService.speak(testPhrase, {
        voiceURI: config.selectedVoiceURI,
        pitch: config.voicePitch,
        rate: config.voiceSpeed,
        volume: 0.85,
        onStart: () => setIsTestingVoice(true),
        onEnd: () => setIsTestingVoice(false),
        onError: () => setIsTestingVoice(false),
      });
    }
  };

  const emotionsList: { id: Emotion; label: string; icon: string }[] = [
    { id: 'happy', label: 'Happy', icon: '😊' },
    { id: 'calm', label: 'Calm', icon: '🕊️' },
    { id: 'relaxed', label: 'Relaxed', icon: '😌' },
    { id: 'excited', label: 'Excited', icon: '✨' },
    { id: 'surprised', label: 'Surprised', icon: '😲' },
    { id: 'curious', label: 'Curious', icon: '🧐' },
    { id: 'playful', label: 'Playful', icon: '🌸' },
    { id: 'shy', label: 'Shy', icon: '😳' },
    { id: 'thinking', label: 'Thinking', icon: '🤔' },
    { id: 'sleepy', label: 'Sleepy', icon: '💤' },
    { id: 'wink', label: 'Wink', icon: '😉' },
    { id: 'sad', label: 'Sad', icon: '🥺' },
    { id: 'worried', label: 'Worried', icon: '💭' },
    { id: 'angry', label: 'Angry', icon: '😤' },
    { id: 'neutral', label: 'Neutral', icon: '🌟' },
  ];

  const cameraOptions: { id: CameraPreset; label: string }[] = [
    { id: 'portrait', label: 'Face' },
    { id: 'upper', label: 'Upper' },
    { id: 'full', label: 'Full' },
  ];

  const lightingOptions: { id: LightingPreset; label: string; color: string }[] = [
    { id: 'studio', label: 'Studio', color: 'bg-white' },
    { id: 'cyberpunk', label: 'Cyber', color: 'bg-cyan-400' },
    { id: 'sunset', label: 'Sunset', color: 'bg-amber-500' },
    { id: 'neon', label: 'Neon', color: 'bg-lime-400' },
    { id: 'soft', label: 'Soft', color: 'bg-blue-200' },
  ];

  const backgroundOptions: { id: BackgroundPreset; label: string }[] = [
    { id: 'cyber', label: 'Cyber Grid' },
    { id: 'gradient', label: 'Nebula' },
    { id: 'studio', label: 'Minimal Studio' },
    { id: 'zen', label: 'Warm Zen' },
    { id: 'transparent', label: 'Chroma / Stream' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCustomModelUpload(file);
    }
  };

  const handleApplyUrl = () => {
    if (customUrlInput.trim()) {
      onUpdateConfig({ modelUrl: customUrlInput.trim() });
    }
  };

  return (
    <>
      {/* Top Floating Quick Toolbar */}
      <header
        id="top-studio-toolbar"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/80 backdrop-blur-xl border border-white/10 shadow-2xl"
      >
        {/* Camera View Switcher */}
        <div className="flex items-center bg-black/30 rounded-xl p-1 border border-white/5">
          <Camera className="w-3.5 h-3.5 text-neutral-400 ml-1.5 mr-1" />
          {cameraOptions.map((opt) => (
            <button
              key={opt.id}
              id={`camera-btn-${opt.id}`}
              onClick={() => onUpdateConfig({ cameraPreset: opt.id })}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                config.cameraPreset === opt.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Lighting Switcher */}
        <div className="hidden sm:flex items-center bg-black/30 rounded-xl p-1 border border-white/5">
          <Sun className="w-3.5 h-3.5 text-neutral-400 ml-1.5 mr-1" />
          {lightingOptions.map((opt) => (
            <button
              key={opt.id}
              id={`light-btn-${opt.id}`}
              onClick={() => onUpdateConfig({ lightingPreset: opt.id })}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                config.lightingPreset === opt.id
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${opt.color}`} />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Studio Settings Modal Trigger */}
        <button
          id="open-studio-settings-button"
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-xs font-medium text-purple-200 transition"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Studio Settings</span>
        </button>
      </header>

      {/* Quick Emotion Bar (Top Left) */}
      <aside
        id="quick-emotions-bar"
        className="fixed top-18 left-4 md:left-6 z-20 hidden md:flex flex-col gap-1 p-1.5 rounded-2xl bg-neutral-900/70 backdrop-blur-md border border-white/10 shadow-xl"
      >
        <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider px-2 py-1">
          Expressions
        </span>
        {emotionsList.map((emo) => (
          <button
            key={emo.id}
            id={`trigger-emotion-${emo.id}`}
            onClick={() => onTriggerEmotion(emo.id)}
            title={`Expression: ${emo.label}`}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition ${
              currentEmotion === emo.id
                ? 'bg-purple-600/40 border border-purple-500/40 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>{emo.icon}</span>
            <span className="font-medium text-[11px]">{emo.label}</span>
          </button>
        ))}
      </aside>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div
            id="studio-settings-modal"
            className="w-full max-w-xl rounded-3xl bg-neutral-900 border border-white/15 shadow-2xl shadow-purple-950/40 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-950/40">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-semibold text-white tracking-tight">Studio Configuration</h2>
              </div>
              <button
                id="close-settings-button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-white/10 bg-neutral-950/20 px-6 pt-2 gap-4">
              <button
                onClick={() => setActiveTab('avatar')}
                className={`pb-2.5 text-xs font-medium border-b-2 transition ${
                  activeTab === 'avatar'
                    ? 'border-purple-500 text-purple-300'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                3D Avatar & Model
              </button>
              <button
                onClick={() => setActiveTab('voice')}
                className={`pb-2.5 text-xs font-medium border-b-2 transition ${
                  activeTab === 'voice'
                    ? 'border-purple-500 text-purple-300'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                Personality & Voice
              </button>
              <button
                onClick={() => {
                  refreshMemory();
                  setActiveTab('brain');
                }}
                className={`pb-2.5 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'brain'
                    ? 'border-purple-500 text-purple-300'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                AI Brain & Memory
              </button>
              <button
                onClick={() => setActiveTab('environment')}
                className={`pb-2.5 text-xs font-medium border-b-2 transition ${
                  activeTab === 'environment'
                    ? 'border-purple-500 text-purple-300'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                Lighting & Stage
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-neutral-300">
              {/* Tab: Avatar & Model */}
              {activeTab === 'avatar' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2">
                      Active VRM Model Source
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="custom-vrm-url-input"
                        value={customUrlInput}
                        onChange={(e) => setCustomUrlInput(e.target.value)}
                        placeholder="https://.../character.vrm"
                        className="flex-1 bg-neutral-950 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={handleApplyUrl}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition"
                      >
                        Load URL
                      </button>
                    </div>
                  </div>

                  {/* Upload Local VRM */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2">
                      Or Upload Local .VRM File
                    </label>
                    <label
                      htmlFor="vrm-file-input"
                      className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-2xl cursor-pointer bg-neutral-950/40 hover:bg-neutral-950/80 transition"
                    >
                      <Upload className="w-7 h-7 text-purple-400 mb-2" />
                      <span className="text-xs text-neutral-300 font-medium">Click to choose a .vrm file</span>
                      <span className="text-[11px] text-neutral-500 mt-1">Supports standard VRM 0.0 & VRM 1.0 models</span>
                      <input
                        id="vrm-file-input"
                        type="file"
                        accept=".vrm"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Reset to user prompt default model */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-medium text-white">Default Assistant Model</h4>
                      <p className="text-[11px] text-neutral-400 font-mono">https://files.catbox.moe/r6x4ad.vrm</p>
                    </div>
                    <button
                      onClick={() => {
                        setCustomUrlInput('https://files.catbox.moe/r6x4ad.vrm');
                        onResetModel();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white transition font-medium"
                    >
                      Reset to Default
                    </button>
                  </div>

                  {/* Model Metadata Card */}
                  {modelMeta && (
                    <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-white/10 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-purple-300 font-medium">
                        <Info className="w-3.5 h-3.5" />
                        <span>Model Information</span>
                      </div>
                      <div className="text-xs text-neutral-300 grid grid-cols-2 gap-2 pt-1 font-mono">
                        <div>
                          <span className="text-neutral-500">Title: </span>
                          <span className="text-white">{modelMeta.title || 'VRM Avatar'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Author: </span>
                          <span className="text-white">{modelMeta.author || '3D Creator'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Personality & Voice */}
              {activeTab === 'voice' && (
                <div className="space-y-5">
                  {/* Ethereal Voice Highlights Banner */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-neutral-900/60 to-purple-950/30 border border-purple-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-300" />
                        <span className="text-xs font-semibold text-white">Ethereal & Delicate Voice Profile</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
                        {config.ttsEngine === 'fish' ? 'Fish Audio Active' : config.ttsEngine === 'gemini' ? 'Gemini Neural Active' : 'WebSpeech Active'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      {config.ttsEngine === 'fish'
                        ? 'Powered by Fish Audio s2.1-pro-free neural model with custom reference voice. Silky, delicate, soft, breathy, and dreamlike.'
                        : config.ttsEngine === 'gemini'
                        ? 'Powered by Gemini Neural Speech model with Aoede voice preset.'
                        : 'Using browser speech synthesis with delicate pitch and dreamlike pacing.'}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleTestVoice}
                        disabled={isTestingVoice}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shadow-sm ${
                          isTestingVoice
                            ? 'bg-purple-700 text-purple-200 animate-pulse cursor-wait'
                            : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isTestingVoice ? 'Speaking...' : 'Test Voice'}</span>
                      </button>
                      <button
                        onClick={() => {
                          onUpdateConfig({
                            ttsEngine: 'fish',
                            fishReferenceId: 'f2aed07c91614db28daaaa849150cc6e',
                            personality: 'ethereal',
                            voicePitch: 1.10,
                            voiceSpeed: 0.88,
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-neutral-200 text-xs font-medium transition"
                      >
                        Reset to Columbina Voice
                      </button>
                    </div>
                  </div>

                  {/* TTS Engine Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2">
                      Voice Synthesis Engine
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        onClick={() => onUpdateConfig({ ttsEngine: 'webspeech' })}
                        className={`p-3 rounded-xl border text-left transition ${
                          config.ttsEngine === 'webspeech'
                            ? 'bg-purple-600/25 border-purple-500 text-white ring-1 ring-purple-500/50'
                            : 'bg-neutral-950/50 border-white/10 hover:border-white/20 text-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">Web Speech API</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-mono">
                            Browser
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Instant built-in synthesis, 0 setup required
                        </div>
                      </button>

                      <button
                        onClick={() => onUpdateConfig({ ttsEngine: 'gemini' })}
                        className={`p-3 rounded-xl border text-left transition ${
                          config.ttsEngine === 'gemini'
                            ? 'bg-purple-600/25 border-purple-500 text-white ring-1 ring-purple-500/50'
                            : 'bg-neutral-950/50 border-white/10 hover:border-white/20 text-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">Gemini TTS</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-200 font-mono">
                            Neural
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Gemini 3.1 Neural TTS with Aoede voice
                        </div>
                      </button>

                      <button
                        onClick={() => onUpdateConfig({ ttsEngine: 'fish' })}
                        className={`p-3 rounded-xl border text-left transition ${
                          config.ttsEngine === 'fish'
                            ? 'bg-purple-600/25 border-purple-500 text-white ring-1 ring-purple-500/50'
                            : 'bg-neutral-950/50 border-white/10 hover:border-white/20 text-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">Fish Audio</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 font-mono">
                            Optional Key
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Custom voice reference with auto-fallback
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Fish Audio Settings */}
                  {config.ttsEngine === 'fish' && (
                    <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white">Voice Reference ID</span>
                        <span className="text-[10px] text-neutral-400 font-mono">s2.1-pro-free</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={config.fishReferenceId || 'f2aed07c91614db28daaaa849150cc6e'}
                          onChange={(e) => onUpdateConfig({ fishReferenceId: e.target.value })}
                          className="flex-1 bg-neutral-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                          placeholder="Fish Audio Reference ID"
                        />
                        <button
                          onClick={() =>
                            onUpdateConfig({ fishReferenceId: 'f2aed07c91614db28daaaa849150cc6e' })
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-neutral-300 text-xs"
                          title="Restore default model voice"
                        >
                          Default
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-0.5">
                        <span>Format: MP3 24kHz</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Online API Ready
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Personality Persona */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2">
                      Assistant Personality
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        { id: 'ethereal', name: 'Elysia (Ethereal & Serene)', desc: 'Delicate, soft, dreamlike voice with an enigmatic presence' },
                        { id: 'companion', name: 'Lumi (Companion)', desc: 'Warm, cheerful, animated anime companion' },
                        { id: 'mentor', name: 'Ada (Study Mentor)', desc: 'Insightful, supportive tutor and guide' },
                        { id: 'cyberpunk', name: 'Cipher (Cyberpunk)', desc: 'Futuristic AI with tech prowess & wit' },
                      ].map((persona) => (
                        <button
                          key={persona.id}
                          onClick={() => onUpdateConfig({ personality: persona.id as any })}
                          className={`p-3 rounded-xl border text-left transition ${
                            config.personality === persona.id
                              ? 'bg-purple-600/20 border-purple-500/50 text-white'
                              : 'bg-neutral-950/50 border-white/10 hover:border-white/20 text-neutral-400'
                          }`}
                        >
                          <div className="text-xs font-semibold text-white mb-0.5">{persona.name}</div>
                          <div className="text-[11px] text-neutral-400 line-clamp-2">{persona.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Web Speech Controls */}
                  {config.ttsEngine === 'webspeech' && (
                    <>
                      {/* Voice Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2">
                          Synthesizer Voice
                        </label>
                        <select
                          value={config.selectedVoiceURI}
                          onChange={(e) => onUpdateConfig({ selectedVoiceURI: e.target.value })}
                          className="w-full bg-neutral-950 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="">Auto-select Most Delicate Feminine Voice</option>
                          {availableVoices.map((voice) => (
                            <option key={voice.voiceURI} value={voice.voiceURI}>
                              {voice.name} ({voice.lang})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Speech Sliders */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-medium text-neutral-300">Pacing (Rate)</span>
                            <span className="font-mono text-purple-300">{config.voiceSpeed}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.75"
                            max="1.3"
                            step="0.02"
                            value={config.voiceSpeed}
                            onChange={(e) => onUpdateConfig({ voiceSpeed: parseFloat(e.target.value) })}
                            className="w-full accent-purple-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-neutral-400">Slow to moderate, relaxed (0.88x)</span>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-medium text-neutral-300">Pitch</span>
                            <span className="font-mono text-purple-300">{config.voicePitch}</span>
                          </div>
                          <input
                            type="range"
                            min="0.8"
                            max="1.3"
                            step="0.02"
                            value={config.voicePitch}
                            onChange={(e) => onUpdateConfig({ voicePitch: parseFloat(e.target.value) })}
                            className="w-full accent-purple-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-neutral-400">Naturally high, delicate, non-shrill (1.10)</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Sound FX Switch */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950/40 border border-white/10">
                    <div>
                      <span className="text-xs font-medium text-white block">Auditory UI Cues</span>
                      <span className="text-[11px] text-neutral-400">Play subtle chime tones when chatting</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.soundEffects}
                      onChange={(e) => onUpdateConfig({ soundEffects: e.target.checked })}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Tab: AI Brain & Memory */}
              {activeTab === 'brain' && (
                <div className="space-y-6">
                  {/* Primary AI Brain Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-purple-400" />
                        Character Intelligence Brain
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Server Environment Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => onUpdateConfig({ aiBrain: 'openai' })}
                        className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden ${
                          (config.aiBrain || 'openai') === 'openai'
                            ? 'bg-purple-600/20 border-purple-500 text-white ring-1 ring-purple-500/40 shadow-lg shadow-purple-950/40'
                            : 'bg-neutral-950/50 border-white/10 hover:border-white/20 text-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">OpenAI Brain</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 font-mono">
                              PRIMARY
                            </span>
                          </div>
                          {(config.aiBrain || 'openai') === 'openai' && (
                            <Check className="w-4 h-4 text-purple-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-300 leading-relaxed mb-1.5">
                          High emotional intelligence, expressive personality reasoning, and structured animation orchestration.
                        </p>
                        <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5">
                          <span>Model: GPT-4o-mini</span>
                          <span>•</span>
                          <span>JSON Structure</span>
                        </div>
                      </button>

                      <button
                        onClick={() => onUpdateConfig({ aiBrain: 'gemini' })}
                        className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden ${
                          config.aiBrain === 'gemini'
                            ? 'bg-purple-600/20 border-purple-500 text-white ring-1 ring-purple-500/40 shadow-lg shadow-purple-950/40'
                            : 'bg-neutral-950/50 border-white/10 hover:border-white/20 text-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">Gemini Brain</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-mono">
                              FALLBACK
                            </span>
                          </div>
                          {config.aiBrain === 'gemini' && (
                            <Check className="w-4 h-4 text-purple-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-300 leading-relaxed mb-1.5">
                          Fast multimodal responses with transparent fallback if OpenAI rate limits or network issues arise.
                        </p>
                        <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5">
                          <span>Model: Gemini 2.5 Flash</span>
                          <span>•</span>
                          <span>Auto-Fallback</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Architecture Overview */}
                  <div className="p-3.5 rounded-2xl bg-neutral-950/50 border border-white/10 space-y-2">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-purple-400" />
                      Modular Architecture Pipeline
                    </div>
                    <div className="text-[11px] text-neutral-400 space-y-1 font-mono leading-relaxed bg-neutral-900/60 p-2.5 rounded-xl border border-white/5">
                      <div className="text-purple-300 font-semibold">Character Brain (OpenAI)</div>
                      <div className="text-neutral-500">  ↓ generates structured schema: &#123; message, emotion, intensity, animation &#125;</div>
                      <div className="text-neutral-300">  ├── 1. Spoken text → Fish Audio Neural MP3 / Web Speech</div>
                      <div className="text-neutral-300">  ├── 2. Emotion & Intensity → VRM Expression Morphs</div>
                      <div className="text-neutral-300">  ├── 3. Animation → VRM Humanoid Bone Generator</div>
                      <div className="text-neutral-300">  └── 4. UI display → Interactive Chat System</div>
                    </div>
                  </div>

                  {/* Character Memory (Short-Term & Long-Term Context) */}
                  <div className="p-3.5 rounded-2xl bg-neutral-950/50 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Database className="w-3.5 h-3.5 text-purple-400" />
                        Conversation Memory & Preferences
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={refreshMemory}
                          className="p-1 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition"
                          title="Refresh Memory"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleClearMemory}
                          className="px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 rounded border border-red-800/30 transition"
                        >
                          Clear Memory
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Preferences and facts shared during chat are automatically remembered by the character&apos;s brain.
                    </p>

                    <div className="space-y-2">
                      <div className="text-[11px] font-medium text-neutral-300">Stored Facts & Preferences:</div>
                      <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                        {memoryState.userPreferences.length === 0 && memoryState.importantFacts.length === 0 ? (
                          <div className="text-[11px] text-neutral-500 italic">
                            No persistent facts recorded yet. Tell the character what you like!
                          </div>
                        ) : (
                          <>
                            {memoryState.userPreferences.map((p, idx) => (
                              <div
                                key={'pref-' + idx}
                                className="text-[11px] px-2 py-1 rounded-lg bg-neutral-900 border border-white/5 text-purple-200 flex items-center justify-between"
                              >
                                <span>{p}</span>
                                <span className="text-[9px] text-neutral-500 font-mono">preference</span>
                              </div>
                            ))}
                            {memoryState.importantFacts.map((f, idx) => (
                              <div
                                key={'fact-' + idx}
                                className="text-[11px] px-2 py-1 rounded-lg bg-neutral-900 border border-white/5 text-blue-200 flex items-center justify-between"
                              >
                                <span>{f}</span>
                                <span className="text-[9px] text-neutral-500 font-mono">fact</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Manual add preference */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newPrefInput}
                        onChange={(e) => setNewPrefInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddPreference();
                        }}
                        placeholder="Add a preference (e.g. loves stargazing, quiet mornings)..."
                        className="flex-1 bg-neutral-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={handleAddPreference}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Environment & Stage */}
              {activeTab === 'environment' && (
                <div className="space-y-5">
                  {/* Background Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2">
                      Stage Backdrop
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {backgroundOptions.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => onUpdateConfig({ backgroundPreset: bg.id })}
                          className={`p-3 rounded-xl border text-center transition text-xs font-medium ${
                            config.backgroundPreset === bg.id
                              ? 'bg-purple-600/30 border-purple-500/60 text-white shadow-sm'
                              : 'bg-neutral-950/50 border-white/10 hover:border-white/20 text-neutral-400'
                          }`}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lighting Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2">
                      Studio Light Array
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {lightingOptions.map((lt) => (
                        <button
                          key={lt.id}
                          onClick={() => onUpdateConfig({ lightingPreset: lt.id })}
                          className={`p-3 rounded-xl border text-center transition text-xs font-medium flex items-center justify-center gap-2 ${
                            config.lightingPreset === lt.id
                              ? 'bg-neutral-800 border-purple-500/60 text-white'
                              : 'bg-neutral-950/50 border-white/10 hover:border-white/20 text-neutral-400'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${lt.color}`} />
                          {lt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-6 py-3.5 border-t border-white/10 bg-neutral-950/40">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition shadow-md shadow-purple-900/30"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
