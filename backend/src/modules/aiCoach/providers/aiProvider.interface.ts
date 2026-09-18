export interface IAIProvider {
  name: string;
  generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: { jsonMode?: boolean }
  ): Promise<string>;
  generateChatReply(
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    systemPrompt: string
  ): Promise<string>;
}
