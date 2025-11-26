import { LLMConfig } from '../types/engine';
export interface LLMRequest {
    systemPrompt: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
}
export interface LLMResult {
    text: string;
    cached: boolean;
    skipped?: boolean;
}
export declare class LLMClient {
    private cache;
    private config;
    private client?;
    private callsCompleted;
    private callsCreated;
    private logFilePath;
    constructor(config: LLMConfig);
    isEnabled(): boolean;
    complete(request: LLMRequest): Promise<LLMResult>;
    private createCacheKey;
    private writeToLog;
    private logRequest;
    private logResponse;
    private logProgress;
    getCallStats(): {
        completed: number;
        created: number;
    };
}
//# sourceMappingURL=llmClient.d.ts.map