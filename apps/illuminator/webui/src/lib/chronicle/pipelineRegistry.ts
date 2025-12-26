import type { NarrativePipeline } from './pipelineTypes';
import { storyPipeline } from './pipelines/story';
import { documentPipeline } from './pipelines/document';

const PIPELINES: Record<string, NarrativePipeline> = {
  story: storyPipeline,
  document: documentPipeline,
};

export function getPipeline(format: NarrativePipeline['format']): NarrativePipeline {
  const pipeline = PIPELINES[format];
  if (!pipeline) {
    throw new Error(`Unsupported narrative format: ${format}`);
  }
  return pipeline;
}
