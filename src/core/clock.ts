let skewMs = 0;

export function now(): number {
    return Date.now() + skewMs;
}

// NOTE: the Date header has one-second resolution, so smaller differences are noise.
export function adjustClock(serverTimeMs: number): boolean {
    const delta = serverTimeMs - now();
    if (!Number.isFinite(delta) || Math.abs(delta) < 2000) return false;
    skewMs += delta;
    return true;
}

export function resetClock(): void {
    skewMs = 0;
}
