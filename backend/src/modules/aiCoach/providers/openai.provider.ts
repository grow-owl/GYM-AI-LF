import { IAIProvider } from './aiProvider.interface';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';

interface OpenAIResponse {
  choices?: { message?: { content?: string } }[];
}

export class OpenAIProvider implements IAIProvider {
  public readonly name = 'OPENAI';

  private isMockMode(): boolean {
    if (!env.OPENAI_API_KEY) return true;
    if (env.OPENAI_API_KEY.includes('your_') || env.OPENAI_API_KEY.includes('dummy') || env.NODE_ENV === 'test') {
      return true;
    }
    return false;
  }

  public async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options: { jsonMode?: boolean } = {}
  ): Promise<string> {
    if (this.isMockMode()) {
      logger.info('🤖 OpenAI API in mock mode — returning structured completion');
      if (options.jsonMode) {
        return JSON.stringify({
          insights: [
            'Consistency in 4x weekly workouts has improved muscle recovery rate by 15%.',
            'Hydration average is slightly below optimal target on heavy squat days.',
          ],
          recommendations: [
            'Increase daily water intake to 3,000ml to prevent fatigue.',
            'Incorporate 10 minutes of post-workout hamstring stretching.',
          ],
        });
      }
      return 'Mock OpenAI Completion: Great job on your training volume this week! Focus on protein synthesis and sleep hygiene.';
    }

    try {
      const model = env.OPENAI_MODEL || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: options.jsonMode ? { type: 'json_object' } : undefined,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error (${model}): HTTP ${response.status}`);
      }

      const data = (await response.json()) as OpenAIResponse;
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      logger.error(`OpenAI Provider Error: ${error}`);
      throw error;
    }
  }

  public async generateChatReply(
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    systemPrompt: string
  ): Promise<string> {
    if (this.isMockMode()) {
      logger.info('🤖 OpenAI API in mock mode — returning chat reply');
      const lastMsg = conversationHistory[conversationHistory.length - 1]?.content || '';
      return `AI Coach: I am here to help with your fitness goals regarding "${lastMsg}". Keep up the strong effort! (Disclaimer: Consult a medical professional before starting new exercise regimes).`;
    }

    try {
      const messages = [{ role: 'system', content: systemPrompt }, ...conversationHistory];
      const model = env.OPENAI_MODEL || 'gpt-4o-mini';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI Chat API error: HTTP ${response.status}`);
      }

      const data = (await response.json()) as OpenAIResponse;
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      logger.error(`OpenAI Chat Provider Error: ${error}`);
      throw error;
    }
  }
}
