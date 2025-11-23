import fs from 'fs';
import path from 'path';
import https from 'https';
import OpenAI from 'openai';
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
export class ImageGenerationService {
  private client?: OpenAI;
  private config: ImageGenerationConfig;
  private outputDir: string;
  private logFilePath: string;
  private imagesGenerated = 0;

  constructor(config: ImageGenerationConfig) {
    this.config = {
      enabled: config.enabled || false,
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      model: config.model || 'dall-e-3',
      size: config.size || '1024x1024',
      quality: config.quality || 'standard'
    };

    if (this.config.enabled && this.config.apiKey) {
      this.client = new OpenAI({ apiKey: this.config.apiKey });
    }

    // Setup output directory for images
    this.outputDir = path.join(process.cwd(), 'output', 'images');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Setup log file
    const outputLogDir = path.join(process.cwd(), 'output');
    this.logFilePath = path.join(outputLogDir, 'image_generation.log');

    // Clear previous log file
    if (fs.existsSync(this.logFilePath)) {
      fs.unlinkSync(this.logFilePath);
    }

    // Write header
    this.writeToLog(`=== Image Generation Log - ${new Date().toISOString()} ===\n\n`);
  }

  public isEnabled(): boolean {
    return Boolean(this.client);
  }

  /**
   * Generate image for a single entity
   */
  public async generateImage(
    entity: HardState,
    context: EnrichmentContext
  ): Promise<ImageGenerationResult> {
    if (!this.client) {
      return {
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        prompt: '',
        skipped: true
      };
    }

    const prompt = this.buildPrompt(entity, context);
    this.writeToLog(`\n=== Generating Image for ${entity.name} ===`);
    this.writeToLog(`Entity: ${entity.kind}:${entity.subtype}`);
    this.writeToLog(`Prompt: ${prompt}\n`);

    try {
      const response = await this.client.images.generate({
        model: this.config.model!,
        prompt,
        n: 1,
        size: this.config.size!,
        quality: this.config.quality!,
        response_format: 'url'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No image data returned from API');
      }

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL returned from API');
      }

      this.writeToLog(`✓ Image generated: ${imageUrl}\n`);

      // Download image to local file
      const localPath = await this.downloadImage(imageUrl, entity);
      this.imagesGenerated++;

      this.writeToLog(`✓ Saved to: ${localPath}\n`);

      return {
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        prompt,
        imageUrl,
        localPath
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      this.writeToLog(`✗ Error: ${errorMsg}\n`);

      return {
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        prompt,
        error: errorMsg
      };
    }
  }

  /**
   * Generate images for multiple entities (mythic only)
   */
  public async generateImagesForMythicEntities(
    entities: HardState[],
    context: EnrichmentContext
  ): Promise<ImageGenerationResult[]> {
    if (!this.isEnabled()) {
      return [];
    }

    const mythicEntities = entities.filter(e => e.prominence === 'mythic');

    if (mythicEntities.length === 0) {
      this.writeToLog('No mythic entities found for image generation\n');
      return [];
    }

    this.writeToLog(`\nGenerating images for ${mythicEntities.length} mythic entities...\n`);

    const results: ImageGenerationResult[] = [];

    // Process sequentially to avoid rate limits
    for (const entity of mythicEntities) {
      const result = await this.generateImage(entity, context);
      results.push(result);

      // Rate limiting: wait 1 second between requests
      if (results.length < mythicEntities.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Build image generation prompt with world context
   */
  private buildPrompt(entity: HardState, context: EnrichmentContext): string {
    const worldContext = this.getWorldContext(entity);
    const entityDescription = this.getEntityDescription(entity);
    const styleGuidance = this.getStyleGuidance(entity);

    return `${worldContext}\n\n${entityDescription}\n\n${styleGuidance}`.trim();
  }

  /**
   * Get world-building context for prompt
   */
  private getWorldContext(entity: HardState): string {
    const baseWorld = 'A frozen Antarctic world of super-intelligent penguins living on massive icebergs.';

    const kindContext: Record<string, string> = {
      npc: 'The character is an anthropomorphic penguin with human-like intelligence and personality.',
      location: 'This is a location on or near the massive iceberg Aurora Berg, in a frozen Antarctic seascape.',
      faction: 'This represents a penguin organization or group, shown through its members and symbols.',
      abilities: 'This represents a magical or technological ability used by penguins, shown through its manifestation or effects.',
      rules: 'This represents a cultural rule or tradition, shown through symbolic imagery or its cultural impact.'
    };

    return `${baseWorld} ${kindContext[entity.kind] || ''}`;
  }

  /**
   * Get entity-specific description for prompt
   */
  private getEntityDescription(entity: HardState): string {
    let description = `${entity.name}: ${entity.description}`;

    // Add subtype context
    const subtypeContext: Record<string, string> = {
      // NPCs
      hero: 'A legendary penguin hero, depicted in a heroic, larger-than-life pose.',
      mayor: 'A respected colony leader, shown with symbols of authority.',
      merchant: 'A savvy trader penguin, surrounded by trade goods and commerce.',
      outlaw: 'A rebellious penguin, shown in a defiant or secretive manner.',

      // Locations
      colony: 'A bustling penguin settlement carved into ice, with architectural details.',
      anomaly: 'A mysterious, otherworldly location with strange phenomena.',
      geographic_feature: 'A dramatic natural ice formation in the Antarctic landscape.',
      iceberg: 'A massive floating ice mountain, home to penguin colonies.',

      // Factions
      company: 'A merchant organization, shown through trade symbols and prosperity.',
      criminal: 'A shadowy syndicate, depicted through darkness and secrecy.',
      cult: 'A mystical group, shown with magical or spiritual symbolism.',
      political: 'A governing body, depicted with symbols of power and order.',

      // Abilities
      magic: 'Magical energy manifesting as glowing ice or mystical light.',
      technology: 'Advanced penguin technology, shown as ice-carved devices or tools.',

      // Rules
      edict: 'A formal law or decree, represented symbolically.',
      taboo: 'A forbidden practice, shown through ominous or warning imagery.',
      social: 'A cultural norm or tradition, depicted through community imagery.'
    };

    const subtypeDesc = subtypeContext[entity.subtype];
    if (subtypeDesc) {
      description += ` ${subtypeDesc}`;
    }

    return description;
  }

  /**
   * Get style guidance for consistent art direction
   */
  private getStyleGuidance(entity: HardState): string {
    const baseStyle = 'Digital illustration, dramatic lighting, Antarctic color palette (blues, whites, teals, purples).';

    const kindStyle: Record<string, string> = {
      npc: 'Character portrait style, focus on personality and details.',
      location: 'Wide establishing shot, atmospheric, sense of scale.',
      faction: 'Group composition or symbolic representation.',
      abilities: 'Abstract magical/technological effects, ethereal and dynamic.',
      rules: 'Symbolic or metaphorical imagery, cultural significance.'
    };

    return `Style: ${baseStyle} ${kindStyle[entity.kind] || ''}`;
  }

  /**
   * Download image from URL to local file
   */
  private async downloadImage(url: string, entity: HardState): Promise<string> {
    return new Promise((resolve, reject) => {
      // Sanitize filename
      const sanitizedName = entity.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const timestamp = Date.now();
      const filename = `${entity.kind}_${sanitizedName}_${timestamp}.png`;
      const filepath = path.join(this.outputDir, filename);

      const file = fs.createWriteStream(filepath);

      https.get(url, (response) => {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(filepath);
        });
      }).on('error', (err) => {
        fs.unlinkSync(filepath);
        reject(err);
      });
    });
  }

  /**
   * Write to log file
   */
  private writeToLog(message: string): void {
    try {
      fs.appendFileSync(this.logFilePath, message);
    } catch (error) {
      console.warn('Failed to write to image generation log:', error);
    }
  }

  /**
   * Get statistics
   */
  public getStats() {
    return {
      imagesGenerated: this.imagesGenerated,
      outputDir: this.outputDir,
      logPath: this.logFilePath
    };
  }
}
