export interface Cue {
    offset: number;
    duration: number;
    text: string;
}

function timestamp(ticks: number, separator: string): string {
    const total = Math.max(0, Math.round(ticks / 10_000));
    const ms = total % 1000;
    const s = Math.floor(total / 1000) % 60;
    const m = Math.floor(total / 60_000) % 60;
    const h = Math.floor(total / 3_600_000);
    const pad = (n: number, width = 2) => String(n).padStart(width, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(ms, 3)}`;
}

export function toSRT(cues: Cue[]): string {
    return cues
        .map((cue, i) => `${i + 1}\n${timestamp(cue.offset, ',')} --> ${timestamp(cue.offset + cue.duration, ',')}\n${cue.text}\n`)
        .join('\n');
}

export function toVTT(cues: Cue[]): string {
    const body = cues
        .map(cue => `${timestamp(cue.offset, '.')} --> ${timestamp(cue.offset + cue.duration, '.')}\n${cue.text}\n`)
        .join('\n');
    return `WEBVTT\n\n${body}`;
}
