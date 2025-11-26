import { HardState } from '../types/worldTypes';
import { EnrichmentContext } from '../types/lore';
export interface ImageGenerationConfig {
    enabled: boolean;
    apiKey?: string;
    model?: string;
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
}
export interface ImageGenerationResult {
    entityId: string;
    entityName: string;
    entityKind: string;
    prompt: string;
    imageUrl?: string;
    localPath?: string;
    error?: string;
    skipped?: boolean;
}
/**
 * Image Generation Service
 * Uses OpenAI DALL-E to generate images for mythic entities
 */
export declare class ImageGenerationService {
    private client?;
    private config;
    private outputDir;
    private logFilePath;
    private imagesGenerated;
    constructor(config: ImageGenerationConfig);
    isEnabled(): boolean;
    /**
     * Generate image for a single entity
     */
    generateImage(entity: HardState, context: EnrichmentContext): Promise<ImageGenerationResult>;
    /**
     * Generate images for multiple entities (mythic only)
     */
    generateImagesForMythicEntities(entities: HardState[], context: EnrichmentContext): Promise<ImageGenerationResult[]>;
    /**
     * Build image generation prompt with world context
     */
    private buildPrompt;
    /**
     * Get world-building context for prompt
     */
    private getWorldContext;
    /**
     * Get entity-specific description for prompt
     */
    private getEntityDescription;
    /**
     * Get style guidance for consistent art direction
     */
    private getStyleGuidance;
    /**
     * Download image from URL to local file
     */
    private downloadImage;
    /**
     * Write to log file
     */
    private writeToLog;
    /**
     * Get statistics
     */
    getStats(): {
        imagesGenerated: number;
        outputDir: string;
        logPath: string;
    };
}
//# sourceMappingURL=imageGenerationService.d.ts.map