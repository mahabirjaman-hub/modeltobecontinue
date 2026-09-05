/**
 * Voice Analysis & Paralinguistic Understanding Service
 * Analyzes both acoustic signals (RMS, pitch, rate, shakiness, pauses, loudness)
 * and vocal expressions (hmm, hmph, uh, sigh, laughter, crying, whispering)
 * to provide a comprehensive paralinguistic understanding layer.
 */

import { ParalinguisticAnalysis, VoiceEmotionSignal } from '../types';

interface AudioMetricsSample {
  rms: number;
  pitchProxy: number;
  spectralCentroid: number;
  time: number;
}

export class VoiceAnalysisService {
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private samples: AudioMetricsSample[] = [];
  private isSampling = false;
  private sampleIntervalId: number | null = null;
  private utteranceStartTime = 0;
  private pauseCount = 0;
  private inPauseState = false;
  private pauseThresholdRms = 0.012;

  // Start real-time acoustic sampling for an active speech utterance
  public startUtteranceSampling(
    stream: MediaStream,
    audioContext: AudioContext
  ): void {
    try {
      this.micStream = stream;
      this.samples = [];
      this.pauseCount = 0;
      this.inPauseState = false;
      this.utteranceStartTime = performance.now();
      this.isSampling = true;

      if (!this.analyserNode) {
        this.analyserNode = audioContext.createAnalyser();
        this.analyserNode.fftSize = 512;
        this.analyserNode.smoothingTimeConstant = 0.3;
      }

      if (!this.micSourceNode) {
        this.micSourceNode = audioContext.createMediaStreamSource(stream);
        this.micSourceNode.connect(this.analyserNode);
      }

      if (this.sampleIntervalId !== null) {
        window.clearInterval(this.sampleIntervalId);
      }

      const timeDomain = new Uint8Array(this.analyserNode.fftSize);
      const freqData = new Uint8Array(this.analyserNode.frequencyBinCount);

      this.sampleIntervalId = window.setInterval(() => {
        if (!this.isSampling || !this.analyserNode) return;

        // 1. RMS Amplitude from Time Domain
        this.analyserNode.getByteTimeDomainData(timeDomain);
        let sumSquares = 0;
        let zeroCrossings = 0;
        const len = timeDomain.length;
        for (let i = 0; i < len; i++) {
          const norm = (timeDomain[i] - 128) / 128.0;
          sumSquares += norm * norm;
          if (i > 0 && ((timeDomain[i] >= 128 && timeDomain[i - 1] < 128) || (timeDomain[i] < 128 && timeDomain[i - 1] >= 128))) {
            zeroCrossings++;
          }
        }
        const rms = Math.sqrt(sumSquares / len);

        // 2. Spectral Centroid from Frequency Domain
        this.analyserNode.getByteFrequencyData(freqData);
        let weightedSum = 0;
        let totalAmp = 0;
        const binCount = freqData.length;
        for (let i = 0; i < binCount; i++) {
          const amp = freqData[i];
          weightedSum += i * amp;
          totalAmp += amp;
        }
        const spectralCentroid = totalAmp > 0 ? weightedSum / totalAmp : 0;
        const pitchProxy = zeroCrossings;

        // 3. Pause Tracker (dips below pauseThreshold while speaking)
        if (rms < this.pauseThresholdRms) {
          if (!this.inPauseState) {
            this.inPauseState = true;
            this.pauseCount++;
          }
        } else {
          this.inPauseState = false;
        }

        this.samples.push({
          rms,
          pitchProxy,
          spectralCentroid,
          time: performance.now(),
        });

        // Limit memory buffer (keep last 300 samples ~ 6 seconds)
        if (this.samples.length > 300) {
          this.samples.shift();
        }
      }, 20); // 50 Hz sampling rate
    } catch (e) {
      console.warn('VoiceAnalysisService: Unable to initialize acoustic stream:', e);
    }
  }

  // Stop sampling when utterance concludes
  public stopUtteranceSampling(): void {
    this.isSampling = false;
    if (this.sampleIntervalId !== null) {
      window.clearInterval(this.sampleIntervalId);
      this.sampleIntervalId = null;
    }
  }

