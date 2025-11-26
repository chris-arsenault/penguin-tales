/**
 * Feedback Loop Configuration
 *
 * Explicit declaration of all feedback relationships in the world generation system.
 * Each loop describes how one variable affects another, creating homeostatic regulation.
 *
 * Negative feedback = stabilizing (source up → target down)
 * Positive feedback = amplifying (source up → target up)
 */
import { FeedbackLoop } from '../services/feedbackAnalyzer';
export declare const feedbackLoops: FeedbackLoop[];
/**
 * Get feedback loops by type
 */
export declare function getNegativeFeedbackLoops(): FeedbackLoop[];
export declare function getPositiveFeedbackLoops(): FeedbackLoop[];
/**
 * Get loops involving a specific entity or pressure
 */
export declare function getLoopsForTarget(target: string): FeedbackLoop[];
//# sourceMappingURL=feedbackLoops.d.ts.map