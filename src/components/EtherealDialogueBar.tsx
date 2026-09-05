import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Mic,
  EyeOff,
  Moon,
  Loader2,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { Emotion, ColumbinaLanguage, ParalinguisticAnalysis } from '../types';
import { voiceAnalysisService } from '../services/voiceAnalysisService';
import { audioService } from '../services/audioService';

export const AVAILABLE_SPEECH_LANGUAGES = [
  { code: 'en-US', label: 'English (US)', short: 'EN' },
  { code: 'en-GB', label: 'English (UK)', short: 'UK' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)', short: 'HI' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)', short: 'BN' },
  { code: 'ja-JP', label: 'Japanese (日本語)', short: 'JA' },
  { code: 'zh-CN', label: 'Chinese (中文)', short: 'ZH' },
  { code: 'ko-KR', label: 'Korean (한국어)', short: 'KO' },
  { code: 'es-ES', label: 'Spanish (Español)', short: 'ES' },
  { code: 'fr-FR', label: 'French (Français)', short: 'FR' },
  { code: 'de-DE', label: 'German (Deutsch)', short: 'DE' },
];

interface EtherealDialogueBarProps {
  lastSpokenText?: string;
  isSpeaking?: boolean;
  isGenerating: boolean;
  currentEmotion?: Emotion;
  speechLanguage?: string;
  currentLanguage?: ColumbinaLanguage;
  onSendMessage: (message: string, voiceAnalysis?: ParalinguisticAnalysis) => void;
  onSendVoiceUtterance?: (
    rawText: string,
    language: string,
    voiceAnalysis?: ParalinguisticAnalysis
  ) => Promise<void>;
  onStopSpeaking?: () => void;
  onReplayAudio?: () => void;
  onLanguageChange?: (lang: string) => void;
  onColumbinaLanguageChange?: (lang: ColumbinaLanguage) => void;
}