  // Analyze the utterance combining acoustic signals with textual and paralinguistic patterns
  public analyzeUtterance(rawTranscript: string): ParalinguisticAnalysis {
    this.stopUtteranceSampling();

    const text = (rawTranscript || '').trim();
    const lower = text.toLowerCase();
    const durationSec = Math.max(0.3, (performance.now() - this.utteranceStartTime) / 1000);

    // --- 1. Compute Acoustic Metrics from Samples ---
    let avgRms = 0;
    let maxRms = 0;
    let pitchVariance = 0;
    let avgCentroid = 0;

    if (this.samples.length > 3) {
      let sumRms = 0;
      let sumPitch = 0;
      let sumCentroid = 0;

      for (const s of this.samples) {
        sumRms += s.rms;
        if (s.rms > maxRms) maxRms = s.rms;
        sumPitch += s.pitchProxy;
        sumCentroid += s.spectralCentroid;
      }
      avgRms = sumRms / this.samples.length;
      const avgPitch = sumPitch / this.samples.length;
      avgCentroid = sumCentroid / this.samples.length;

      // Variance in pitch proxy for trembling/shakiness detection
      let sqDiff = 0;
      for (const s of this.samples) {
        sqDiff += Math.pow(s.pitchProxy - avgPitch, 2);
      }
      pitchVariance = Math.sqrt(sqDiff / this.samples.length);
    }

    // --- 2. Determine Vocal Sounds & Expressions ---
    let vocalSound: ParalinguisticAnalysis['vocalSound'] = 'none';
    let tone = 'neutral';
    let primaryEmotion: VoiceEmotionSignal['primary'] = 'neutral';
    let confidence = 0.70;
    let intensity = 0.35;
    let isShaky = false;
    let contextInterpretation = '';

    // Check textual and phonetic patterns
    const isLaughter =
      /\b(ha(ha)+|he(he)+|lol|lmao|giggle|chuckle)\b/i.test(lower) ||
      /\*laughs?\*/i.test(lower) ||
      /\bhaha\b/i.test(lower);

    const isHmm =
      /^(h+m+|m+h+m+|m+m+)\b/i.test(lower) ||
      /\bh+m+\.{2,}/i.test(lower) ||
      /\b(hmmm|hmm|mmm|mm-hmm)\b/i.test(lower);

    const isHmph =
      /^(h+m+p+h*|h+m+p)\b/i.test(lower) ||
      /\b(hmph|hmp|tch)\b/i.test(lower);

    const isHesitation =
      /^(u+h+|u+m+|e+r+r*)\b/i.test(lower) ||
      /\b(uh|um|err|uhh|umm)\b/i.test(lower) ||
      /\.\.\./.test(text);

    const isSigh =
      /\*sigh\*/i.test(lower) ||
      /\b(sigh|sighs|haaa+h|phew)\b/i.test(lower);

    const isCrying =
      /\b(cry|crying|sob|sobbing|sniffle|sniffling|tears?)\b/i.test(lower) ||
      /\*cries\*|\*sobs\*/i.test(lower);

    const isWhisperWord = /\b(whisper|whispering)\b/i.test(lower) || /\*whispers?\*/i.test(lower);

    // --- 3. Evaluate Loudness & Acoustic Features ---
    let loudness: ParalinguisticAnalysis['loudness'] = 'normal';
    if (avgRms < 0.025 || isWhisperWord) {
      loudness = 'whisper';
    } else if (avgRms < 0.055) {
      loudness = 'quiet';
    } else if (avgRms > 0.35 || maxRms > 0.65 || /\b(ahhh!|nooo!|stop!)\b/i.test(lower)) {
      loudness = 'shout';
    } else if (avgRms > 0.20 || maxRms > 0.45) {
      loudness = 'loud';
    }

    // Speaking speed
    const wordsCount = text.split(/\s+/).filter(Boolean).length;
    const wordsPerSec = durationSec > 0 ? wordsCount / durationSec : 2.0;
    let speakingSpeed: ParalinguisticAnalysis['speakingSpeed'] = 'normal';
    if (wordsPerSec > 3.4) {
      speakingSpeed = 'fast';
    } else if (wordsPerSec < 1.4 && wordsCount > 1) {
      speakingSpeed = 'slow';
    }

    // Pitch evaluation
    let pitch: ParalinguisticAnalysis['pitch'] = 'normal';
    if (avgCentroid > 70) {
      pitch = 'high';
    } else if (avgCentroid < 28 && avgCentroid > 0) {
      pitch = 'low';
    }

    // Shakiness / Trembling
    if (pitchVariance > 8.5 || isCrying) {
      isShaky = true;
    }

    // --- 4. Synthesis of Paralinguistic Tone & Emotion ---
    if (isLaughter) {
      vocalSound = 'laugh';
      tone = 'cheerful_playful';
      primaryEmotion = 'cheerful';
      confidence = 0.88;
      intensity = 0.65;
      contextInterpretation = 'The user is laughing with genuine amusement or playful joy.';
    } else if (isHmm) {
      vocalSound = 'hmm';
      tone = 'thinking_uncertain';
      primaryEmotion = 'hesitant';
      confidence = 0.82;
      intensity = 0.40;
      contextInterpretation = 'The user is contemplating, hesitant, wondering, or unsure of what to say.';
    } else if (isHmph) {
      vocalSound = 'hmph';
      tone = 'playful_annoyance';
      primaryEmotion = 'playful';
      confidence = 0.84;
      intensity = 0.50;
      contextInterpretation = 'The user expressed a hmph sound, showing playful rejection, mild teasing, or coy annoyance.';
    } else if (isSigh) {
      vocalSound = 'sigh';
      tone = 'weary_sigh';
      primaryEmotion = 'sad';
      confidence = 0.80;
      intensity = 0.45;
      contextInterpretation = 'The user sighed, indicating fatigue, relief, or quiet heaviness.';
    } else if (isCrying || (isShaky && loudness === 'quiet')) {
      vocalSound = 'cry';
      tone = 'distressed_shaky';
      primaryEmotion = 'sad';
      isShaky = true;
      confidence = 0.78;
      intensity = 0.70;
      contextInterpretation = 'The user sounds emotionally troubled, tearful, or speaking with a shaky voice.';
    } else if (loudness === 'whisper') {
      vocalSound = 'whisper';
      tone = 'quiet_whisper';
      primaryEmotion = 'intimate';
      confidence = 0.75;
      intensity = 0.30;
      contextInterpretation = 'The user is whispering softly or speaking very quietly.';
    } else if (loudness === 'shout') {
      vocalSound = 'shout';
      tone = 'high_intensity';
      primaryEmotion = 'angry';
      confidence = 0.65;
      intensity = 0.80;
      contextInterpretation = 'The user spoke with heightened acoustic intensity or loud projection.';
    } else if (isHesitation || this.pauseCount > 2 || speakingSpeed === 'slow') {
      vocalSound = 'hesitation';
      tone = 'hesitant_slow';
      primaryEmotion = 'hesitant';
      confidence = 0.75;
      intensity = 0.35;
      contextInterpretation = 'The user is hesitating or pausing frequently while formulating their thoughts.';
    } else {
      // General lexical sentiment fallback
      if (/\b(happy|yay|great|awesome|love|wonderful|fantastic|beautiful)\b/i.test(lower)) {
        tone = 'bright';
        primaryEmotion = 'cheerful';
        confidence = 0.72;
        intensity = 0.55;
      } else if (/\b(sad|depressed|tired|lonely|hurt|unhappy|broken)\b/i.test(lower)) {
        tone = 'somber';
        primaryEmotion = 'sad';
        confidence = 0.75;
        intensity = 0.55;
      } else if (/\b(angry|furious|mad|annoyed|hate|stupid)\b/i.test(lower)) {
        tone = 'irritated';
        primaryEmotion = 'angry';
        confidence = 0.70;
        intensity = 0.60;
      } else if (/\b(why|how|what|curious|wonder|really\?)\b/i.test(lower)) {
        tone = 'curious';
        primaryEmotion = 'curious';
        confidence = 0.70;
        intensity = 0.40;
      } else {
        tone = 'calm_neutral';
        primaryEmotion = 'calm';
        confidence = 0.60;
        intensity = 0.30;
      }
    }

    // Context Mismatch Detection (e.g. user words say "I am fine" / "I'm okay" but shaky / sad / quiet tone)
    if (
      /\b(i('?m| am) (fine|okay|ok|good|alright))\b/i.test(lower) &&
      (isShaky || loudness === 'whisper' || primaryEmotion === 'sad' || isHesitation || this.pauseCount >= 2)
    ) {
      primaryEmotion = 'sad';
      confidence = 0.82;
      intensity = 0.55;
      tone = 'hesitant_troubled_contrast';
      contextInterpretation =
        'Emotional contrast detected: User verbally says they are fine/okay, but vocal tone is quiet, hesitant, or shaky. Respond with gentle care without diagnosing.';
    }

    // Cleaned transcript preserves content while stripping extraneous non-verbal tags for TTS
    const cleanedTranscript = text
      .replace(/\*(sigh|whisper|cry|laugh|sob|giggle)[s]*\*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      rawTranscript: text,
      cleanedTranscript: cleanedTranscript || text,
      vocalSound,
      tone,
      pitch,
      speakingSpeed,
      loudness,
      pauses: this.pauseCount,
      isShaky,
      voiceEmotion: {
        primary: primaryEmotion,
        confidence,
        intensity,
      },
      contextInterpretation,
    };
  }

  // Clean up any mic source nodes on disconnect
  public cleanup(): void {
    this.stopUtteranceSampling();
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch (e) {}
      this.micSourceNode = null;
    }
    this.analyserNode = null;
    this.micStream = null;
  }
}

export const voiceAnalysisService = new VoiceAnalysisService();
