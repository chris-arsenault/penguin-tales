import type { ResolvedLLMCallConfig } from './llmModelSettings';

export interface TokenBudget {
  responseBudget: number;
  thinkingBudget?: number;
  totalMaxTokens: number;
}

export function calcTokenBudget(callConfig: ResolvedLLMCallConfig, fallback: number): TokenBudget {
  const responseBudget = callConfig.maxTokens > 0 ? callConfig.maxTokens : fallback;
  const thinkingBudget = callConfig.thinkingBudget > 0 ? callConfig.thinkingBudget : undefined;
  const totalMaxTokens = thinkingBudget ? thinkingBudget + responseBudget : responseBudget;
  return { responseBudget, thinkingBudget, totalMaxTokens };
}
