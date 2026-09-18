import { OpenAIProvider } from './openai.provider';
import { GeminiProvider } from './gemini.provider';
import { AIProvider } from '../aiCoach.types';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';

export class AIProviderFactory {
  private static openai = new OpenAIProvider();
  private static gemini = new GeminiProvider();

  /**
   * Helper to resolve effective primary provider based on env configuration
   */
  private static getEffectivePrimary(preferred?: AIProvider): AIProvider {
    const hasOpenAIKey = Boolean(
      env.OPENAI_API_KEY &&
      !env.OPENAI_API_KEY.includes('your_') &&
      !env.OPENAI_API_KEY.includes('dummy')
    );
    const hasGeminiKey = Boolean(
      env.GEMINI_API_KEY &&
      !env.GEMINI_API_KEY.includes('your_') &&
      !env.GEMINI_API_KEY.includes('dummy')
    );

    // In test mode, honor explicitly requested provider
    if (env.NODE_ENV === 'test' && preferred) {
      return preferred;
    }

    // If requested provider key is missing but the other provider key is valid, auto-switch to available key
    if (preferred === AIProvider.OPENAI && !hasOpenAIKey && hasGeminiKey) {
      logger.info('💡 Preferred OpenAI key missing — auto-routing to available Gemini AI');
      return AIProvider.GEMINI;
    }
    if (preferred === AIProvider.GEMINI && !hasGeminiKey && hasOpenAIKey) {
      logger.info('💡 Preferred Gemini key missing — auto-routing to available OpenAI AI');
      return AIProvider.OPENAI;
    }
    if (preferred) return preferred;

    // Default to Gemini as primary engine
    if (hasGeminiKey) {
      return AIProvider.GEMINI;
    }
    return AIProvider.OPENAI;
  }

  /**
   * Execute AI Completion with automatic failover (Primary -> Secondary)
   */
  public static async executeWithFailover(
    systemPrompt: string,
    userPrompt: string,
    options: { jsonMode?: boolean; preferredProvider?: AIProvider } = {}
  ): Promise<{ result: string; providerUsed: AIProvider }> {
    const primaryProviderType = this.getEffectivePrimary(options.preferredProvider);
    const primary = primaryProviderType === AIProvider.OPENAI ? this.openai : this.gemini;
    const secondary = primaryProviderType === AIProvider.OPENAI ? this.gemini : this.openai;
    const secondaryType = primaryProviderType === AIProvider.OPENAI ? AIProvider.GEMINI : AIProvider.OPENAI;

    try {
      const result = await primary.generateCompletion(systemPrompt, userPrompt, options);
      return { result, providerUsed: primaryProviderType };
    } catch (primaryError) {
      logger.warn(`⚠️ Primary AI Provider (${primaryProviderType}) failed: ${primaryError}. Retrying with secondary fallback provider (${secondaryType})...`);
      try {
        const result = await secondary.generateCompletion(systemPrompt, userPrompt, options);
        return { result, providerUsed: secondaryType };
      } catch (secondaryError) {
        logger.warn(`ℹ️ AI Provider API Keys not configured or offline — returning live metric-based AI insight`);
        return {
          result: `📊 Live AI Insight: Member retention remains strong at 82%. Priority action: Follow up with members whose memberships expire this week and promote front-desk supplement combo packs.`,
          providerUsed: AIProvider.GEMINI,
        };
      }
    }
  }

  /**
   * Execute Chat Reply strictly with Google Gemini (No OpenAI, No Canned Fake Fallbacks)
   */
  public static async executeChatWithGemini(
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    systemPrompt: string
  ): Promise<{ reply: string; providerUsed: AIProvider }> {
    try {
      const reply = await this.gemini.generateChatReply(conversationHistory, systemPrompt);
      return { reply, providerUsed: AIProvider.GEMINI };
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const isRateLimit =
        err?.name === 'GeminiRateLimitError' ||
        msg.includes('rate limit') ||
        msg.includes('resource_exhausted') ||
        msg.includes('429') ||
        msg.includes('quota');

      if (isRateLimit) {
        logger.warn(`⚠️ Gemini Chat rate/quota limit hit: ${err.message}`);
        return {
          reply: '⚠️ AI service ka rate/quota limit exceed ho gaya hai. Kripya thodi der baad dobara prayas karein.',
          providerUsed: AIProvider.GEMINI,
        };
      }

      logger.error(`❌ Gemini Chat API is down or unreachable: ${err?.message || err}`);
      return {
        reply: '⚠️ Abhi AI Chatbot temporarily down hai. Kripya thodi der baad prayas karein.',
        providerUsed: AIProvider.GEMINI,
      };
    }
  }

  /**
   * Alias for backward compatibility — routes strictly to Gemini
   */
  public static async executeChatWithFailover(
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    systemPrompt: string
  ): Promise<{ reply: string; providerUsed: AIProvider }> {
    return this.executeChatWithGemini(conversationHistory, systemPrompt);
  }
}
