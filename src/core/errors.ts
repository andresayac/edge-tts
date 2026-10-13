export type EdgeTTSErrorCode =
    | 'NO_AUDIO'
    | 'TIMEOUT'
    | 'HANDSHAKE'
    | 'NETWORK'
    | 'INVALID_OPTION'
    | 'REFUSED'
    | 'VOICES';

export class EdgeTTSError extends Error {
    readonly code: EdgeTTSErrorCode;
    readonly status?: number;

    constructor(message: string, code: EdgeTTSErrorCode, options: { status?: number; cause?: unknown } = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'EdgeTTSError';
        this.code = code;
        if (options.status !== undefined) this.status = options.status;
    }
}
