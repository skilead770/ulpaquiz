export type GeneratedAiQuestion = {
  text: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  explanation?: string;
};

export type QuestionAiProvider = 'openai' | 'gemini' | 'xai';

export const questionAiProviders: Record<QuestionAiProvider, { label: string; defaultModel: string; keyLabel: string }> = {
  openai: { label: 'ChatGPT / OpenAI', defaultModel: 'gpt-4o-mini', keyLabel: 'OpenAI' },
  gemini: { label: 'Gemini', defaultModel: 'gemini-3.5-flash-lite', keyLabel: 'Google AI Studio' },
  xai: { label: 'Grok / xAI', defaultModel: 'grok-4.3', keyLabel: 'xAI' },
};

export const questionAiProviderOptions: QuestionAiProvider[] = ['openai', 'gemini', 'xai'];

export function stripHebrewVowels(value: string) {
  return value.replace(/[֑-ׇ]/g, '').trim();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isQuestionAiProvider(value: string): value is QuestionAiProvider {
  return value === 'openai' || value === 'gemini' || value === 'xai';
}

export function isGeneratedAiQuestions(value: unknown): value is [
  GeneratedAiQuestion,
  GeneratedAiQuestion,
  GeneratedAiQuestion,
  GeneratedAiQuestion,
] {
  if (!Array.isArray(value) || value.length !== 4) return false;

  return value.every((question) => {
    if (!isRecord(question)) return false;
    const options = question.options;
    return typeof question.text === 'string' &&
      question.text.trim().length > 0 &&
      Array.isArray(options) &&
      options.length === 4 &&
      options.every((option) => typeof option === 'string' && option.trim().length > 0) &&
      typeof question.correctOptionIndex === 'number' &&
      Number.isInteger(question.correctOptionIndex) &&
      question.correctOptionIndex >= 0 &&
      question.correctOptionIndex <= 3 &&
      (question.explanation === undefined || typeof question.explanation === 'string');
  });
}

export function getAiResponseError(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.message === 'string') return value.message;
  if (!isRecord(value.error)) return null;
  return typeof value.error.message === 'string' ? value.error.message : null;
}

export function getAiResponseText(value: unknown, provider: QuestionAiProvider): string | null {
  if (!isRecord(value)) return null;

  if (provider === 'gemini') {
    const candidates = value.candidates;
    if (!Array.isArray(candidates) || !isRecord(candidates[0])) return null;
    const content = candidates[0].content;
    if (!isRecord(content) || !Array.isArray(content.parts)) return null;
    const textParts: string[] = [];
    for (const part of content.parts) {
      if (isRecord(part) && part.thought !== true && typeof part.text === 'string') {
        textParts.push(part.text);
      }
    }
    return textParts.length > 0 ? textParts.join('') : null;
  }

  const choices = value.choices;
  if (!Array.isArray(choices) || !isRecord(choices[0])) return null;
  const message = choices[0].message;
  return isRecord(message) && typeof message.content === 'string' ? message.content : null;
}

export function getAiFinishReason(value: unknown, provider: QuestionAiProvider): string | null {
  if (!isRecord(value)) return null;
  if (provider === 'gemini') {
    const candidates = value.candidates;
    return Array.isArray(candidates) && isRecord(candidates[0]) && typeof candidates[0].finishReason === 'string'
      ? candidates[0].finishReason
      : null;
  }

  const choices = value.choices;
  return Array.isArray(choices) && isRecord(choices[0]) && typeof choices[0].finish_reason === 'string'
    ? choices[0].finish_reason
    : null;
}
