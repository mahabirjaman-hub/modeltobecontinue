/**
 * Audio Service for Text-to-Speech, Speech Recognition, and Sound FX
 */

class AudioService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  // Get available browser speech synthesis voices
  public getVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve([]);
        return;
      }

      const voices = this.synth.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }

      const onVoicesChanged = () => {
        this.synth?.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(this.synth?.getVoices() || []);
      };
      this.synth.addEventListener('voiceschanged', onVoicesChanged);

      // Fallback timeout in case voiceschanged never fires
      setTimeout(() => {
        resolve(this.synth?.getVoices() || []);
      }, 500);
    });
  }

  // Find the most delicate, young feminine, ethereal voice available in the client system
  public findEtherealVoice(
    voices: SpeechSynthesisVoice[],
    targetLang?: string
  ): SpeechSynthesisVoice | undefined {
    if (!voices || voices.length === 0) return undefined;

    const langPrefix = targetLang ? targetLang.toLowerCase().slice(0, 2) : 'en';

    // 1. If non-English language requested (Hindi, Bengali, Japanese)
    if (langPrefix === 'hi') {
      const hiFemale = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('hi') &&
          (v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('lekha') ||
            v.name.toLowerCase().includes('swara') ||
            v.name.toLowerCase().includes('kalpana') ||
            !v.name.toLowerCase().includes('male'))
      );
      if (hiFemale) return hiFemale;
      const anyHi = voices.find((v) => v.lang.toLowerCase().startsWith('hi'));
      if (anyHi) return anyHi;
    } else if (langPrefix === 'bn') {
      const bnFemale = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('bn') &&
          (v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('bashkar') === false)
      );
      if (bnFemale) return bnFemale;
      const anyBn = voices.find((v) => v.lang.toLowerCase().startsWith('bn'));
      if (anyBn) return anyBn;
    } else if (langPrefix === 'ja') {
      const jaFemale = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('ja') &&
          (v.name.toLowerCase().includes('kyoko') ||
            v.name.toLowerCase().includes('nanami') ||
            v.name.toLowerCase().includes('haruka') ||
            v.name.toLowerCase().includes('sayaka') ||
            v.name.toLowerCase().includes('female') ||
            !v.name.toLowerCase().includes('male'))
      );
      if (jaFemale) return jaFemale;
      const anyJa = voices.find((v) => v.lang.toLowerCase().startsWith('ja'));
      if (anyJa) return anyJa;
    }

    // 2. Natural or Neural feminine English voices
    const naturalKeywords = [
      'natural',
      'neural',
      'online (natural)',
      'jenny',
      'aria',
      'sonia',
      'maisie',
      'libby',
      'serena',
      'victoria',
    ];
    for (const kw of naturalKeywords) {
      const match = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          v.name.toLowerCase().includes(kw) &&
          !v.name.toLowerCase().includes('male')
      );
      if (match) return match;
    }

    // 3. High-quality delicate Google & Apple voices
    const preferredNames = [
      'google uk english female',
      'google us english',
      'samantha',
      'karen',
      'tessa',
      'fiona',
      'moana',
      'zira',
    ];
    for (const name of preferredNames) {
      const match = voices.find(
        (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes(name)
      );
      if (match) return match;
    }

    // 4. Any English female voice
    const femaleEn = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('woman') ||
          v.name.toLowerCase().includes('girl'))
    );
    if (femaleEn) return femaleEn;

    // 5. Default to any English voice or first available
    return voices.find((v) => v.lang.startsWith('en')) || voices[0];
  }

  // Speak using Web Speech API with real-time progress callbacks
  public speak(
    text: string,
    options: {
      voiceURI?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      lang?: string;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    } = {}
  ): void {
    if (!this.synth) {
      options.onError?.(new Error('SpeechSynthesis not available'));
      return;
    }

    this.stop();

    // Clean text: strip emotion brackets, stage directions (e.g. *soft breath*), and markdown
    const cleanedText = text
      .replace(/^\[(happy|neutral|surprised|thinking|relaxed|sad|angry|wink)\]\s*/gi, '')
      .replace(/\*[^*]+\*/g, ' ') // Strip stage directions like *soft breath*
      .replace(/[*_#`~[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedText) return;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    if (options.lang) {
      utterance.lang = options.lang;
    }
    // Delicate, high-to-medium pitch (1.10) and relaxed dreamlike pacing (0.88)
    utterance.rate = options.rate !== undefined ? options.rate : 0.88;
    utterance.pitch = options.pitch !== undefined ? options.pitch : 1.10;
    utterance.volume = options.volume !== undefined ? options.volume : 0.85;

    // Pick voice if provided, otherwise pick best delicate ethereal voice for target language
    const voices = this.synth.getVoices();
    if (options.voiceURI) {
      const match = voices.find((v) => v.voiceURI === options.voiceURI);
      if (match) {
        utterance.voice = match;
      } else {
        const preferred = this.findEtherealVoice(voices, options.lang);
        if (preferred) utterance.voice = preferred;
      }
    } else {
      const preferred = this.findEtherealVoice(voices, options.lang);
      if (preferred) utterance.voice = preferred;
    }

    utterance.onstart = () => {
      options.onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      options.onError?.(e);
      options.onEnd?.();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  // Play audio buffer from Gemini TTS API with frequency analyser and head-resonance acoustic filtering
  public async playGeminiAudio(
    base64Data: string,
    sampleRate: number = 24000,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<AnalyserNode | null> {
    try {
      this.stop();

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit PCM little endian into AudioBuffer
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = this.audioContext.createBuffer(1, float32.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32);

      // Acoustic Filter Chain for delicate, airy, head-focused resonance:
      // High-pass filter at 130Hz to soften chest weight
      const highPass = this.audioContext.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.setValueAtTime(130, this.audioContext.currentTime);

      // High-shelf filter at 7500Hz (+2.2dB) for gentle breathy silkiness
      const highShelf = this.audioContext.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.setValueAtTime(7500, this.audioContext.currentTime);
      highShelf.gain.setValueAtTime(2.2, this.audioContext.currentTime);

      // Create AnalyserNode
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect: source -> highPass -> highShelf -> analyser -> destination
      source.connect(highPass);
      highPass.connect(highShelf);
      highShelf.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      source.onended = () => {
        this.currentAudioSource = null;
        onEnd?.();
      };

      this.currentAudioSource = source;
      source.start();
      onStart?.();

      return this.analyser;
    } catch (err) {
      console.error('Failed to play Gemini audio:', err);
      onEnd?.();
      return null;
    }
  }

  // Synthesize and play speech via Fish Audio TTS API (s2.1-pro-free model)
  public async speakFishAudio(
    text: string,
    options: {
      referenceId?: string;
      expression?: string;
      voiceDirection?: string;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    } = {}
  ): Promise<AnalyserNode | null> {
    try {
      const response = await fetch('/api/tts/fish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          reference_id: options.referenceId || 'f2aed07c91614db28daaaa849150cc6e',
          expression: options.expression,
          voice_direction: options.voiceDirection,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson.error || `HTTP error ${response.status}`;
        options.onError?.(new Error(msg));
        return null;
      }

      const data = await response.json().catch(() => ({}));
      if (data.fallback || !data.audio) {
        // Graceful fallback to browser speech synthesis
        options.onError?.(new Error(data.message || 'Fish Audio unavailable'));
        return null;
      }

      return await this.playMp3Audio(data.audio, options.onStart, options.onEnd);
    } catch (err) {
      options.onError?.(err);
      return null;
    }
  }

  // Synthesize and play speech via Gemini Neural TTS API
  public async speakGeminiTTS(
    text: string,
    options: {
      voice?: string;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    } = {}
  ): Promise<AnalyserNode | null> {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: options.voice || 'Aoede',
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      if (!data.audio) {
        throw new Error('No audio returned from Gemini TTS API');
      }

      return await this.playGeminiAudio(
        data.audio,
        data.sampleRate || 24000,
        options.onStart,
        options.onEnd
      );
    } catch (err: any) {
      options.onError?.(err);
      return null;
    }
  }

  // Play MP3 audio buffer from Fish Audio API with AnalyserNode for lip-sync
  public async playMp3Audio(
    base64Data: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<AnalyserNode | null> {
    try {
      this.stop();

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // decodeAudioData handles MP3 audio data natively
      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer.slice(0));

      // Create AnalyserNode for real-time lip-sync and audio visualizer
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      source.onended = () => {
        this.currentAudioSource = null;
        onEnd?.();
      };

      this.currentAudioSource = source;
      source.start();
      onStart?.();

      return this.analyser;
    } catch (err) {
      console.error('Failed to play MP3 audio:', err);
      onEnd?.();
      return null;
    }
  }

  public getAudioContext(): AudioContext {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.audioContext) {
      this.audioContext = new AudioContextClass();
    }
    return this.audioContext;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public stop(): void {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch (e) {}
      this.currentAudioSource = null;
    }
    this.currentUtterance = null;
  }

  // Simple Web Audio sound synthesizer for interface cues
  public playChime(type: 'send' | 'receive' | 'click' | 'emotion'): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      if (type === 'send') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'receive') {
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'emotion') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.18);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else {
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (e) {
      // AudioContext may be blocked before first user gesture
    }
  }
}

export const audioService = new AudioService();
