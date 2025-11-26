import fs from 'fs';
import path from 'path';
import https from 'https';
import OpenAI from 'openai';
/**
 * Image Generation Service
 * Uses OpenAI DALL-E to generate images for mythic entities
 */
export class ImageGenerationService {
    client;
    config;
    outputDir;
    logFilePath;
    imagesGenerated = 0;
    constructor(config) {
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
    isEnabled() {
        return Boolean(this.client);
    }
    /**
     * Generate image for a single entity
     */
    async generateImage(entity, context) {
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
                model: this.config.model,
                prompt,
                n: 1,
                size: this.config.size,
                quality: this.config.quality,
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
        }
        catch (error) {
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
    async generateImagesForMythicEntities(entities, context) {
        if (!this.isEnabled()) {
            return [];
        }
        const mythicEntities = entities.filter(e => e.prominence === 'mythic' || e.prominence === 'renowned');
        if (mythicEntities.length === 0) {
            this.writeToLog('No mythic entities found for image generation\n');
            return [];
        }
        this.writeToLog(`\nGenerating images for ${mythicEntities.length} mythic entities...\n`);
        const results = [];
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
    buildPrompt(entity, context) {
        const worldContext = this.getWorldContext(entity);
        const entityDescription = this.getEntityDescription(entity);
        const styleGuidance = this.getStyleGuidance(entity);
        return `${worldContext}\n\n${entityDescription}\n\n${styleGuidance}`.trim();
    }
    /**
     * Get world-building context for prompt
     */
    getWorldContext(entity) {
        const baseWorld = 'Geographic atlas illustration from a frozen Antarctic world inhabited by super-intelligent penguins dwelling upon colossal ice formations.';
        const kindContext = {
            npc: 'Field guide portrait: anthropomorphic penguin specimen displaying remarkable intelligence and distinct character.',
            location: 'Cartographic vista: dramatic ice formation within the vast Antarctic seascape surrounding the towering Aurora Berg.',
            faction: 'Symbolic heraldry: visual representation of a penguin collective through emblematic imagery and compositional elements.',
            abilities: 'Phenomenon illustration: mystical or technological forces manifesting through visual energy and environmental effects.',
            rules: 'Cultural iconography: symbolic visualization representing societal customs and traditions through allegorical imagery.'
        };
        return `${baseWorld} ${kindContext[entity.kind] || ''}`;
    }
    /**
     * Get entity-specific description for prompt
     */
    getEntityDescription(entity) {
        let description = `${entity.name}: ${entity.description}`;
        // Add subtype context
        const subtypeContext = {
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
    getStyleGuidance(entity) {
        // Geographic atlas style guidance with explicit no-text instruction
        const baseStyle = 'Style: Illustrated geographic atlas or field guide style, hand-painted watercolor and ink aesthetic, dramatic lighting, Antarctic color palette (deep blues, ice whites, seafoam teals, aurora purples). Museum-quality natural history illustration.';
        const kindStyle = {
            npc: 'Character portrait in naturalist field guide style, detailed feather texture, expressive pose, scientific illustration quality.',
            location: 'Cartographic landscape illustration, wide establishing view, atmospheric depth, topographic detail, sense of scale and grandeur.',
            faction: 'Symbolic heraldry or group composition, emblematic design, visual identity through imagery alone.',
            abilities: 'Abstract phenomenon illustration, ethereal effects, mystical energy visualization, scientific diagram aesthetic.',
            rules: 'Allegorical or symbolic imagery, cultural iconography, metaphorical visual representation.'
        };
        // CRITICAL: Explicit instructions to prevent text generation
        const noTextInstruction = 'IMPORTANT: No text, labels, words, letters, titles, captions, or written language of any kind. Pure visual imagery only. No typography or lettering.';
        return `${baseStyle} ${kindStyle[entity.kind] || ''}\n\n${noTextInstruction}`;
    }
    /**
     * Download image from URL to local file
     */
    async downloadImage(url, entity) {
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
    writeToLog(message) {
        try {
            fs.appendFileSync(this.logFilePath, message);
        }
        catch (error) {
            console.warn('Failed to write to image generation log:', error);
        }
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            imagesGenerated: this.imagesGenerated,
            outputDir: this.outputDir,
            logPath: this.logFilePath
        };
    }
}
//# sourceMappingURL=imageGenerationService.js.map