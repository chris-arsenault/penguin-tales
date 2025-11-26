import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
export class LLMClient {
    cache = new Map();
    config;
    client;
    callsCompleted = 0;
    callsCreated = 0;
    logFilePath;
    constructor(config) {
        this.config = {
            ...config,
            model: (config.model || '').trim(),
            apiKey: (config.apiKey || process.env.ANTHROPIC_API_KEY || '').trim()
        };
        const apiKey = this.config.apiKey;
        if (this.config.enabled && apiKey) {
            this.client = new Anthropic({ apiKey });
        }
        // Setup log file
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        this.logFilePath = path.join(outputDir, 'llm_calls.log');
        // Clear previous log file
        if (fs.existsSync(this.logFilePath)) {
            fs.unlinkSync(this.logFilePath);
        }
        // Write header
        this.writeToLog(`=== LLM Call Log - ${new Date().toISOString()} ===\n\n`);
    }
    isEnabled() {
        return Boolean(this.client);
    }
    async complete(request) {
        if (!this.client) {
            return { text: '', cached: false, skipped: true };
        }
        const cacheKey = this.createCacheKey(request);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return { text: cached, cached: true };
        }
        this.callsCreated++;
        const callNumber = this.callsCreated;
        let attempt = 0;
        const maxAttempts = 2;
        const backoffMs = 200;
        while (attempt < maxAttempts) {
            attempt++;
            try {
                this.logRequest(request, attempt, callNumber);
                const response = await this.client.messages.create({
                    model: this.config.model,
                    max_tokens: request.maxTokens || this.config.maxTokens || 256,
                    temperature: request.temperature ?? this.config.temperature ?? 0.4,
                    system: request.systemPrompt,
                    messages: [{ role: 'user', content: request.prompt }]
                });
                let text = '';
                for (const part of response.content) {
                    if (part.type === 'text') {
                        text += part.text;
                    }
                }
                this.logResponse(text, attempt, callNumber);
                if (text) {
                    this.cache.set(cacheKey, text);
                }
                this.callsCompleted++;
                this.logProgress();
                return { text, cached: false };
            }
            catch (error) {
                const message = error?.message || `${error}`;
                this.writeToLog(`[ERROR] Call ${callNumber}, Attempt ${attempt}/${maxAttempts}: ${message}\n`);
                if (attempt >= maxAttempts) {
                    this.callsCompleted++;
                    this.logProgress();
                    return { text: '', cached: false, skipped: true };
                }
                await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
            }
        }
        return { text: '', cached: false, skipped: true };
    }
    createCacheKey(request) {
        const payload = `${request.systemPrompt}|${request.prompt}|${request.maxTokens}|${request.temperature}`;
        return crypto.createHash('sha1').update(payload).digest('hex');
    }
    writeToLog(content) {
        fs.appendFileSync(this.logFilePath, content, 'utf8');
    }
    logRequest(request, attempt, callNumber) {
        const timestamp = new Date().toISOString();
        const logEntry = [
            `\n${'='.repeat(80)}`,
            `[REQUEST #${callNumber}] ${timestamp} (Attempt ${attempt})`,
            `${'='.repeat(80)}`,
            `Model: ${this.config.model}`,
            `Max Tokens: ${request.maxTokens || this.config.maxTokens || 256}`,
            `Temperature: ${request.temperature ?? this.config.temperature ?? 0.4}`,
            `\n--- System Prompt ---`,
            request.systemPrompt,
            `\n--- User Prompt ---`,
            request.prompt,
            `\n`
        ].join('\n');
        this.writeToLog(logEntry);
    }
    logResponse(text, attempt, callNumber) {
        const timestamp = new Date().toISOString();
        const logEntry = [
            `--- Response #${callNumber} (Attempt ${attempt}) ---`,
            `Timestamp: ${timestamp}`,
            `Length: ${text.length} characters`,
            `\n--- Content ---`,
            text,
            `\n${'='.repeat(80)}\n\n`
        ].join('\n');
        this.writeToLog(logEntry);
    }
    logProgress() {
        // Clear line and write progress (overwrite previous progress line)
        process.stdout.write(`\r\x1b[K[LLM] ${this.callsCompleted}/${this.callsCreated} calls complete`);
    }
    getCallStats() {
        return {
            completed: this.callsCompleted,
            created: this.callsCreated
        };
    }
}
//# sourceMappingURL=llmClient.js.map