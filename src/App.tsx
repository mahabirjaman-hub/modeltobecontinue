/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VRMViewer } from './components/VRMViewer';
import { EtherealDialogueBar } from './components/EtherealDialogueBar';
import { audioService } from './services/audioService';
import { memoryService } from './services/memoryService';
import {
  ChatMessage,
  Emotion,
  CharacterAnimation,
  AssistantConfig,
  VRMModelMeta,
  VoiceCorrectionResult,
  ColumbinaLanguage,
  ParalinguisticAnalysis,
} from './types';

// Natural language switch detection helper
function detectLanguageSwitch(text: string): ColumbinaLanguage | null {
  const lower = (text || "").toLowerCase().trim();
  if (!lower) return null;

  // 1. Hindi detection patterns
  if (
    lower.includes("speak hindi") ||
    lower.includes("talk in hindi") ||
    lower.includes("switch to hindi") ||
    lower.includes("change to hindi") ||
    lower.includes("can you speak hindi") ||
    lower.includes("hindi please") ||
    lower.includes("hindi mein") ||
    lower.includes("hindi me") ||
    /हिंदी\s*में\s*बात\s*करो/i.test(text) ||
    /हिंदी\s*बोलो/i.test(text) ||
    /हिंदी/i.test(text)
  ) {
    return "Hindi";
  }

  // 2. Bengali detection patterns
  if (
    lower.includes("speak bengali") ||
    lower.includes("talk in bengali") ||
    lower.includes("switch to bengali") ||
    lower.includes("change to bengali") ||
    lower.includes("can you speak bengali") ||
    lower.includes("bengali please") ||
    lower.includes("bangla please") ||
    lower.includes("banglay kotha") ||
    lower.includes("bangla te") ||
    /বাংলায়\s*কথা\s*বলো/i.test(text) ||
    /বাংলা\s*বলো/i.test(text) ||
    /বাংলা/i.test(text)
  ) {
    return "Bengali";
  }

  // 3. Japanese detection patterns
  if (
    lower.includes("speak japanese") ||
    lower.includes("talk in japanese") ||
    lower.includes("switch to japanese") ||
    lower.includes("change to japanese") ||
    lower.includes("can you speak japanese") ||
    lower.includes("japanese please") ||
    lower.includes("nihongo de") ||
    /日本語で話して/i.test(text) ||
    /日本語を話して/i.test(text) ||
    /日本語/i.test(text)
  ) {
    return "Japanese";
  }

  // 4. English detection patterns
  if (
    lower.includes("speak english") ||
    lower.includes("talk in english") ||
    lower.includes("switch to english") ||
    lower.includes("change to english") ||
    lower.includes("english again") ||
    lower.includes("talk to me in english") ||
    lower.includes("can you speak english") ||
    lower.includes("english please") ||
    lower.includes("back to english")
  ) {
    return "English";
  }

  return null;
}

const DEFAULT_VRM_URL = '/columbinamodel.vrm';

const INITIAL_CONFIG: AssistantConfig = {
  aiBrain: 'gemini',
  personality: 'ethereal',
  userName: 'Friend',
  voiceSpeed: 0.88,
  voicePitch: 1.10,
  autoSpeak: true,
  selectedVoiceURI: '',
  ttsEngine: 'fish',
  fishReferenceId: 'f2aed07c91614db28daaaa849150cc6e',
  modelUrl: DEFAULT_VRM_URL,
  lightingPreset: 'soft',
  backgroundPreset: 'gradient',
  cameraPreset: 'full',
  soundEffects: true,
  speechLanguage: 'en-US',
  currentLanguage: 'English',
};

