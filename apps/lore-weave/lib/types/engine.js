// Component Purpose Taxonomy
// Defines the formal purpose of each framework component
export var ComponentPurpose;
(function (ComponentPurpose) {
    // Creation purposes
    ComponentPurpose["ENTITY_CREATION"] = "Creates entities based on prerequisites";
    ComponentPurpose["RELATIONSHIP_CREATION"] = "Creates relationships based on graph patterns";
    // Modification purposes
    ComponentPurpose["TAG_PROPAGATION"] = "Spreads tags through relationship networks";
    ComponentPurpose["STATE_MODIFICATION"] = "Changes entity states based on context";
    ComponentPurpose["PROMINENCE_EVOLUTION"] = "Adjusts entity prominence over time";
    // Signal purposes
    ComponentPurpose["PRESSURE_ACCUMULATION"] = "Measures graph state to produce pressure signal";
    // Control purposes
    ComponentPurpose["CONSTRAINT_ENFORCEMENT"] = "Enforces population/density limits";
    ComponentPurpose["PHASE_TRANSITION"] = "Changes era based on conditions";
    ComponentPurpose["BEHAVIORAL_MODIFIER"] = "Modifies template weights or system frequencies";
})(ComponentPurpose || (ComponentPurpose = {}));
//# sourceMappingURL=engine.js.map