import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskHandlerMap, TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import { descriptionTask } from './descriptionTask';
import { imageTask } from './imageTask';
import { chronicleTask } from './chronicleTask';
import { paletteExpansionTask } from './paletteExpansionTask';

export const TASK_HANDLERS = {
  description: descriptionTask,
  image: imageTask,
  entityChronicle: chronicleTask,
  paletteExpansion: paletteExpansionTask,
} satisfies TaskHandlerMap;

export async function executeTask(task: WorkerTask, context: TaskContext): Promise<TaskResult> {
  const handler = TASK_HANDLERS[task.type];
  return handler.execute(task as never, context);
}

export {
  descriptionTask,
  imageTask,
  chronicleTask,
  paletteExpansionTask,
};
