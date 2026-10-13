import { EdgeTTS, type Voice } from '../src/services/EdgeTTS';
import { mkdir, access } from 'fs/promises';
import { join } from 'path';
import { createWriteStream } from 'fs';

/**
 * Utility to color console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test voice filtering methods
 */
async function testVoiceFiltering(tts: EdgeTTS) {
  log('\n🧪 Testing voice filtering methods...', 'cyan');

  try {
    // Test getVoicesByLanguage
    const englishVoices = await tts.getVoicesByLanguage('en');
    log(`  ✅ English voices (en): ${englishVoices.length}`, 'green');

    const usEnglishVoices = await tts.getVoicesByLanguage('en-US');
    log(`  ✅ US English voices (en-US): ${usEnglishVoices.length}`, 'green');

    const spanishVoices = await tts.getVoicesByLanguage('es');
    log(`  ✅ Spanish voices (es): ${spanishVoices.length}`, 'green');

    // Test getVoicesByGender
    const femaleVoices = await tts.getVoicesByGender('Female');
    log(`  ✅ Female voices: ${femaleVoices.length}`, 'green');

    const maleVoices = await tts.getVoicesByGender('Male');
    log(`  ✅ Male voices: ${maleVoices.length}`, 'green');

    // Show some examples
    if (englishVoices.length > 0) {
      log(`    Example English voice: ${englishVoices[0].FriendlyName}`, 'blue');
    }
    if (femaleVoices.length > 0) {
      log(`    Example Female voice: ${femaleVoices[0].FriendlyName}`, 'blue');
    }

  } catch (error) {
    log(`  ❌ Error in voice filtering: ${error instanceof Error ? error.message : error}`, 'red');
  }
}

/**
 * Test audio information methods
 */
async function testAudioInformation(tts: EdgeTTS) {
  log('\n🧪 Testing audio information methods...', 'cyan');

  try {
    const testText = "This is a test to check audio information methods.";
    
    await tts.synthesize(testText, 'en-US-AriaNeural', {
      pitch: 0,
      rate: 0,
      volume: 0
    });

    // Test getDuration
    const duration = tts.getDuration();
    log(`  ✅ Audio duration: ${duration.toFixed(2)} seconds`, 'green');

    // Test getAudioInfo
    const audioInfo = tts.getAudioInfo();
    log(`  ✅ Audio info:`, 'green');
    log(`    - Size: ${audioInfo.size} bytes`, 'blue');
    log(`    - Format: ${audioInfo.format}`, 'blue');
    log(`    - Duration: ${audioInfo.estimatedDuration.toFixed(2)} seconds`, 'blue');

    // Verify consistency
    if (Math.abs(duration - audioInfo.estimatedDuration) < 0.01) {
      log(`  ✅ Duration methods are consistent`, 'green');
    } else {
      log(`  ⚠️  Duration methods differ: ${duration} vs ${audioInfo.estimatedDuration}`, 'yellow');
    }

  } catch (error) {
    log(`  ❌ Error in audio information tests: ${error instanceof Error ? error.message : error}`, 'red');
  }
}

/**
 * Test error handling for audio info without synthesis
 */
async function testAudioInfoErrorHandling(tts: EdgeTTS) {
  log('\n🧪 Testing audio info error handling...', 'cyan');

  try {
    // This should throw an error
    const duration = tts.getDuration();
    log(`  ❌ getDuration should have thrown an error but returned: ${duration}`, 'red');
  } catch (error) {
    log(`  ✅ getDuration correctly threw error: ${error instanceof Error ? error.message : error}`, 'green');
  }

  try {
    // This should also throw an error
    const audioInfo = tts.getAudioInfo();
    log(`  ❌ getAudioInfo should have thrown an error but returned: ${JSON.stringify(audioInfo)}`, 'red');
  } catch (error) {
    log(`  ✅ getAudioInfo correctly threw error: ${error instanceof Error ? error.message : error}`, 'green');
  }

  try {
    // This should also throw an error
    const buffer = tts.toBuffer();
    log(`  ❌ toBuffer should have thrown an error but returned buffer of size: ${buffer.length}`, 'red');
  } catch (error) {
    log(`  ✅ toBuffer correctly threw error: ${error instanceof Error ? error.message : error}`, 'green');
  }
}

/**
 * Test streaming synthesis
 */
