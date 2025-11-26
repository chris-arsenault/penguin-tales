import type {
  KnowledgeGraph,
  HardState,
  Relationship,
} from "./domain.js";

/**
 * Mock Knowledge Graph Implementation
 * Simple in-memory implementation for testing derivative names (Phase 4)
 */
export class MockKnowledgeGraph implements KnowledgeGraph {
  private entities: Map<string, HardState> = new Map();
  private relationships: Relationship[] = [];

  constructor(entities: HardState[] = [], relationships: Relationship[] = []) {
    entities.forEach((e) => this.entities.set(e.id, e));
    this.relationships = relationships;
  }

  getEntities(): HardState[] {
    return Array.from(this.entities.values());
  }

  getEntity(id: string): HardState | undefined {
    return this.entities.get(id);
  }

  findEntities(criteria: Partial<HardState>): HardState[] {
    return this.getEntities().filter((entity) => {
      // Match kind
      if (criteria.kind && entity.kind !== criteria.kind) {
        return false;
      }

      // Match subtype
      if (criteria.subtype && entity.subtype !== criteria.subtype) {
        return false;
      }

      // Match tags (entity must have ALL specified tags)
      if (criteria.tags && criteria.tags.length > 0) {
        const hasAllTags = criteria.tags.every((tag) =>
          entity.tags.includes(tag)
        );
        if (!hasAllTags) {
          return false;
        }
      }

      // Match prominence
      if (criteria.prominence && entity.prominence !== criteria.prominence) {
        return false;
      }

      return true;
    });
  }

  getRelationships(entityId: string): Relationship[] {
    return this.relationships.filter(
      (rel) => rel.src === entityId || rel.dst === entityId
    );
  }

  // Mutation methods for testing
  addEntity(entity: HardState): void {
    this.entities.set(entity.id, entity);
  }

  addRelationship(relationship: Relationship): void {
    this.relationships.push(relationship);
  }

  clear(): void {
    this.entities.clear();
    this.relationships = [];
  }
}

/**
 * Create a mock KG with sample data for testing
 */
export function createSampleKG(): MockKnowledgeGraph {
  const entities: HardState[] = [
    {
      id: "npc-001",
      kind: "npc",
      subtype: "hero",
      name: "Thorin Ironforge",
      description: "A legendary dwarf warrior",
      status: "active",
      prominence: "renowned",
      tags: ["dwarf", "warrior", "mountain"],
      links: [],
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: "location-001",
      kind: "location",
      subtype: "mountain",
      name: "Ironforge Peak",
      description: "A massive mountain fortress",
      status: "active",
      prominence: "recognized",
      tags: ["dwarf", "mountain", "fortress"],
      links: [],
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: "npc-002",
      kind: "npc",
      subtype: "wizard",
      name: "Galadriel Starweaver",
      description: "An ancient elven mage",
      status: "active",
      prominence: "mythic",
      tags: ["elf", "magic", "ancient"],
      links: [],
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: "location-002",
      kind: "location",
      subtype: "forest",
      name: "Silverwood",
      description: "An enchanted elven forest",
      status: "active",
      prominence: "renowned",
      tags: ["elf", "forest", "magic"],
      links: [],
      createdAt: 0,
      updatedAt: 0,
    },
  ];

  const relationships: Relationship[] = [
    { kind: "lives-in", src: "npc-001", dst: "location-001" },
    { kind: "lives-in", src: "npc-002", dst: "location-002" },
    { kind: "allied-with", src: "npc-001", dst: "npc-002" },
  ];

  return new MockKnowledgeGraph(entities, relationships);
}