export default function App() {
  const [config, setConfig] = useState<AssistantConfig>(INITIAL_CONFIG);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('calm');
  const [currentAnimation, setCurrentAnimation] = useState<CharacterAnimation>('idle');
  const [emotionIntensity, setEmotionIntensity] = useState<number>(0.35);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [modelMeta, setModelMeta] = useState<VRMModelMeta | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Timer to revert temporary emotions and animations back to neutral/idle
  const emotionResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load available TTS voices on mount
  useEffect(() => {
    audioService.getVoices().then((voices) => {
      setAvailableVoices(voices);
    });
  }, []);

  // Initial greeting from Columbina Hyposelenia
  useEffect(() => {
    const greetingText =
      "Mm-hmm... The light is very gentle today. Hello. I am Columbina. It is quiet here, isn't it? Tell me... what brings you to my side?";

    const initialMessage: ChatMessage = {
      id: 'greeting-columbina-1',
      role: 'assistant',
      content: greetingText,
      cleanText: greetingText,
      emotion: 'gentle',
      expression: '[calm]',
      voice_direction: '(whispering)',
      animation: 'idle',
      intensity: 0.35,
      timestamp: Date.now(),
    };

    setMessages([initialMessage]);

    // Speak greeting on first user interaction or delay
    const timer = setTimeout(() => {
      if (config.autoSpeak) {
        speakText(greetingText, 'gentle', '[calm]', '(whispering)');
      }
    }, 1400);

    return () => clearTimeout(timer);
  }, []);

  // Trigger an emotion with auto-revert
  const triggerEmotion = useCallback((emotion: Emotion, durationMs: number = 4000) => {
    setCurrentEmotion(emotion);
    if (config.soundEffects) {
      audioService.playChime('emotion');
    }

    if (emotionResetTimeoutRef.current) {
      clearTimeout(emotionResetTimeoutRef.current);
    }

    if (emotion !== 'neutral' && emotion !== 'calm') {
      emotionResetTimeoutRef.current = setTimeout(() => {
        setCurrentEmotion('calm');
        setCurrentAnimation('idle');
      }, durationMs);
    }
  }, [config.soundEffects]);

  // Handle Speech synthesis and Viseme driving
  const speakText = useCallback(
    async (
      text: string,
      emotionForSpeech?: Emotion,
      expression?: string,
      voiceDirection?: string,
      languageForSpeech?: ColumbinaLanguage
    ) => {
      if (emotionForSpeech) {
        setCurrentEmotion(emotionForSpeech);
      }

      setIsSpeaking(true);

      const activeLang = languageForSpeech || config.currentLanguage || 'English';
      const speechLangCode =
        activeLang === 'Hindi'
          ? 'hi-IN'
          : activeLang === 'Bengali'
          ? 'bn-IN'
          : activeLang === 'Japanese'
          ? 'ja-JP'
          : config.speechLanguage || 'en-US';

      if (config.ttsEngine === 'fish') {
        try {
          const analyserNode = await audioService.speakFishAudio(text, {
            referenceId: config.fishReferenceId || 'f2aed07c91614db28daaaa849150cc6e',
            expression,
            voiceDirection,
            onStart: () => {
              setIsSpeaking(true);
            },
            onEnd: () => {
              setIsSpeaking(false);
              setTimeout(() => {
                setCurrentEmotion('gentle');
                setCurrentAnimation('idle');
              }, 1200);
            },
            onError: () => {
              // Graceful fallback to browser speech synthesis
              audioService.speak(text, {
                voiceURI: config.selectedVoiceURI,
                rate: config.voiceSpeed,
                pitch: config.voicePitch,
                lang: speechLangCode,
                onStart: () => setIsSpeaking(true),
                onEnd: () => {
                  setIsSpeaking(false);
                  setTimeout(() => {
                    setCurrentEmotion('gentle');
                    setCurrentAnimation('idle');
                  }, 1200);
                },
                onError: () => setIsSpeaking(false),
              });
            },
          });

          if (analyserNode) {
            setAnalyser(analyserNode);
            return;
          }
        } catch {
          // Handled by onError fallback
        }
      } else if (config.ttsEngine === 'gemini') {
        try {
          const analyserNode = await audioService.speakGeminiTTS(text, {
            voice: 'Aoede',
            onStart: () => {
              setIsSpeaking(true);
            },
            onEnd: () => {
              setIsSpeaking(false);
              setTimeout(() => {
                setCurrentEmotion('gentle');
                setCurrentAnimation('idle');
              }, 1200);
            },
            onError: () => {
              audioService.speak(text, {
                voiceURI: config.selectedVoiceURI,
                rate: config.voiceSpeed,
                pitch: config.voicePitch,
                lang: speechLangCode,
                onStart: () => setIsSpeaking(true),
                onEnd: () => {
                  setIsSpeaking(false);
                  setTimeout(() => {
                    setCurrentEmotion('gentle');
                    setCurrentAnimation('idle');
                  }, 1200);
                },
                onError: () => setIsSpeaking(false),
              });
            },
          });

          if (analyserNode) {
            setAnalyser(analyserNode);
            return;
          }
        } catch {
          // Handled by onError fallback
        }
      }

      // Default Web Speech synthesis
      audioService.speak(text, {
        voiceURI: config.selectedVoiceURI,
        rate: config.voiceSpeed,
        pitch: config.voicePitch,
        lang: speechLangCode,
        onStart: () => {
          setIsSpeaking(true);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setTimeout(() => {
            setCurrentEmotion('gentle');
            setCurrentAnimation('idle');
          }, 1200);
        },
        onError: () => {
          setIsSpeaking(false);
        },
      });
    },
    [
      config.currentLanguage,
      config.fishReferenceId,
      config.selectedVoiceURI,
      config.speechLanguage,
      config.ttsEngine,
      config.voicePitch,
      config.voiceSpeed,
    ]
  );

  // Send message to AI Brain (Gemini / OpenAI)
  const handleSendMessage = async (text: string, voiceAnalysis?: ParalinguisticAnalysis) => {
    if (!text.trim() || isGenerating) return;

    // Speech Interruption: If Columbina is currently speaking, stop playback immediately
    if (isSpeaking) {
      handleStopSpeaking();
    }

    if (config.soundEffects) {
      audioService.playChime('send');
    }

    // Auto-detect natural language switch requested by the user
    const trimmed = text.trim();
    const detectedSwitch = detectLanguageSwitch(trimmed);
    let activeLang: ColumbinaLanguage = detectedSwitch || config.currentLanguage || 'English';

    if (detectedSwitch && detectedSwitch !== config.currentLanguage) {
      const speechMap: Record<ColumbinaLanguage, string> = {
        English: 'en-US',
        Hindi: 'hi-IN',
        Bengali: 'bn-IN',
        Japanese: 'ja-JP',
      };
      setConfig((prev) => ({
        ...prev,
        currentLanguage: detectedSwitch,
        speechLanguage: speechMap[detectedSwitch] || 'en-US',
      }));
    }

    // Auto-detect user facts or preferences to enrich memory
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('i love ') || lower.startsWith('i like ') || lower.startsWith('my favorite ')) {
      memoryService.addPreference(trimmed);
    } else if (lower.startsWith('my name is ') || lower.startsWith('i am a ') || lower.startsWith('i live in ')) {
      memoryService.addFact(trimmed);
    }

    const userMessage: ChatMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: trimmed,
      cleanText: trimmed,
      timestamp: Date.now(),
      voiceAnalysis,
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsGenerating(true);

    // Avatar reflects thoughtfully while generating
    setCurrentEmotion('thinking');
    setCurrentAnimation('thinking');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({
            role: m.role,
            content: m.cleanText || m.content,
            voiceAnalysis: m.voiceAnalysis,
          })),
          voiceAnalysis,
          aiBrain: config.aiBrain || 'gemini',
          personality: config.personality,
          memory: memoryService.getMemory(),
          currentLanguage: activeLang,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const responseEmotion = (data.emotion as Emotion) || 'gentle';
      const responseAnimation = (data.animation as CharacterAnimation) || 'talking';
      const responseIntensity = typeof data.intensity === 'number' ? data.intensity : 0.35;
      const responseExpression = data.expression || '';
      const responseVoiceDirection = data.voice_direction || '';
      const spokenMessage = (data.message || data.cleanText || data.text || '').trim();

      // Ensure language state syncs from backend response
      if (data.currentLanguage && ['English', 'Hindi', 'Bengali', 'Japanese'].includes(data.currentLanguage)) {
        const returnedLang = data.currentLanguage as ColumbinaLanguage;
        if (returnedLang !== config.currentLanguage) {
          const speechMap: Record<ColumbinaLanguage, string> = {
            English: 'en-US',
            Hindi: 'hi-IN',
            Bengali: 'bn-IN',
            Japanese: 'ja-JP',
          };
          setConfig((prev) => ({
            ...prev,
            currentLanguage: returnedLang,
            speechLanguage: speechMap[returnedLang] || 'en-US',
          }));
          activeLang = returnedLang;
        }
      }

      const assistantMessage: ChatMessage = {
        id: 'ast-' + Date.now(),
        role: 'assistant',
        content: spokenMessage,
        cleanText: spokenMessage,
        emotion: responseEmotion,
        expression: responseExpression,
        voice_direction: responseVoiceDirection,
        animation: responseAnimation,
        intensity: responseIntensity,
        timestamp: Date.now(),
        language: activeLang,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 1. Emotion -> VRM Expression System
      setCurrentEmotion(responseEmotion);
      setEmotionIntensity(responseIntensity);

      // 2. Animation -> VRM Animation System
      setCurrentAnimation(responseAnimation);

      if (config.soundEffects) {
        audioService.playChime('receive');
      }

      // 3. Spoken text -> Voice / TTS System (Columbina speaks her response)
      if (spokenMessage) {
        speakText(spokenMessage, responseEmotion, responseExpression, responseVoiceDirection, activeLang);
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const fallbackMessages: Record<ColumbinaLanguage, string> = {
        English: "The stars fell silent for a fleeting breath... I am still here beside you, listening softly.",
        Hindi: "हवा में एक शांत झोंका बह गया... I am still here beside you, listening softly.",
        Bengali: "হাওয়ায় একটা শান্ত দোলা দিয়ে গেল... I am still here beside you, listening softly.",
        Japanese: "風が静かに通り過ぎていきましたね... I am still here beside you, listening softly.",
      };
      const fallbackText = fallbackMessages[activeLang] || fallbackMessages.English;
      const errorMessage: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: fallbackText,
        cleanText: fallbackText,
        emotion: 'gentle',
        expression: '[calm]',
        voice_direction: '',
        animation: 'idle',
        intensity: 0.3,
        timestamp: Date.now(),
        language: activeLang,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setCurrentEmotion('gentle');
      setCurrentAnimation('idle');
      speakText(fallbackText, 'gentle', '[calm]', '(softly)', activeLang);
    } finally {
      setIsGenerating(false);
    }
  };

  // Voice utterance handler through Voice Auto-Correction & Disambiguation pipeline
  const handleVoiceUtterance = async (
    rawTranscript: string,
    language?: string,
    voiceAnalysis?: ParalinguisticAnalysis
  ) => {
    const trimmed = rawTranscript.trim();
    if (!trimmed || isGenerating) return;

    // Speech Interruption: If Columbina is speaking, interrupt immediately
    if (isSpeaking) {
      handleStopSpeaking();
    }

    try {
      // 1. Pass through AI Voice Auto-Correction & Context Disambiguation
      const correctRes = await fetch('/api/voice/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTranscript: trimmed,
          recentMessages: messages.map((m) => ({
            role: m.role,
            content: m.cleanText || m.content,
          })),
          language: language || config.speechLanguage || 'en-US',
        }),
      });

      if (!correctRes.ok) {
        throw new Error(`Voice correction HTTP ${correctRes.status}`);
      }

      const data: VoiceCorrectionResult = await correctRes.json();

      // Ignore pure acoustic noise / filler without generating an AI response (Requirement 10)
      if (data.isNoise || !data.correctedText) {
        return;
      }

      // If confidence is low, trigger Columbina's natural clarification spoken aloud (Requirement 6 & 7)
      if (data.needsClarification || data.confidence < 0.50) {
        const clarifyText =
          data.clarificationText ||
          "Mm... I couldn't quite hear you. Could you say that again?";
        const assistantMessage: ChatMessage = {
          id: 'ast-' + Date.now(),
          role: 'assistant',
          content: clarifyText,
          cleanText: clarifyText,
          emotion: 'gentle',
          expression: '[calm]',
          voice_direction: '(whispering)',
          animation: 'talking',
          intensity: 0.35,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentEmotion('gentle');
        setCurrentAnimation('talking');
        speakText(clarifyText, 'gentle', '[calm]', '(whispering)');
        return;
      }

      // High/medium confidence: send cleaned & corrected user message to Columbina Brain
      await handleSendMessage(data.correctedText, voiceAnalysis);
    } catch (err) {
      console.warn('Voice auto-correction fallback, sending raw transcript:', err);
      await handleSendMessage(trimmed, voiceAnalysis);
    }
  };

  // Replay audio for a past message
  const handleReplayAudio = (message: ChatMessage) => {
    const textToSpeak = message.cleanText || message.content;
    speakText(textToSpeak, message.emotion, message.expression, message.voice_direction);
  };

  // Stop current speech playback (for user interruption)
  const handleStopSpeaking = useCallback(() => {
    audioService.stop();
    setIsSpeaking(false);
  }, []);

  // Avatar Poke Interaction
  const handleAvatarClick = () => {
    if (config.soundEffects) {
      audioService.playChime('emotion');
    }
    triggerEmotion('curious', 2800);

    const activeLang = config.currentLanguage || 'English';
    const pokeLinesByLang: Record<ColumbinaLanguage, string[]> = {
      English: [
        "Mm-hmm... The moonlight feels quiet today. Did you want to speak with me?",
        "Oh... You reached out to me. Are humans usually this fond of touching things they find unfamiliar?",
        "Mm... I was watching the soft dust drifting in the air. What is on your mind?",
        "I was just humming a quiet melody from Silvermoon Hall... What brings you over?",
        "I don't mind you being close. It feels... peaceful.",
      ],
      Hindi: [
        "Mm-hmm... आज रात का moonlight कितना शांत है. Did you want to speak with me?",
        "Oh... तुमने मुझे छू लिया. Are humans always this curious about unfamiliar things?",
        "Mm... मैं हवा में तैरती हुई quiet dust को देख रही थी. What is on your mind?",
        "मैं Silvermoon Hall की एक quiet melody hum कर रही थी... What brings you over?",
        "तुम्हारे पास होने से मुझे अच्छा लगता है... it feels very peaceful.",
      ],
      Bengali: [
        "Mm-hmm... আজকের moonlight সত্যি খুব শান্ত. Did you want to speak with me?",
        "Oh... তুমি আমাকে ছুঁয়ে দিলে? Humans are so curious, aren't they?",
        "Mm... আমি হাওয়ায় ভেসে থাকা quiet dust দেখছিলাম. What is on your mind?",
        "আমি Silvermoon Hall এর একটা quiet melody hum করছিলাম... What brings you over?",
        "তুমি পাশে থাকলে খুব ভালো লাগে... it feels very peaceful.",
      ],
      Japanese: [
        "Mm-hmm... 今夜の moonlight はとても静かですね. Did you want to speak with me?",
        "Oh... 触れてくれたのですね. Humans are so curious, aren't they?",
        "Mm... 空気中を漂う quiet dust を眺めていました. What is on your mind?",
        "Silvermoon Hall の静かな melody を hum していたところです... What brings you over?",
        "近くにいてくれると... it feels very peaceful.",
      ],
    };

    const langLines = pokeLinesByLang[activeLang] || pokeLinesByLang.English;
    const randomLine = langLines[Math.floor(Math.random() * langLines.length)];

    if (!isSpeaking && !isGenerating) {
      speakText(randomLine, 'calm', undefined, undefined, activeLang);
    }
  };

  // Custom model file upload
  const handleCustomModelUpload = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setConfig((prev) => ({ ...prev, modelUrl: objectUrl }));
  };

  const handleResetModel = () => {
    setConfig((prev) => ({ ...prev, modelUrl: DEFAULT_VRM_URL }));
  };

  const handleUpdateConfig = (partial: Partial<AssistantConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastSpokenText = lastAssistantMessage?.cleanText || lastAssistantMessage?.content || '';

  return (
    <main
      onClick={handleAvatarClick}
      className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans select-none cursor-pointer"
      title="Click anywhere to interact with Columbina"
    >
      {/* 3D VRM Canvas Viewport */}
      <VRMViewer
        modelUrl={config.modelUrl}
        currentEmotion={currentEmotion}
        currentAnimation={currentAnimation}
        emotionIntensity={emotionIntensity}
        isSpeaking={isSpeaking}
        analyser={analyser}
        lightingPreset={config.lightingPreset}
        cameraPreset={config.cameraPreset}
        backgroundPreset={config.backgroundPreset}
        onModelLoaded={(meta) => setModelMeta(meta)}
        onAvatarClick={handleAvatarClick}
      />

      {/* Ethereal Floating Input Bar */}
      <EtherealDialogueBar
        isGenerating={isGenerating}
        isSpeaking={isSpeaking}
        currentEmotion={currentEmotion}
        lastSpokenText={lastSpokenText}
        speechLanguage={config.speechLanguage}
        currentLanguage={config.currentLanguage || 'English'}
        onSendMessage={handleSendMessage}
        onSendVoiceUtterance={handleVoiceUtterance}
        onStopSpeaking={handleStopSpeaking}
        onLanguageChange={(lang) =>
          setConfig((prev) => ({ ...prev, speechLanguage: lang }))
        }
        onColumbinaLanguageChange={(lang) => {
          const speechMap: Record<ColumbinaLanguage, string> = {
            English: 'en-US',
            Hindi: 'hi-IN',
            Bengali: 'bn-IN',
            Japanese: 'ja-JP',
          };
          setConfig((prev) => ({
            ...prev,
            currentLanguage: lang,
            speechLanguage: speechMap[lang] || 'en-US',
          }));
        }}
      />
    </main>
  );
}
