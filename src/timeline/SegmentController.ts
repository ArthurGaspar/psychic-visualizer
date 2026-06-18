import type { Segment } from './types'

export interface ActiveSections {
  primary: Segment | null
  secondary: Segment | null   // incoming during overlap
  transitionProgress: number  // 0 = transition start, 1 = fully settled
}

export class SegmentController {
  private segments: Segment[] = []

  setSegments(segments: Segment[]) {
    this.segments = [...segments].sort((a, b) => a.startTime - b.startTime)
  }

  getActiveSections(time: number): ActiveSections {
    const active = this.segments.filter(s => time >= s.startTime && time < s.endTime)

    if (active.length === 0) return { primary: null, secondary: null, transitionProgress: 1 }
    if (active.length === 1) return { primary: active[0], secondary: null, transitionProgress: 1 }

    // Two overlapping segments — earlier one is outgoing (secondary), later is incoming (primary)
    const [outgoing, incoming] = active.sort((a, b) => a.startTime - b.startTime)
    const overlapStart = incoming.startTime
    const overlapEnd = Math.min(outgoing.endTime, incoming.endTime)
    const overlapDuration = overlapEnd - overlapStart
    const progress = overlapDuration > 0 ? (time - overlapStart) / overlapDuration : 1

    return {
      primary: incoming,
      secondary: outgoing,
      transitionProgress: Math.min(progress, 1),
    }
  }

  // Legacy single-segment accessor used by full-auto mode
  getActiveSegment(time: number): Segment | null {
    return this.getActiveSections(time).primary
  }
}
