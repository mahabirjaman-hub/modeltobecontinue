import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Emotion } from '../types';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Maximize2,
  Minimize2,
  Trash2,
  Smile,
  Zap,
  Loader2,
} from 'lucide-react';

interface ChatOverlayProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  isSpeaking: boolean;
  currentEmotion: Emotion;
  autoSpeak: boolean;
  onSendMessage: (text: string) => void;
  onReplayAudio: (message: ChatMessage) => void;
  onToggleAutoSpeak: () => void;
  onClearChat: () => void;
  onTriggerEmotion: (emotion: Emotion) => void;
}

export const ChatOverlay: React.FC<ChatOverlayProps> = ({
  messages,
  isGenerating,
  isSpeaking,
  currentEmotion,
  autoSpeak,
  onSendMessage,
  onReplayAudio,
  onToggleAutoSpeak,
  onClearChat,
  onTriggerEmotion,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating, isMinimized]);

  const [interimSpeech, setInterimSpeech] = useState('');
  const [micError, setMicError] = useState<string | null>(null);

  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedRef = useRef('');

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  const safeStart = () => {
    if (!recognitionRef.current || !isListeningRef.current) return;
    if (isGeneratingRef.current || isSpeakingRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e: any) {
      if (e?.name !== 'InvalidStateError') console.warn(e);
    }
  };

  const safeStop = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {}
  };

  // Auto-resume when Columbina finishes speaking
  useEffect(() => {
    if (isListening && !isSpeaking && !isGenerating) {
      const timer = setTimeout(() => {
        if (isListeningRef.current && !isSpeakingRef.current && !isGeneratingRef.current) {
          safeStart();
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isListening, isSpeaking, isGenerating]);

  // Initialize SpeechRecognition if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
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
          accumulatedRef.current = (accumulatedRef.current + ' ' + currentFinal).trim();
        }

        const total = (accumulatedRef.current + ' ' + currentInterim).trim();
        if (total) {
          setInterimSpeech(total);

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (isGeneratingRef.current || isSpeakingRef.current) return;
            const toSend = total.trim();
            accumulatedRef.current = '';
            setInterimSpeech('');
            setInputText('');
            safeStop();
            onSendMessage(toSend);
          }, 950);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicError('Microphone permission denied.');
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current && !isGeneratingRef.current && !isSpeakingRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (isListeningRef.current && !isGeneratingRef.current && !isSpeakingRef.current) {
              safeStart();
            }
          }, 150);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [onSendMessage]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setMicError('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      isListeningRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      safeStop();
      setInterimSpeech('');
    } else {
      setMicError(null);
      setIsListening(true);
      isListeningRef.current = true;
      safeStart();
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = (interimSpeech || inputText).trim();
    if (!trimmed || isGenerating) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    accumulatedRef.current = '';
    setInterimSpeech('');

    safeStop();

    onSendMessage(trimmed);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Emotion tag icons/labels
  const emotionConfig: Record<Emotion, { label: string; color: string; badgeBg: string }> = {
    gentle: { label: 'Gentle 🕊️', color: 'text-teal-200', badgeBg: 'bg-teal-500/20 border-teal-500/30' },
    friendly: { label: 'Friendly 🌸', color: 'text-emerald-300', badgeBg: 'bg-emerald-500/20 border-emerald-500/30' },
    professional: { label: 'Poised 🌙', color: 'text-slate-300', badgeBg: 'bg-slate-500/20 border-slate-500/30' },
    serious: { label: 'Serious ⚖️', color: 'text-sky-300', badgeBg: 'bg-sky-500/20 border-sky-500/30' },
    cheerful: { label: 'Cheerful ☀️', color: 'text-amber-300', badgeBg: 'bg-amber-500/20 border-amber-500/30' },
    enthusiastic: { label: 'Enthusiastic ✨', color: 'text-yellow-300', badgeBg: 'bg-yellow-500/20 border-yellow-500/30' },
    confident: { label: 'Confident 💫', color: 'text-cyan-300', badgeBg: 'bg-cyan-500/20 border-cyan-500/30' },
    authoritative: { label: 'Divine Authority 👑', color: 'text-purple-300', badgeBg: 'bg-purple-500/20 border-purple-500/30' },
    empathetic: { label: 'Empathetic 💙', color: 'text-indigo-300', badgeBg: 'bg-indigo-500/20 border-indigo-500/30' },
    playful: { label: 'Playful 🌸', color: 'text-fuchsia-300', badgeBg: 'bg-fuchsia-500/20 border-fuchsia-500/30' },
    dramatic: { label: 'Dramatic 🎭', color: 'text-violet-300', badgeBg: 'bg-violet-500/20 border-violet-500/30' },
    intimate: { label: 'Intimate 🕯️', color: 'text-rose-200', badgeBg: 'bg-rose-500/20 border-rose-500/30' },
    mysterious: { label: 'Mysterious 🔮', color: 'text-purple-200', badgeBg: 'bg-purple-600/20 border-purple-500/30' },
    sad: { label: 'Melancholy 🥺', color: 'text-blue-400', badgeBg: 'bg-blue-500/20 border-blue-500/30' },
    angry: { label: 'Fierce 😤', color: 'text-rose-400', badgeBg: 'bg-rose-500/20 border-rose-500/30' },
    sexy: { label: 'Alluring 🌹', color: 'text-pink-300', badgeBg: 'bg-pink-500/20 border-pink-500/30' },
    happy: { label: 'Joyful 😊', color: 'text-amber-400', badgeBg: 'bg-amber-500/20 border-amber-500/30' },
    excited: { label: 'Excited ✨', color: 'text-yellow-300', badgeBg: 'bg-yellow-500/20 border-yellow-500/30' },
    surprised: { label: 'Surprised 😲', color: 'text-cyan-400', badgeBg: 'bg-cyan-500/20 border-cyan-500/30' },
    thinking: { label: 'Thinking 🤔', color: 'text-purple-400', badgeBg: 'bg-purple-500/20 border-purple-500/30' },
    relaxed: { label: 'Relaxed 😌', color: 'text-emerald-400', badgeBg: 'bg-emerald-500/20 border-emerald-500/30' },
    calm: { label: 'Calm 🕊️', color: 'text-teal-300', badgeBg: 'bg-teal-500/20 border-teal-500/30' },
    shy: { label: 'Shy 😳', color: 'text-rose-300', badgeBg: 'bg-rose-500/20 border-rose-500/30' },
    curious: { label: 'Curious 🧐', color: 'text-indigo-300', badgeBg: 'bg-indigo-500/20 border-indigo-500/30' },
    sleepy: { label: 'Sleepy 💤', color: 'text-violet-300', badgeBg: 'bg-violet-500/20 border-violet-500/30' },
    worried: { label: 'Worried 💭', color: 'text-sky-300', badgeBg: 'bg-sky-500/20 border-sky-500/30' },
    wink: { label: 'Playful 😉', color: 'text-pink-400', badgeBg: 'bg-pink-500/20 border-pink-500/30' },
    neutral: { label: 'Serene ✨', color: 'text-neutral-300', badgeBg: 'bg-neutral-800 border-white/10' },
  };

  const suggestions = [
    'Tell me about your 3D world!',
    'Can you give me a burst of motivation?',
    'What are your favorite futuristic concepts?',
    'Tell me a witty joke',
  ];

  return (
    <div
      id="chat-overlay-panel"
      className={`fixed right-4 md:right-6 bottom-4 md:bottom-6 z-30 transition-all duration-300 flex flex-col ${
        isMinimized
          ? 'w-72 md:w-80 h-14'
          : 'w-[calc(100vw-2rem)] sm:w-[420px] md:w-[450px] h-[520px] max-h-[82vh]'
      } rounded-2xl bg-neutral-900/85 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-950/40">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            {isSpeaking && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white tracking-tight">AI Assistant</h2>
              {/* Active emotion badge */}
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  emotionConfig[currentEmotion]?.badgeBg || 'bg-neutral-800'
                } ${emotionConfig[currentEmotion]?.color || 'text-white'}`}
              >
                {emotionConfig[currentEmotion]?.label || currentEmotion}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {isSpeaking ? 'Speaking & lip-syncing...' : isGenerating ? 'Formulating response...' : 'Online & listening'}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          <button
            id="toggle-autospeak-btn"
            onClick={onToggleAutoSpeak}
            title={autoSpeak ? 'Voice output enabled (Click to mute)' : 'Voice output muted (Click to enable)'}
            aria-label="Toggle voice output"
            className={`p-1.5 rounded-lg transition ${
              autoSpeak ? 'text-purple-400 hover:bg-purple-500/20' : 'text-neutral-500 hover:bg-white/5'
            }`}
          >
            {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {!isMinimized && (
            <button
              id="clear-chat-btn"
              onClick={onClearChat}
              title="Clear conversation"
              aria-label="Clear conversation"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-white/5 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            id="minimize-chat-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand chat' : 'Minimize chat'}
            aria-label={isMinimized ? 'Expand chat' : 'Minimize chat'}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-xs shadow-md shadow-purple-900/20'
                      : 'bg-neutral-800/90 text-neutral-100 border border-white/10 rounded-bl-xs shadow-lg'
                  }`}
                >
                  {/* Emotion tag badge on assistant messages */}
                  {msg.role === 'assistant' && msg.emotion && (
                    <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-white/10">
                      <span
                        className={`text-[10px] font-medium font-mono px-1.5 py-0.2 rounded ${
                          emotionConfig[msg.emotion]?.badgeBg
                        } ${emotionConfig[msg.emotion]?.color}`}
                      >
                        {emotionConfig[msg.emotion]?.label}
                      </span>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap leading-relaxed select-text">
                    {msg.cleanText || msg.content}
                  </p>

                  {/* Replay voice button for assistant messages */}
                  {msg.role === 'assistant' && (
                    <div className="mt-2 pt-1.5 flex items-center justify-between border-t border-white/5 text-[11px] text-neutral-400">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button
                        onClick={() => onReplayAudio(msg)}
                        className="flex items-center gap-1 text-purple-300 hover:text-purple-200 transition py-0.5 px-1.5 rounded hover:bg-white/5"
                        title="Replay Voice & Lip-Sync"
                      >
                        <Volume2 className="w-3 h-3" />
                        Replay
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex items-start">
                <div className="rounded-2xl px-4 py-3 bg-neutral-800/90 border border-white/10 text-neutral-300 text-xs flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>Assistant is thinking & preparing expression...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          {messages.length <= 3 && (
            <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(item)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white/5 hover:bg-purple-500/20 hover:border-purple-500/30 border border-white/10 text-[11px] text-neutral-300 hover:text-white transition"
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {/* Input Form Area */}
          <div className="p-3 border-t border-white/10 bg-neutral-950/50">
            <form onSubmit={handleSend} className="relative flex items-end gap-2">
              <div className="relative flex-1 rounded-xl bg-neutral-900 border border-white/15 focus-within:border-purple-500 transition">
                <textarea
                  id="chat-input-textarea"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? 'Listening to your voice...' : 'Type a message to your 3D assistant...'}
                  rows={1}
                  className="w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none resize-none max-h-24 scrollbar-none"
                />

                {isListening && (
                  <div className="absolute right-2 bottom-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-mono animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    LIVE
                  </div>
                )}
              </div>

              {/* Voice input mic button */}
              <button
                type="button"
                id="voice-input-button"
                onClick={toggleListening}
                title={isListening ? 'Stop listening' : 'Speak into microphone'}
                aria-label="Toggle voice recording"
                className={`p-2.5 rounded-xl border transition flex items-center justify-center ${
                  isListening
                    ? 'bg-rose-600 border-rose-500 text-white animate-pulse shadow-lg shadow-rose-900/40'
                    : 'bg-neutral-800 border-white/10 text-neutral-300 hover:text-white hover:bg-neutral-700'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Send button */}
              <button
                type="submit"
                id="send-message-button"
                disabled={!inputText.trim() || isGenerating}
                title="Send Message"
                aria-label="Send Message"
                className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white transition flex items-center justify-center shadow-md shadow-purple-900/30"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
