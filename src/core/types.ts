export interface Voice {
    Name: string;
    ShortName: string;
    Gender: string;
    Locale: string;
    FriendlyName: string;
    LocalName: string;
    DisplayName?: string;
    LocaleName?: string;
    VoiceType?: string;
    SecondaryLocaleList?: string[];
    VoiceTag?: {
        TailoredScenarios: string[];
        VoicePersonalities: string[];
    };
}

export type OutputFormat =
    | 'audio-24khz-48kbitrate-mono-mp3'
    | 'audio-24khz-96kbitrate-mono-mp3'
    | 'webm-24khz-16bit-mono-opus';

export interface SynthesisOptions {
    pitch?: string | number;
    rate?: string | number;
    volume?: string | number;
    outputFormat?: OutputFormat | (string & {});
    signal?: AbortSignal;
    timeout?: number;
}

export interface WordBoundary {
    type: "WordBoundary";
    offset: number;
    duration: number;
    text: string;
}

export interface SentenceBoundary {
    type: "SentenceBoundary";
    offset: number;
    duration: number;
    text: string;
}

export interface EdgeTTSOptions {
    wssUrl?: string;
    voicesUrl?: string;
    secMsGecVersion?: string;
    headers?: Record<string, string>;
    timeout?: number;
    voicesCacheTtl?: number;
}

export interface SynthesisResult {
    audio: Uint8Array;
    format: string;
    outputFormat: string;
    wordBoundaries: WordBoundary[];
    sentenceBoundaries: SentenceBoundary[];
    duration: number;
}
