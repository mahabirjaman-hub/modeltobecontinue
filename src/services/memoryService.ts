/**
 * Memory Service for Character AI Brain
 * Handles short-term context and long-term user memory.
 * Designed with a clean interface so Firebase / Cloud DB persistence
 * can be plugged in seamlessly.
 */

import { CharacterMemory } from '../types';

const STORAGE_KEY = 'vrm_character_memory_columbina_v1';

const DEFAULT_MEMORY: CharacterMemory = {
  userPreferences: [
    'Enjoys gentle, quiet, and meaningful conversations',
  ],
  importantFacts: [],
  relationshipContext: [
    'Speaks with Columbina Hyposelenia (Kuutar, formerly The Damselette, Third of the Fatui Harbingers; now Moon Maiden / Trilune Goddess of Silvermoon Hall, Hiisi Island, Nod-Krai)',
    'Columbina is gradually getting to know the user as a trusted companion, curious about ordinary life and genuine friendship',
  ],
  conversationSummary: '',
};

export class MemoryService {
  private memory: CharacterMemory;

  constructor() {
    this.memory = this.load();
  }

  public load(): CharacterMemory {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          userPreferences: Array.isArray(parsed.userPreferences) ? parsed.userPreferences : [],
          importantFacts: Array.isArray(parsed.importantFacts) ? parsed.importantFacts : [],
          relationshipContext: Array.isArray(parsed.relationshipContext) ? parsed.relationshipContext : [],
          conversationSummary: typeof parsed.conversationSummary === 'string' ? parsed.conversationSummary : '',
        };
      }
    } catch (e) {
      console.warn('Failed to load character memory from storage:', e);
    }
    return { ...DEFAULT_MEMORY };
  }

  public save(memory: CharacterMemory): void {
    this.memory = memory;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch (e) {
      console.warn('Failed to persist character memory:', e);
    }
  }

  public getMemory(): CharacterMemory {
    return { ...this.memory };
  }

  public addPreference(preference: string): void {
    const trimmed = preference.trim();
    if (trimmed && !this.memory.userPreferences.includes(trimmed)) {
      this.memory.userPreferences.push(trimmed);
      this.save(this.memory);
    }
  }

  public addFact(fact: string): void {
    const trimmed = fact.trim();
    if (trimmed && !this.memory.importantFacts.includes(trimmed)) {
      this.memory.importantFacts.push(trimmed);
      this.save(this.memory);
    }
  }

  public addRelationshipNote(note: string): void {
    const trimmed = note.trim();
    if (trimmed && !this.memory.relationshipContext.includes(trimmed)) {
      this.memory.relationshipContext.push(trimmed);
      this.save(this.memory);
    }
  }

  public updateSummary(summary: string): void {
    this.memory.conversationSummary = summary.trim();
    this.save(this.memory);
  }

  public clear(): void {
    this.memory = { ...DEFAULT_MEMORY };
    this.save(this.memory);
  }

  public clearMemory(): void {
    this.clear();
  }
}

export const memoryService = new MemoryService();
