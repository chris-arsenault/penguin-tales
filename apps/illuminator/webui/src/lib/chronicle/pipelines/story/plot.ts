import type { ChroniclePlot, PlotBeat } from '../../chronicleTypes';
import type { StoryNarrativeStyle } from '@canonry/world-schema';

export function parsePlotStructure(
  rawPlot: Record<string, unknown>,
  style: StoryNarrativeStyle
): ChroniclePlot {
  const plotType = style.plotStructure.type;
  if (plotType === 'three-act') {
    validateThreeActPlot(rawPlot);
  }

  const normalizedBeats = extractNormalizedBeats(rawPlot, plotType);

  return {
    type: plotType,
    raw: rawPlot,
    normalizedBeats,
  };
}

function validateThreeActPlot(rawPlot: Record<string, unknown>): void {
  const inciting = rawPlot.inciting_incident as Record<string, unknown> | undefined;
  const rising = rawPlot.rising_action as Array<Record<string, unknown>> | undefined;
  const climax = rawPlot.climax as Record<string, unknown> | undefined;
  const resolution = rawPlot.resolution as Record<string, unknown> | undefined;

  if (!inciting || !climax || !resolution) {
    throw new Error('Three-act plot is missing required sections');
  }

  const validateBeat = (beat: Record<string, unknown>, label: string) => {
    if (typeof beat.description !== 'string') {
      throw new Error(`Three-act plot ${label} is missing description`);
    }
    if (!Array.isArray(beat.eventIds)) {
      throw new Error(`Three-act plot ${label} is missing eventIds`);
    }
  };

  validateBeat(inciting, 'inciting_incident');
  validateBeat(climax, 'climax');
  validateBeat(resolution, 'resolution');

  if (rising && !Array.isArray(rising)) {
    throw new Error('Three-act plot rising_action must be an array');
  }
  if (Array.isArray(rising)) {
    rising.forEach((beat, index) => {
      if (typeof beat.description !== 'string') {
        throw new Error(`Three-act plot rising_action[${index}] is missing description`);
      }
      if (!Array.isArray(beat.eventIds)) {
        throw new Error(`Three-act plot rising_action[${index}] is missing eventIds`);
      }
    });
  }
}

function extractNormalizedBeats(
  rawPlot: Record<string, unknown>,
  plotType: string
): PlotBeat[] {
  const beats: PlotBeat[] = [];

  switch (plotType) {
    case 'three-act':
      addBeatIfPresent(beats, rawPlot.inciting_incident);
      addBeatsFromArray(beats, rawPlot.rising_action);
      addBeatIfPresent(beats, rawPlot.dark_moment);
      addBeatIfPresent(beats, rawPlot.climax);
      addBeatIfPresent(beats, rawPlot.resolution);
      break;

    case 'episodic':
      addBeatIfPresent(beats, { description: rawPlot.setting_the_day as string });
      addBeatsFromArray(beats, rawPlot.vignettes);
      addBeatIfPresent(beats, { description: rawPlot.closing_reflection as string });
      break;

    case 'mystery-reveal':
      addBeatIfPresent(beats, rawPlot.initial_situation);
      addBeatsFromArray(beats, rawPlot.investigation);
      addBeatIfPresent(beats, rawPlot.false_trail);
      addBeatIfPresent(beats, rawPlot.true_revelation);
      break;

    case 'rise-and-fall':
      addBeatIfPresent(beats, { description: rawPlot.initial_greatness as string });
      addBeatIfPresent(beats, { description: `The flaw: ${rawPlot.the_flaw || ''}` });
      addBeatsFromArray(beats, rawPlot.rise);
      addBeatIfPresent(beats, rawPlot.hubris_moment);
      addBeatsFromArray(beats, rawPlot.fall);
      addBeatIfPresent(beats, { description: rawPlot.recognition as string });
      addBeatIfPresent(beats, rawPlot.catastrophe);
      break;

    case 'circular':
      addBeatIfPresent(beats, { description: rawPlot.opening_image as string });
      addBeatsFromArray(beats, rawPlot.wandering);
      addBeatIfPresent(beats, { description: rawPlot.accumulating_meaning as string });
      addBeatIfPresent(beats, rawPlot.return);
      break;

    case 'parallel':
      addBeatIfPresent(beats, { description: rawPlot.surface_situation as string });
      addBeatIfPresent(beats, { description: rawPlot.hidden_situation as string });
      addBeatsFromArray(beats, rawPlot.thread_a);
      addBeatsFromArray(beats, rawPlot.thread_b);
      addBeatIfPresent(beats, rawPlot.convergence);
      addBeatIfPresent(beats, rawPlot.new_equilibrium);
      break;

    case 'in-medias-res':
      addBeatIfPresent(beats, rawPlot.opening_action);
      addBeatIfPresent(beats, { description: rawPlot.brief_context as string });
      addBeatsFromArray(beats, rawPlot.escalating_obstacles);
      addBeatIfPresent(beats, { description: rawPlot.false_victory_or_defeat as string });
      addBeatIfPresent(beats, rawPlot.final_confrontation);
      addBeatIfPresent(beats, rawPlot.escape_or_triumph);
      break;

    case 'accumulating':
      addBeatIfPresent(beats, rawPlot.initial_problem);
      addBeatsFromArray(beats, rawPlot.escalations);
      addBeatIfPresent(beats, { description: rawPlot.point_of_no_return as string });
      addBeatIfPresent(beats, rawPlot.catastrophic_resolution);
      break;

    default:
      for (const [key, value] of Object.entries(rawPlot)) {
        if (Array.isArray(value)) {
          addBeatsFromArray(beats, value);
        } else if (typeof value === 'object' && value !== null) {
          addBeatIfPresent(beats, value as Record<string, unknown>);
        } else if (typeof value === 'string' && value.length > 10) {
          beats.push({ description: `${key}: ${value}`, eventIds: [] });
        }
      }
  }

  return beats;
}

function addBeatIfPresent(
  beats: PlotBeat[],
  value: Record<string, unknown> | string | undefined | null
): void {
  if (!value) return;

  if (typeof value === 'string') {
    if (value.trim().length > 0) {
      beats.push({ description: value, eventIds: [] });
    }
    return;
  }

  if (typeof value === 'object' && value.description) {
    beats.push({
      description: value.description as string,
      eventIds: (value.eventIds as string[]) || [],
    });
  }
}

function addBeatsFromArray(beats: PlotBeat[], value: unknown): void {
  if (!Array.isArray(value)) return;

  for (const item of value) {
    if (typeof item === 'object' && item !== null) {
      addBeatIfPresent(beats, item as Record<string, unknown>);
    }
  }
}
