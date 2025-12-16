import { describe, it, expect } from "vitest";
import {
  agentive,
  superlative,
  comparative,
  gerund,
  past,
  possessive,
  applyDerivation,
  isDerivationType,
} from "./derivation.js";

describe("derivation", () => {
  describe("agentive (-er: one who does)", () => {
    it("handles basic words", () => {
      expect(agentive("hunt")).toBe("hunter");
      expect(agentive("rend")).toBe("render");
      expect(agentive("kill")).toBe("killer");
      expect(agentive("burn")).toBe("burner");
    });

    it("handles words ending in 'e'", () => {
      expect(agentive("forge")).toBe("forger");
      expect(agentive("make")).toBe("maker");
      expect(agentive("ride")).toBe("rider");
    });

    it("handles CVC doubling", () => {
      expect(agentive("cut")).toBe("cutter");
      expect(agentive("run")).toBe("runner");
      expect(agentive("hit")).toBe("hitter");
    });

    it("handles consonant + y", () => {
      expect(agentive("carry")).toBe("carrier");
    });

    it("handles irregulars", () => {
      expect(agentive("lie")).toBe("liar");
      expect(agentive("slay")).toBe("slayer");
    });
  });

  describe("superlative (-est: most)", () => {
    it("handles basic words", () => {
      expect(superlative("deep")).toBe("deepest");
      expect(superlative("dark")).toBe("darkest");
      expect(superlative("swift")).toBe("swiftest");
      expect(superlative("strong")).toBe("strongest");
    });

    it("handles words ending in 'e'", () => {
      expect(superlative("pale")).toBe("palest");
      expect(superlative("fierce")).toBe("fiercest");
    });

    it("handles CVC doubling", () => {
      expect(superlative("grim")).toBe("grimmest");
      expect(superlative("big")).toBe("biggest");
      expect(superlative("hot")).toBe("hottest");
    });

    it("handles consonant + y", () => {
      expect(superlative("happy")).toBe("happiest");
      expect(superlative("mighty")).toBe("mightiest");
    });

    it("handles irregulars", () => {
      expect(superlative("good")).toBe("best");
      expect(superlative("bad")).toBe("worst");
      expect(superlative("far")).toBe("farthest");
    });
  });

  describe("comparative (-er: more)", () => {
    it("handles basic words", () => {
      expect(comparative("dark")).toBe("darker");
      expect(comparative("swift")).toBe("swifter");
      expect(comparative("strong")).toBe("stronger");
    });

    it("handles words ending in 'e'", () => {
      expect(comparative("pale")).toBe("paler");
      expect(comparative("fierce")).toBe("fiercer");
    });

    it("handles irregulars", () => {
      expect(comparative("good")).toBe("better");
      expect(comparative("bad")).toBe("worse");
    });
  });

  describe("gerund (-ing)", () => {
    it("handles basic words", () => {
      expect(gerund("hunt")).toBe("hunting");
      expect(gerund("burn")).toBe("burning");
      expect(gerund("kill")).toBe("killing");
    });

    it("handles words ending in 'e'", () => {
      expect(gerund("forge")).toBe("forging");
      expect(gerund("make")).toBe("making");
      expect(gerund("ride")).toBe("riding");
    });

    it("handles CVC doubling", () => {
      expect(gerund("cut")).toBe("cutting");
      expect(gerund("run")).toBe("running");
      expect(gerund("hit")).toBe("hitting");
    });

    it("handles 'ie' ending", () => {
      expect(gerund("die")).toBe("dying");
      expect(gerund("lie")).toBe("lying");
    });

    it("preserves 'ee' ending", () => {
      expect(gerund("see")).toBe("seeing");
      expect(gerund("flee")).toBe("fleeing");
    });
  });

  describe("past (-ed)", () => {
    it("handles regular words", () => {
      expect(past("hunt")).toBe("hunted");
      expect(past("kill")).toBe("killed");
    });

    it("handles words ending in 'e'", () => {
      expect(past("curse")).toBe("cursed");
      expect(past("forge")).toBe("forged");
    });

    it("handles CVC doubling", () => {
      expect(past("stop")).toBe("stopped");
    });

    it("handles consonant + y", () => {
      expect(past("carry")).toBe("carried");
    });

    it("handles irregular verbs", () => {
      expect(past("break")).toBe("broken");
      expect(past("slay")).toBe("slain");
      expect(past("smite")).toBe("smitten");
      expect(past("bind")).toBe("bound");
      expect(past("hold")).toBe("held");
      expect(past("cut")).toBe("cut");
      expect(past("burn")).toBe("burnt");
    });
  });

  describe("possessive ('s)", () => {
    it("handles basic words", () => {
      expect(possessive("storm")).toBe("storm's");
      expect(possessive("blood")).toBe("blood's");
      expect(possessive("king")).toBe("king's");
    });

    it("handles words ending in 's'", () => {
      expect(possessive("darkness")).toBe("darkness'");
      expect(possessive("fortress")).toBe("fortress'");
    });

    it("handles words ending in 'x' or 'z'", () => {
      expect(possessive("fox")).toBe("fox'");
    });
  });

  describe("applyDerivation", () => {
    it("applies derivation by type name", () => {
      expect(applyDerivation("hunt", "er")).toBe("hunter");
      expect(applyDerivation("deep", "est")).toBe("deepest");
      expect(applyDerivation("dark", "comp")).toBe("darker");
      expect(applyDerivation("burn", "ing")).toBe("burning");
      expect(applyDerivation("curse", "ed")).toBe("cursed");
      expect(applyDerivation("storm", "poss")).toBe("storm's");
    });
  });

  describe("isDerivationType", () => {
    it("returns true for valid derivation types", () => {
      expect(isDerivationType("er")).toBe(true);
      expect(isDerivationType("est")).toBe(true);
      expect(isDerivationType("ing")).toBe(true);
      expect(isDerivationType("ed")).toBe(true);
      expect(isDerivationType("poss")).toBe(true);
      expect(isDerivationType("comp")).toBe(true);
    });

    it("returns false for invalid types", () => {
      expect(isDerivationType("foo")).toBe(false);
      expect(isDerivationType("cap")).toBe(false);
      expect(isDerivationType("")).toBe(false);
    });
  });

  describe("case preservation", () => {
    it("preserves capitalization for irregulars", () => {
      expect(past("Break")).toBe("Broken");
      expect(past("BREAK")).toBe("BROKEN");
    });
  });
});
