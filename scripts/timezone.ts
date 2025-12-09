// timezone-test-complete.ts
import WebSocket from "ws";
import { randomUUID } from "crypto";

// Función para obtener fecha/hora completa en formato RFC1123
function getFullDateTime(timeZone) {
    const now = new Date();
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone,
        timeZoneName: 'short'
    };
    
    return now.toLocaleString('en-US', options);
}

// Generar SecMsGec
async function generateSecMsGec(token, timeZone = 'UTC') {
    const date = new Date();
    const tzOptions = { timeZone };
    const localTime = new Date(date.toLocaleString('en-US', tzOptions));
    const ticks = Math.floor(localTime.getTime() / 1000) + 11644473600;
    const rounded = ticks - (ticks % 300);
    const windowsTicks = rounded * 10000000;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(`${windowsTicks}${token}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

// Test individual para cada zona horaria
async function testZone(timeZone, subscriptionKey) {
    return new Promise(async (resolve) => {
        try {
            const fullDateTime = getFullDateTime(timeZone);
            const secMsGEC = await generateSecMsGec(subscriptionKey, timeZone);
            
            const url = `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1` +
                `?Ocp-Apim-Subscription-Key=${encodeURIComponent(subscriptionKey)}` +
                `&Sec-MS-GEC=${encodeURIComponent(secMsGEC)}` +
                `&Sec-MS-GEC-Version=1-140.0.3485.14` +
                `&ConnectionId=${randomUUID().replace(/-/g, "").slice(0, 32)}`;
            
            const ws = new WebSocket(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0"
                },
                perMessageDeflate: true,
            });
            
            let result: { zone: string; dateTime: string; status: string; code: number | null } = { 
                zone: timeZone, 
                dateTime: fullDateTime, 
                status: '❌', 
                code: null 
            };
            
            const timeout = setTimeout(() => {
                ws.close();
                resolve(result);
            }, 3000);
            
            ws.on("open", () => {
                result.status = '✅';
                result.code = 101;
                clearTimeout(timeout);
                ws.close();
                resolve(result);
            });
            
            ws.on("close", (code) => {
                if (!result.code) result.code = code;
                clearTimeout(timeout);
                resolve(result);
            });
            
            ws.on('error', (err: any) => {
                console.error(`WebSocket error in zone ${timeZone}:`, err?.message);
                clearTimeout(timeout);
                resolve(result);
            });
            
        } catch {
            resolve({ 
                zone: timeZone, 
                dateTime: 'Error', 
                status: '❌', 
                code: null 
            });
        }
    });
}

// Función principal
async function main() {
    const SUBSCRIPTION_KEY = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    const zones = Intl.supportedValuesOf("timeZone");
    
    console.log(`Testing ${zones.length} timezones...\n`);
    console.log("Zone".padEnd(30) + " | " + "DateTime".padEnd(40) + " | Status | Code");
    console.log("-".repeat(90));
    
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < zones.length; i += batchSize) {
        const batch = zones.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(zone => testZone(zone, SUBSCRIPTION_KEY))
        );
        
        batchResults.forEach(r => {
            console.log(
                `${r.zone.padEnd(30)} | ${r.dateTime.padEnd(40)} | ${r.status}     | ${r.code || 'N/A'}`
            );
            results.push(r);
        });
    }
    
    // Resumen final
    const success = results.filter(r => r.status === '✅').length;
    console.log(`\n${"-".repeat(90)}`);
    console.log(`Total: ${results.length} | ✅ ${success} | ❌ ${results.length - success}`);
    console.log(`Success rate: ${((success / results.length) * 100).toFixed(2)}%`);
    
    // Mostrar solo las zonas exitosas si hay alguna
    if (success > 0) {
        console.log("\n✅ Successful zones:");
        results.filter(r => r.status === '✅').forEach(r => {
            console.log(`  - ${r.zone}: ${r.dateTime}`);
        });
    }
}

// Ejecutar
main().catch(console.error);
