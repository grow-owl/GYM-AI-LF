import { IAIProvider } from './aiProvider.interface';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export class GeminiRateLimitError extends Error {
  constructor(message: string = 'Gemini rate/quota limit reached') {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

export class GeminiServiceUnavailableError extends Error {
  constructor(message: string = 'Gemini service is unavailable or down') {
    super(message);
    this.name = 'GeminiServiceUnavailableError';
  }
}

export class GeminiProvider implements IAIProvider {
  public readonly name = 'GEMINI';

  private isMockMode(): boolean {
    if (!env.GEMINI_API_KEY) return true;
    if (env.GEMINI_API_KEY.includes('your_') || env.GEMINI_API_KEY.includes('dummy')) {
      return true;
    }
    return false;
  }

  public async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: { jsonMode?: boolean } = {}
  ): Promise<string> {
    if (this.isMockMode() || env.NODE_ENV === 'test') {
      logger.info('🤖 Gemini API in mock mode — returning structured completion');
      if (options.jsonMode) {
        return JSON.stringify({
          insights: [
            'Gemini AI: Excellent work maintaining 80%+ workout completion rate.',
            'Sleep duration averaged 7.8 hours, supporting CNS recovery.',
          ],
          recommendations: [
            'Add progressive overload on bench press by +2.5kg next cycle.',
            'Maintain caloric deficit of 300 kcal/day for fat loss goal.',
          ],
        });
      }
      return 'Mock Gemini Completion: Progress looks consistent! Stay focused on your hydration and active recovery routines.';
    }

    const candidateModels = Array.from(new Set([
      env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
    ]));

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nUser Request: ${userPrompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: options.jsonMode ? 'application/json' : 'text/plain',
            },
          }),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          if (response.status === 429 || errBody.includes('RESOURCE_EXHAUSTED') || errBody.toLowerCase().includes('quota')) {
            throw new GeminiRateLimitError(`Gemini API rate limit (${model}): HTTP ${response.status} - ${errBody}`);
          }
          throw new GeminiServiceUnavailableError(`Gemini API error (${model}): HTTP ${response.status} - ${errBody}`);
        }

        const data = (await response.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          logger.info(`✅ Gemini completion successfully generated using model ${model}`);
          return text;
        }
      } catch (error: any) {
        if (error instanceof GeminiRateLimitError) {
          throw error;
        }
        lastError = error;
        logger.warn(`⚠️ Gemini completion model ${model} failed, trying next candidate...`);
      }
    }

    logger.error(`Gemini Provider Error: ${lastError}`);
    if (lastError instanceof GeminiRateLimitError) {
      throw lastError;
    }
    throw new GeminiServiceUnavailableError(lastError?.message || 'Failed to generate completion from Gemini API');
  }

  public async generateChatReply(
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    systemPrompt: string
  ): Promise<string> {
    if (env.NODE_ENV === 'test') {
      logger.info('🤖 Gemini API in test mode — returning deterministic mock response');
      return 'Gemini AI Coach: Focus on progressive overload, maintain proper squat depth, and ensure adequate post-workout hydration and protein intake.';
    }

    if (this.isMockMode()) {
      logger.warn('⚠️ Gemini API key is missing or dummy — service unavailable');
      throw new GeminiServiceUnavailableError('Gemini API key is not configured');
    }

    const candidateModels = Array.from(new Set([
      env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
    ]));

    const formattedContents = conversationHistory.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: formattedContents,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          if (
            response.status === 429 ||
            errBody.includes('RESOURCE_EXHAUSTED') ||
            errBody.toLowerCase().includes('quota') ||
            errBody.toLowerCase().includes('rate limit')
          ) {
            throw new GeminiRateLimitError(`Gemini Chat rate limit (${model}): HTTP ${response.status} - ${errBody}`);
          }
          throw new GeminiServiceUnavailableError(`Gemini Chat API error (${model}): HTTP ${response.status} - ${errBody}`);
        }

        const data = (await response.json()) as GeminiResponse;
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) {
          logger.info(`✅ Gemini API response successfully generated using model ${model}`);
          return replyText;
        }
      } catch (error: any) {
        if (error instanceof GeminiRateLimitError) {
          throw error;
        }
        lastError = error;
        logger.warn(`⚠️ Gemini model ${model} failed, trying next candidate...`);
      }
    }

    logger.error(`Gemini Chat Provider Error: ${lastError}`);
    if (lastError instanceof GeminiRateLimitError) {
      throw lastError;
    }
    throw new GeminiServiceUnavailableError(lastError?.message || 'Gemini service is down or unreachable');
  }
}