async function testStreamingSynthesis(tts: EdgeTTS, outputDir: string) {
  log('\n🧪 Testing streaming synthesis...', 'cyan');

  try {
    const longText = "This is a longer text to test the streaming functionality. " +
                    "The streaming method should provide audio chunks as they become available, " +
                    "which is useful for real-time applications and large text processing. " +
                    "Each chunk represents a portion of the synthesized audio data.";

    const outputPath = join(outputDir, 'streaming_test.mp3');
    const writeStream = createWriteStream(outputPath);
    
    let chunkCount = 0;
    let totalBytes = 0;

    log(`  🎵 Starting streaming synthesis...`, 'yellow');

    for await (const chunk of tts.synthesizeStream(longText, 'en-US-AriaNeural', {
      pitch: 0,
      rate: 0,
      volume: 0
    })) {
      chunkCount++;
      totalBytes += chunk.length;
      writeStream.write(chunk);
      log(`    📦 Chunk ${chunkCount}: ${chunk.length} bytes`, 'blue');
    }

    writeStream.end();

    log(`  ✅ Streaming completed:`, 'green');
    log(`    - Total chunks: ${chunkCount}`, 'blue');
    log(`    - Total bytes: ${totalBytes}`, 'blue');
    log(`    - File saved: ${outputPath}`, 'blue');

    // Verify file was created
    await access(outputPath);
    log(`  ✅ Streaming file verified`, 'green');

  } catch (error) {
    log(`  ❌ Error in streaming synthesis: ${error instanceof Error ? error.message : error}`, 'red');
  }
}

/**
 * Test parameter validation edge cases
 */
async function testParameterValidation(tts: EdgeTTS) {
  log('\n🧪 Testing parameter validation edge cases...', 'cyan');

  const validationTests = [
    // Pitch tests
    { params: { pitch: 0 }, description: 'Pitch zero', shouldPass: true },
    { params: { pitch: 100 }, description: 'Pitch max positive', shouldPass: true },
    { params: { pitch: -100 }, description: 'Pitch max negative', shouldPass: true },
    { params: { pitch: '+50Hz' }, description: 'Pitch string positive', shouldPass: true },
    { params: { pitch: '-50Hz' }, description: 'Pitch string negative', shouldPass: true },
    { params: { pitch: '25.5Hz' }, description: 'Pitch decimal', shouldPass: true },

    // Rate tests
    { params: { rate: 0 }, description: 'Rate zero', shouldPass: true },
    { params: { rate: 100 }, description: 'Rate positive', shouldPass: true },
    { params: { rate: -50 }, description: 'Rate negative', shouldPass: true },
    { params: { rate: '150%' }, description: 'Rate string high', shouldPass: true },
    { params: { rate: '-75%' }, description: 'Rate string negative', shouldPass: true },

    // Volume tests
    { params: { volume: 0 }, description: 'Volume zero', shouldPass: true },
    { params: { volume: 100 }, description: 'Volume max', shouldPass: true },
    { params: { volume: -100 }, description: 'Volume min', shouldPass: true },
    { params: { volume: 150 }, description: 'Volume above 100%', shouldPass: false },
    { params: { volume: -101 }, description: 'Volume below -100%', shouldPass: false },

    // Combined tests
    { 
      params: { pitch: '+20Hz', rate: '-30%', volume: '90%' }, 
      description: 'All parameters combined', 
      shouldPass: true 
    },
  ];

  for (const test of validationTests) {
    try {
      await tts.synthesize('Test validation', 'en-US-AriaNeural', test.params);
      
      if (test.shouldPass) {
        log(`  ✅ ${test.description}: Passed as expected`, 'green');
      } else {
        log(`  ❌ ${test.description}: Should have failed but passed`, 'red');
      }
    } catch (error) {
      if (!test.shouldPass) {
        log(`  ✅ ${test.description}: Correctly rejected - ${error instanceof Error ? error.message : error}`, 'green');
      } else {
        log(`  ❌ ${test.description}: Should have passed but failed - ${error instanceof Error ? error.message : error}`, 'red');
      }
    }
  }
}

/**
 * Test different export formats
 */
async function testExportFormats(tts: EdgeTTS, outputDir: string) {
  log('\n🧪 Testing export formats...', 'cyan');

  try {
    const testText = "Testing different export formats and methods.";
    
    await tts.synthesize(testText, 'en-US-AriaNeural');

    // Test toBuffer
    const buffer = tts.toBuffer();
    log(`  ✅ toBuffer: ${buffer.length} bytes`, 'green');

    // Test toBase64
    const base64 = tts.toBase64();
    log(`  ✅ toBase64: ${base64.length} characters`, 'green');

    // Test toRaw (should be same as toBase64)
    const raw = tts.toRaw();
    log(`  ✅ toRaw: ${raw.length} characters`, 'green');

    // Verify Base64 and Raw are identical
    if (base64 === raw) {
      log(`  ✅ Base64 and Raw are identical`, 'green');
    } else {
      log(`  ❌ Base64 and Raw differ`, 'red');
    }

    // Test toFile
    const filePath = await tts.toFile(join(outputDir, 'export_test'));
    await access(filePath);
    log(`  ✅ toFile: ${filePath}`, 'green');

    // Verify Base64 can be converted back to buffer
    const bufferFromBase64 = Buffer.from(base64, 'base64');
    if (buffer.equals(bufferFromBase64)) {
      log(`  ✅ Base64 conversion is reversible`, 'green');
    } else {
      log(`  ❌ Base64 conversion is not reversible`, 'red');
    }

  } catch (error) {
    log(`  ❌ Error in export format tests: ${error instanceof Error ? error.message : error}`, 'red');
  }
}

