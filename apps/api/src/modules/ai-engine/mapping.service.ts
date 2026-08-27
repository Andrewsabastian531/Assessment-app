import { Injectable, Logger } from '@nestjs/common';
import { MAPPING_CONFIDENCE_THRESHOLD } from '@vedaai/shared';
import { AiEngineService } from './ai-engine.service';

export interface MappableQuestion {
  id: string;
  label: string;
  text: string;
}

export interface MappableRegion {
  id: string;
  transcript: string;
  questionLabelHint: string | null;
  isPrintedLabel: boolean;
}

export interface RegionMatch {
  regionId: string;
  questionId: string | null;
  confidence: number;
  strategy: 'label' | 'embedding' | 'lexical' | 'unmatched';
}

/** Pairs student answer regions with the questions they answer. */
@Injectable()
export class MappingService {
  private readonly logger = new Logger(MappingService.name);

  constructor(private readonly ai: AiEngineService) {}

  async match(questions: MappableQuestion[], regions: MappableRegion[]): Promise<RegionMatch[]> {
    const answerRegions = regions.filter((region) => !region.isPrintedLabel);
    if (questions.length === 0 || answerRegions.length === 0) {
      return regions.map((region) => ({
        regionId: region.id,
        questionId: null,
        confidence: 0,
        strategy: 'unmatched' as const,
      }));
    }

    const byLabel = new Map(
      questions.map((question) => [normalizeLabel(question.label), question.id]),
    );

    const matches: RegionMatch[] = [];
    const needsSemantic: MappableRegion[] = [];

    for (const region of answerRegions) {
      const hint = region.questionLabelHint ? normalizeLabel(region.questionLabelHint) : null;
      const questionId = hint ? byLabel.get(hint) : undefined;

      if (questionId) {
        matches.push({
          regionId: region.id,
          questionId,
          confidence: 0.95,
          strategy: 'label',
        });
      } else {
        needsSemantic.push(region);
      }
    }

    if (needsSemantic.length > 0) {
      const semantic = await this.matchSemantically(questions, needsSemantic);
      matches.push(...semantic);
    }

    // Printed labels are structural, never answers.
    for (const region of regions) {
      if (region.isPrintedLabel) {
        matches.push({
          regionId: region.id,
          questionId: null,
          confidence: 0,
          strategy: 'unmatched',
        });
      }
    }

    const matched = matches.filter((match) => match.questionId).length;
    this.logger.log(
      `Mapped ${matched}/${answerRegions.length} answer regions across ${questions.length} questions`,
    );

    return matches;
  }

  private async matchSemantically(
    questions: MappableQuestion[],
    regions: MappableRegion[],
  ): Promise<RegionMatch[]> {
    try {
      const questionTexts = questions.map((question) => `${question.label}. ${question.text}`);
      const regionTexts = regions.map((region) => region.transcript);

      // Embedded in one call so both halves come from the same model. Two calls
      // could land on different providers mid-failover, and comparing vectors
      // from unrelated spaces yields meaningless similarities.
      const vectors = await this.ai.embed([...questionTexts, ...regionTexts]);
      const questionVectors = vectors.slice(0, questionTexts.length);
      const regionVectors = vectors.slice(questionTexts.length);

      return regions.map((region, regionIndex) => {
        const regionVector = regionVectors[regionIndex];
        let bestIndex = -1;
        let bestScore = -1;

        questionVectors.forEach((questionVector, questionIndex) => {
          const score = cosineSimilarity(regionVector, questionVector);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = questionIndex;
          }
        });

        const confident = bestScore >= MAPPING_CONFIDENCE_THRESHOLD && bestIndex >= 0;
        return {
          regionId: region.id,
          questionId: confident ? questions[bestIndex]!.id : null,
          confidence: Math.max(0, bestScore),
          strategy: confident ? ('embedding' as const) : ('unmatched' as const),
        };
      });
    } catch (error) {
      this.logger.warn(
        `Embeddings unavailable (${(error as Error).message}); falling back to lexical matching`,
      );
      return regions.map((region) => this.matchLexically(questions, region));
    }
  }

  private matchLexically(questions: MappableQuestion[], region: MappableRegion): RegionMatch {
    const regionTokens = tokenize(region.transcript);
    let bestIndex = -1;
    let bestScore = 0;

    questions.forEach((question, index) => {
      const score = jaccard(regionTokens, tokenize(question.text));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    // Lexical overlap is a much weaker signal than cosine similarity, so it gets
    // a correspondingly lower bar before it will claim a match at all.
    const confident = bestScore >= 0.12 && bestIndex >= 0;
    return {
      regionId: region.id,
      questionId: confident ? questions[bestIndex]!.id : null,
      confidence: bestScore,
      strategy: confident ? 'lexical' : 'unmatched',
    };
  }
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/^(question|ques|q|ans|answer)\s*/i, '')
    .replace(/[^a-z0-9]/g, '');
}

export function cosineSimilarity(a: number[] | undefined, b: number[] | undefined): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'to',
  'in',
  'is',
  'are',
  'and',
  'or',
  'for',
  'on',
  'with',
  'that',
  'this',
  'it',
  'as',
  'by',
  'be',
  'from',
  'at',
  'which',
  'what',
  'how',
  'why',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}
