export interface WebCrypto {
    getRandomValues<T extends Uint8Array>(array: T): T;
    subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };
}

let impl: WebCrypto | undefined;

export function setWebCrypto(crypto: WebCrypto): void {
    impl = crypto;
}

export function webCrypto(): WebCrypto {
    const crypto = impl ?? (globalThis as { crypto?: WebCrypto }).crypto;
    if (!crypto) throw new Error('Web Crypto is not available in this environment');
    return crypto;
}
