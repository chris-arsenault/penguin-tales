/**
 * Browser-compatible LLM Client
 *
 * Adapted from the Node.js version with:
 * - Web Crypto API for cache key generation
 * - Console/memory logging instead of file logging
 * - Fetch API instead of Anthropic SDK
 */

export interface LLMConfig {
  enabled: boolean;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

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
  error?: string;
}

export interface CallLogEntry {
  callNumber: number;
  timestamp: string;
  request: {
    model: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
    userPrompt: string;
  };
  response?: {
    text: string;
    length: number;
  };
  error?: string;
  attempt: number;
}

export class LLMClient {
  private cache = new Map<string, string>();
  private config: LLMConfig;
  private callsCompleted = 0;
  private callsCreated = 0;
  private callLog: CallLogEntry[] = [];

  constructor(config: LLMConfig) {
    this.config = {
      ...config,
      model: (config.model || 'claude-sonnet-4-20250514').trim(),
      apiKey: (config.apiKey || '').trim(),
    };
  }

  public isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.apiKey);
  }

  public async complete(request: LLMRequest): Promise<LLMResult> {
    if (!this.isEnabled()) {
      return { text: '', cached: false, skipped: true };
    }

    const cacheKey = await this.createCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { text: cached, cached: true };
    }

    this.callsCreated++;
    const callNumber = this.callsCreated;

    let attempt = 0;
    const maxAttempts = 3;
    const backoffMs = 1000;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const logEntry = this.logRequest(request, attempt, callNumber);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey!,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: request.maxTokens || this.config.maxTokens || 256,
            temperature: request.temperature ?? this.config.temperature ?? 0.4,
            system: request.systemPrompt,
            messages: [{ role: 'user', content: request.prompt }],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        let text = '';
        for (const part of data.content) {
          if (part.type === 'text') {
            text += part.text;
          }
        }

        this.logResponse(logEntry, text);

        if (text) {
          this.cache.set(cacheKey, text);
        }

        this.callsCompleted++;
        return { text, cached: false };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[LLM] Call ${callNumber}, Attempt ${attempt}/${maxAttempts}: ${message}`);

        if (attempt >= maxAttempts) {
          this.callsCompleted++;
          return { text: '', cached: false, skipped: true, error: message };
        }

        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
      }
    }

    return { text: '', cached: false, skipped: true };
  }

  private async createCacheKey(request: LLMRequest): Promise<string> {
    const payload = `${request.systemPrompt}|${request.prompt}|${request.maxTokens}|${request.temperature}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private logRequest(request: LLMRequest, attempt: number, callNumber: number): CallLogEntry {
    const entry: CallLogEntry = {
      callNumber,
      timestamp: new Date().toISOString(),
      attempt,
      request: {
        model: this.config.model,
        maxTokens: request.maxTokens || this.config.maxTokens || 256,
        temperature: request.temperature ?? this.config.temperature ?? 0.4,
        systemPrompt: request.systemPrompt,
        userPrompt: request.prompt,
      },
    };
    this.callLog.push(entry);
    return entry;
  }

  private logResponse(entry: CallLogEntry, text: string) {
    entry.response = {
      text,
      length: text.length,
    };
  }

  public getCallStats() {
    return {
      completed: this.callsCompleted,
      created: this.callsCreated,
    };
  }

  public getCallLog(): CallLogEntry[] {
    return [...this.callLog];
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

/**
 * OpenAI Image Generation Client for DALL-E
 */
export interface ImageConfig {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface ImageRequest {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface ImageResult {
  imageUrl: string | null;
  revisedPrompt?: string;
  skipped?: boolean;
  error?: string;
}

export class ImageGenerationClient {
  private config: ImageConfig;
  private imagesGenerated = 0;

  constructor(config: ImageConfig) {
    this.config = {
      ...config,
      model: config.model || 'dall-e-3',
      size: config.size || '1024x1024',
      quality: config.quality || 'standard',
    };
  }

  public isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.apiKey);
  }

  public async generate(request: ImageRequest): Promise<ImageResult> {
    if (!this.isEnabled()) {
      return { imageUrl: null, skipped: true };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: request.prompt,
          n: 1,
          size: request.size || this.config.size,
          quality: request.quality || this.config.quality,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      this.imagesGenerated++;

      return {
        imageUrl: data.data[0]?.url || null,
        revisedPrompt: data.data[0]?.revised_prompt,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Image] Generation failed: ${message}`);
      return { imageUrl: null, skipped: true, error: message };
    }
  }

  public getStats() {
    return {
      generated: this.imagesGenerated,
    };
  }
}
