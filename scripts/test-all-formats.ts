import { EdgeTTS } from '../src/services/EdgeTTS';
import { Constants } from '../src/config/constants';

interface FormatTestResult {
    formatKey: string;
    formatValue: string;
    compatible: boolean;
    error?: string;
}

async function testSingleFormat(formatKey: string, formatValue: string): Promise<FormatTestResult> {
    const tts = new EdgeTTS();
    const testText = "Test";
    const voice = "en-US-AnaNeural";

    try {
        const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 10000)
        );
        
        const synthesizePromise = tts.synthesize(testText, voice, { outputFormat: formatValue });
        await Promise.race([synthesizePromise, timeoutPromise]);
        
        const buffer = tts.toBuffer();
        if (buffer.length === 0) {
            throw new Error("No audio data");
        }

        return { formatKey, formatValue, compatible: true };
    } catch (error: any) {
        return { formatKey, formatValue, compatible: false, error: error.message };
    }
}

async function testAllFormats() {
    console.log('🧪 TESTING ALL AUDIO FORMATS');
    console.log('============================\n');

    const formats = Constants.OUTPUT_FORMAT;
    const results: FormatTestResult[] = [];
    
    let tested = 0;
    const total = Object.keys(formats).length;

    for (const [key, value] of Object.entries(formats)) {
        tested++;
        console.log(`[${tested}/${total}] Testing ${key}...`);
        
        const result = await testSingleFormat(key, value);
        results.push(result);
        
        console.log(result.compatible ? `     ✅ COMPATIBLE` : `     ❌ INCOMPATIBLE: ${result.error}`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ COMPATIBLE FORMATS:\n');
    
    const compatible = results.filter(r => r.compatible);
    compatible.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.formatKey}`);
    });

    console.log('\n' + '='.repeat(50));
    console.log('❌ INCOMPATIBLE FORMATS:\n');
    
    const incompatible = results.filter(r => !r.compatible);
    if (incompatible.length === 0) {
        console.log('   (None - All formats are compatible!)');
    } else {
        incompatible.forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.formatKey} - ${r.error}`);
        });
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 SUMMARY:`);
    console.log(`   Total: ${total}`);
    console.log(`   Compatible: ${compatible.length} ✅`);
    console.log(`   Incompatible: ${incompatible.length} ❌`);
    console.log(`   Success Rate: ${((compatible.length / total) * 100).toFixed(1)}%`);
    console.log('='.repeat(50) + '\n');

    if (compatible.length > 0) {
        console.log('📋 COMPATIBLE FORMATS LIST:');
        const formatNames = compatible.map(r => r.formatKey);
        for (let i = 0; i < formatNames.length; i += 3) {
            console.log('   ' + formatNames.slice(i, i + 3).join(', '));
        }
    }
    console.log('');
}

testAllFormats()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\n❌ Test failed:', err);
        process.exit(1);
    });