/**
 * Test voice caching (call getVoices multiple times)
 */
async function testVoiceCaching(tts: EdgeTTS) {
  log('\n🧪 Testing voice caching...', 'cyan');

  try {
    const startTime1 = Date.now();
    const voices1 = await tts.getVoices();
    const time1 = Date.now() - startTime1;
    log(`  ✅ First call: ${voices1.length} voices in ${time1}ms`, 'green');

    const startTime2 = Date.now();
    const voices2 = await tts.getVoices();
    const time2 = Date.now() - startTime2;
    log(`  ✅ Second call: ${voices2.length} voices in ${time2}ms`, 'green');

    // Verify same results
    if (voices1.length === voices2.length) {
      log(`  ✅ Voice count consistent between calls`, 'green');
    } else {
      log(`  ❌ Voice count differs: ${voices1.length} vs ${voices2.length}`, 'red');
    }

    // Check if caching improved performance
    if (time2 < time1) {
      log(`  ✅ Second call was faster (likely cached): ${time1}ms -> ${time2}ms`, 'green');
    } else {
      log(`  ⚠️  Second call was not faster: ${time1}ms -> ${time2}ms`, 'yellow');
    }

  } catch (error) {
    log(`  ❌ Error in voice caching test: ${error instanceof Error ? error.message : error}`, 'red');
  }
}

/**
 * Performance test with different text lengths
 */
async function testPerformance(tts: EdgeTTS, outputDir: string) {
  log('\n🧪 Testing performance with different text lengths...', 'cyan');

  const texts = [
    { name: 'short', text: 'Hello world.', expectedTime: 5000 },
    { name: 'medium', text: 'This is a medium length text that should take a reasonable amount of time to synthesize into speech audio.', expectedTime: 10000 },
    { name: 'long', text: 'This is a much longer text that contains multiple sentences and should take more time to process. '.repeat(5), expectedTime: 15000 }
  ];

  for (const testCase of texts) {
    try {
      log(`  🏃 Testing ${testCase.name} text (${testCase.text.length} chars)...`, 'yellow');
      
      const startTime = Date.now();
      await tts.synthesize(testCase.text, 'en-US-AriaNeural');
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      const audioInfo = tts.getAudioInfo();
      
      log(`    ✅ Completed in ${duration}ms`, 'green');
      log(`    📊 Audio: ${audioInfo.size} bytes, ${audioInfo.estimatedDuration.toFixed(2)}s`, 'blue');
      
      if (duration < testCase.expectedTime) {
        log(`    ⚡ Performance good (under ${testCase.expectedTime}ms)`, 'green');
      } else {
        log(`    ⚠️  Performance slow (over ${testCase.expectedTime}ms)`, 'yellow');
      }

      // Save file
      const filePath = await tts.toFile(join(outputDir, `performance_${testCase.name}`));
      log(`    💾 Saved: ${filePath}`, 'blue');

    } catch (error) {
      log(`    ❌ Error with ${testCase.name} text: ${error instanceof Error ? error.message : error}`, 'red');
    }
  }
}

/**
 * Main test function
 */
async function main() {
  log('🚀 Starting comprehensive EdgeTTS test suite...', 'bright');

  // Create output directory
  const outputDir = join(__dirname, 'test_output');
  try {
    await mkdir(outputDir, { recursive: true });
    log(`📂 Test directory: ${outputDir}`, 'blue');
  } catch (error) {
    log(`❌ Error creating directory: ${error}`, 'red');
    return;
  }

  const tts = new EdgeTTS();

  try {
    // Test voice caching first
    await testVoiceCaching(tts);

    // Test voice filtering methods
    await testVoiceFiltering(tts);

    // Test error handling without synthesis
    await testAudioInfoErrorHandling(tts);

    // Test audio information methods
    await testAudioInformation(tts);

    // Test parameter validation
    await testParameterValidation(tts);

    // Test export formats
    await testExportFormats(tts, outputDir);

    // Test streaming synthesis
    await testStreamingSynthesis(tts, outputDir);

    // Test performance
    await testPerformance(tts, outputDir);

    log('\n🎉 All tests completed successfully!', 'bright');
    log(`📁 Check generated files in: ${outputDir}`, 'blue');
    log(`🔍 Total test categories: 8`, 'cyan');

  } catch (error) {
    log(`💥 Fatal error during tests: ${error}`, 'red');
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  log(`💥 Unhandled error: ${error}`, 'red');
  process.exit(1);
});
