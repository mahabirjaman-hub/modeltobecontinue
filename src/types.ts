export type FishAudioEmotion =
  | 'gentle'
  | 'friendly'
  | 'professional'
  | 'serious'
  | 'cheerful'
  | 'enthusiastic'
  | 'confident'
  | 'authoritative'
  | 'empathetic'
  | 'playful'
  | 'dramatic'
  | 'intimate'
  | 'mysterious'
  | 'sad'
  | 'angry'
  | 'sexy';

export type Emotion =
  | FishAudioEmotion
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'surprised'
  | 'shy'
  | 'curious'
  | 'calm'
  | 'worried'
  | 'sleepy'
  | 'thinking'
  | 'relaxed'
  | 'wink';

export type CharacterAnimation =
  | 'idle'
  | 'talking'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'thinking'
  | 'excited'
  | 'sleepy';

export type Personality = 'ethereal' | 'companion' | 'cyberpunk' | 'mentor' | 'professional';

export type LightingPreset = 'studio' | 'cyberpunk' | 'sunset' | 'soft' | 'neon';

export type BackgroundPreset = 'gradient' | 'cyber' | 'studio' | 'zen' | 'transparent';

export type CameraPreset = 'portrait' | 'upper' | 'full';

export type ColumbinaLanguage = 'English' | 'Hindi' | 'Bengali' | 'Japanese';

export interface StructuredAIResponse {
  message: string;
  emotion: Emotion;
  intensity: number;
  expression?: string;
  voice_direction?: string;
  animation: CharacterAnimation;
  currentLanguage?: ColumbinaLanguage;
}

export interface CharacterMemory {
  userPreferences: string[];
  importantFacts: string[];
  relationshipContext: string[];
  conversationSummary: string;
}

export interface VoiceEmotionSignal {
  primary:
    | 'sad'
    | 'cheerful'
    | 'hesitant'
    | 'playful'
    | 'angry'
    | 'calm'
    | 'gentle'
    | 'neutral'
    | 'curious'
    | 'mysterious'
    | 'intimate'
    | 'enthusiastic';
  confidence: number;
  intensity: number;
}

export interface ParalinguisticAnalysis {
  rawTranscript: string;
  cleanedTranscript: string;
  vocalSound?:
    | 'hmm'
    | 'mmm'
    | 'hmph'
    | 'hmp'
    | 'sigh'
    | 'laugh'
    | 'cry'
    | 'whisper'
    | 'gasp'
    | 'shout'
    | 'hesitation'
    | 'none';
  tone?: string;
  pitch?: 'high' | 'normal' | 'low';
  speakingSpeed?: 'fast' | 'normal' | 'slow';
  loudness?: 'whisper' | 'quiet' | 'normal' | 'loud' | 'shout';
  pauses?: number;
  isShaky?: boolean;
  voiceEmotion?: VoiceEmotionSignal;
  contextInterpretation?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cleanText?: string;
  emotion?: Emotion;
  expression?: string;
  voice_direction?: string;
  animation?: CharacterAnimation;
  intensity?: number;
  timestamp: number;
  isAudioPlaying?: boolean;
  language?: ColumbinaLanguage;
  voiceAnalysis?: ParalinguisticAnalysis;
}

export interface AssistantConfig {
  aiBrain: 'openai' | 'gemini';
  personality: Personality;
  userName: string;
  voiceSpeed: number;
  voicePitch: number;
  autoSpeak: boolean;
  selectedVoiceURI: string;
  ttsEngine: 'fish' | 'webspeech' | 'gemini';
  fishReferenceId: string;
  modelUrl: string;
  lightingPreset: LightingPreset;
  backgroundPreset: BackgroundPreset;
  cameraPreset: CameraPreset;
  soundEffects: boolean;
  speechLanguage: string;
  currentLanguage: ColumbinaLanguage;
}

export interface VoiceCorrectionResult {
  isNoise?: boolean;
  rawTranscript: string;
  correctedText: string;
  confidence: number;
  needsClarification: boolean;
  clarificationText?: string;
  reason?: string;
  voiceAnalysis?: ParalinguisticAnalysis;
}

export interface VRMModelMeta {
  title?: string;
  author?: string;
  version?: string;
  contactInformation?: string;
  allowedUser?: string;
}