export const EtherealDialogueBar: React.FC<EtherealDialogueBarProps> = ({
  lastSpokenText = '',
  isSpeaking = false,
  isGenerating,
  speechLanguage = 'en-US',
  currentLanguage = 'English',
  onSendMessage,
  onSendVoiceUtterance,
  onStopSpeaking,
  onLanguageChange,
  onColumbinaLanguageChange,
}) => {
  const [inputText, setInputText] = useState('');
  const [interimSpeech, setInterimSpeech] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isValidatingVoice, setIsValidatingVoice] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [isBarHidden, setIsBarHidden] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(true);
  const [selectedLang, setSelectedLang] = useState(speechLanguage || 'en-US');

  const recognitionRef = useRef<any>(null);
  const isMicActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const onStopSpeakingRef = useRef(onStopSpeaking);
  const onSendMessageRef = useRef(onSendMessage);
  const onSendVoiceUtteranceRef = useRef(onSendVoiceUtterance);
  const selectedLangRef = useRef(selectedLang);
  const lastSpokenTextRef = useRef(lastSpokenText);

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const lastProcessedTextRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);

  // Keep refs updated for event callbacks
  useEffect(() => {
    isMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    onStopSpeakingRef.current = onStopSpeaking;
  }, [onStopSpeaking]);

  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  }, [onSendMessage]);

  useEffect(() => {
    onSendVoiceUtteranceRef.current = onSendVoiceUtterance;
  }, [onSendVoiceUtterance]);

  useEffect(() => {
    selectedLangRef.current = selectedLang;
  }, [selectedLang]);

  useEffect(() => {
    lastSpokenTextRef.current = lastSpokenText;
  }, [lastSpokenText]);

  // Sync prop changes for language
  useEffect(() => {
    if (speechLanguage && speechLanguage !== selectedLang) {
      setSelectedLang(speechLanguage);
      selectedLangRef.current = speechLanguage;
      if (recognitionRef.current) {
        recognitionRef.current.lang = speechLanguage;
      }
    }
  }, [speechLanguage, selectedLang]);

  // Safe starter that guards against browser InvalidStateError
  const safeStartRecognition = useCallback(() => {
    if (!recognitionRef.current || !isMicActiveRef.current) return;
    if (isGeneratingRef.current || isSpeakingRef.current) return;

    try {
      recognitionRef.current.start();
    } catch (err: any) {
      if (err?.name !== 'InvalidStateError') {
        console.warn('SpeechRecognition start error:', err);
      }
    }
  }, []);

  // Safe stopper
  const safeStopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {}
  }, []);

  // Commit recognized speech turn to Columbina through Auto-Correction
  const commitUserUtterance = useCallback(
    (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || isGeneratingRef.current || isSpeakingRef.current) return;

      // 1. Noise handling: ignore pure fillers (Requirement 10)
      const fillerRegex = /^(uh+|um+|hm+|err+|ah+|huh+|shh+|mhm+|tsk+|oh+)$/i;
      const words = trimmed.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/);
      if (words.length === 1 && fillerRegex.test(words[0])) {
        accumulatedTranscriptRef.current = '';
        setInterimSpeech('');
        return;
      }

      // 2. Prevent Columbina from hearing her own voice (Requirement 16)
      if (lastSpokenTextRef.current) {
        const normSpoken = lastSpokenTextRef.current.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        const normIncoming = trimmed.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        if (
          normSpoken &&
          normIncoming &&
          normIncoming.length > 8 &&
          (normSpoken.includes(normIncoming) || normIncoming.includes(normSpoken))
        ) {
          accumulatedTranscriptRef.current = '';
          setInterimSpeech('');
          return;
        }
      }

      // 3. Turn management & deduplication within 4.5s (Requirement 8)
      const now = Date.now();
      const cleanCurrent = trimmed.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      const cleanLast = lastProcessedTextRef.current.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      if (
        cleanCurrent &&
        cleanLast &&
        (cleanCurrent === cleanLast ||
          (now - lastProcessedTimeRef.current < 2500 &&
            (cleanCurrent.includes(cleanLast) || cleanLast.includes(cleanCurrent)))) &&
        now - lastProcessedTimeRef.current < 4500
      ) {
        accumulatedTranscriptRef.current = '';
        setInterimSpeech('');
        return;
      }

      lastProcessedTextRef.current = trimmed;
      lastProcessedTimeRef.current = now;
      accumulatedTranscriptRef.current = '';
      setInterimSpeech('');
      setInputText('');

      // Temporarily pause recognition while Columbina processes turn
      safeStopRecognition();

      if (onSendVoiceUtteranceRef.current) {
        setIsValidatingVoice(true);
        onSendVoiceUtteranceRef.current(trimmed, selectedLangRef.current)
          .finally(() => setIsValidatingVoice(false));
      } else {
        onSendMessageRef.current(trimmed);
      }
    },
    [safeStopRecognition]
  );

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setHasSpeechSupport(false);
      return;
    }

    setHasSpeechSupport(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLangRef.current || 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setMicPermissionError(null);
    };

    recognition.onresult = (event: any) => {
      // Speech Interruption: If user starts speaking while Columbina is talking, stop TTS immediately
      if (isSpeakingRef.current) {
        onStopSpeakingRef.current?.();
      }

      let currentFinal = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = item[0]?.transcript || '';
        if (item.isFinal) {
          currentFinal += text + ' ';
        } else {
          currentInterim += text;
        }
      }

      if (currentFinal.trim()) {
        accumulatedTranscriptRef.current = (
          accumulatedTranscriptRef.current + ' ' + currentFinal
        ).trim();
      }

      const activeTotal = (
        accumulatedTranscriptRef.current + ' ' + currentInterim
      ).trim();

      if (activeTotal) {
        // Real-time preview without sending interim results to AI (Requirement 9)
        setInterimSpeech(activeTotal);

        // Turn Management: Natural silence detection debounce
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        silenceTimerRef.current = setTimeout(() => {
          commitUserUtterance(activeTotal);
        }, 1000);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicPermissionError(
          'Microphone permission was denied. Please allow microphone access in your browser settings to talk with Columbina.'
        );
        setIsMicActive(false);
        isMicActiveRef.current = false;
      }
      // Note: 'no-speech' or 'network' transient events do not permanently turn off the mic
    };

    recognition.onend = () => {
      // Auto-restart if continuous microphone is still active and Columbina is not speaking/thinking
      if (isMicActiveRef.current && !isGeneratingRef.current && !isSpeakingRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isMicActiveRef.current && !isGeneratingRef.current && !isSpeakingRef.current) {
            safeStartRecognition();
          }
        }, 150);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try {
        recognition.abort();
      } catch (e) {}
    };
  }, [commitUserUtterance, safeStartRecognition]);

  // Auto-resume continuous listening when Columbina finishes speaking (Requirement 15 & 16)
  useEffect(() => {
    if (isMicActive && !isSpeaking && !isGenerating) {
      const timer = setTimeout(() => {
        if (isMicActiveRef.current && !isSpeakingRef.current && !isGeneratingRef.current) {
          safeStartRecognition();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isMicActive, isSpeaking, isGenerating, safeStartRecognition]);

  // Microphone toggle button handler
  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!hasSpeechSupport) {
      setMicPermissionError(
        'Speech recognition is not supported in this browser. Please open the app in Chrome, Edge, or Safari.'
      );
      return;
    }

    if (isMicActive) {
      // User clicked microphone again: turn OFF completely
      setIsMicActive(false);
      isMicActiveRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      safeStopRecognition();
      setInterimSpeech('');
    } else {
      // User clicked microphone: turn ON continuously
      setMicPermissionError(null);
      setIsMicActive(true);
      isMicActiveRef.current = true;
      if (isSpeaking) {
        onStopSpeakingRef.current?.();
      }
      safeStartRecognition();
    }
  };

  // Text message submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = (interimSpeech || inputText).trim();
    if (!trimmed || isGenerating) return;

    if (isSpeaking) {
      onStopSpeakingRef.current?.();
    }

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    accumulatedTranscriptRef.current = '';
    setInterimSpeech('');

    safeStopRecognition();

    onSendMessage(trimmed);
    setInputText('');
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-x-0 bottom-6 z-30 flex flex-col items-center pointer-events-none px-4"
    >
      {/* Floating Capsule Input Bar */}
      {!isBarHidden ? (
        <div className="w-full max-w-md pointer-events-auto">
          {/* Permission Error Banner */}
          {micPermissionError && (
            <div className="mb-2 px-3 py-1.5 rounded-full bg-rose-950/85 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-[11px] leading-tight">{micPermissionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setMicPermissionError(null)}
                className="text-rose-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          <form
            onSubmit={handleFormSubmit}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-neutral-900/80 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/60 transition-all focus-within:border-purple-500/60 focus-within:ring-1 focus-within:ring-purple-500/40"
          >
            {/* Voice Input Button */}
            <button
              type="button"
              id="voice-mic-toggle-button"
              onClick={toggleListening}
              className={`p-2 rounded-full transition flex items-center justify-center relative ${
                !isMicActive
                  ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                  : isGenerating || isValidatingVoice
                  ? 'bg-purple-700/80 text-purple-200 border border-purple-400/50 animate-pulse shadow-md shadow-purple-900/40'
                  : isSpeaking
                  ? 'bg-purple-600 text-white animate-pulse ring-2 ring-purple-300 shadow-md shadow-purple-900/50'
                  : 'bg-emerald-600 text-white animate-pulse shadow-lg shadow-emerald-600/50 ring-2 ring-emerald-400/80'
              }`}
              title={
                !isMicActive
                  ? 'Microphone OFF. Click to start continuous voice conversation'
                  : isValidatingVoice
                  ? 'Understanding speech softly...'
                  : isGenerating
                  ? 'Columbina is thinking softly... (Continuous Mic Active)'
                  : isSpeaking
                  ? 'Columbina is speaking... (Click to interrupt / turn off)'
                  : 'Microphone LISTENING (Continuous). Speak naturally! Click to turn OFF'
              }
              aria-label={isMicActive ? 'Turn microphone off' : 'Turn microphone on'}
            >
              {!isMicActive ? (
                <Mic className="w-4 h-4" />
              ) : isGenerating || isValidatingVoice ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSpeaking ? (
                <Volume2 className="w-4 h-4 animate-pulse" />
              ) : (
                <>
                  <Mic className="w-4 h-4 text-white" />
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                  </span>
                </>
              )}
            </button>

            {/* Message Input */}
            <input
              type="text"
              id="ethereal-chat-input"
              value={interimSpeech || inputText}
              onChange={(e) => {
                if (interimSpeech) setInterimSpeech('');
                setInputText(e.target.value);
              }}
              placeholder={
                isValidatingVoice
                  ? 'Understanding speech softly...'
                  : !isMicActive
                  ? isGenerating
                    ? 'Columbina is thinking softly...'
                    : 'Speak or type a message to Columbina...'
                  : isGenerating
                  ? 'Columbina is thinking softly...'
                  : isSpeaking
                  ? 'Columbina is speaking softly... (type or speak to interrupt)'
                  : interimSpeech
                  ? interimSpeech
                  : 'Listening... speak naturally to Columbina (Mic is ON)'
              }
              disabled={isGenerating || isValidatingVoice}
              className="flex-1 bg-transparent border-none text-xs md:text-sm text-white placeholder-neutral-400 focus:outline-none px-1"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!inputText.trim() && !interimSpeech.trim()) || isGenerating}
              className={`p-2 rounded-full transition ${
                (inputText.trim() || interimSpeech.trim()) && !isGenerating
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/40'
                  : 'text-neutral-600 cursor-not-allowed'
              }`}
              title="Send"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>

            {/* Hide Bar Button */}
            <button
              type="button"
              onClick={() => setIsBarHidden(true)}
              className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded-full transition"
              title="Hide Bar"
              aria-label="Hide Bar"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        /* Minimized Moon Button */
        <button
          onClick={() => setIsBarHidden(false)}
          className="pointer-events-auto p-2.5 rounded-full bg-neutral-900/70 hover:bg-neutral-900 backdrop-blur-md border border-white/10 text-purple-300 hover:text-white shadow-lg transition flex items-center gap-1.5 text-xs font-medium"
          title="Speak to Columbina"
        >
          <Moon className="w-4 h-4 text-purple-400" />
          <span>{isMicActive ? 'Listening...' : 'Speak'}</span>
        </button>
      )}
    </div>
  );
};

