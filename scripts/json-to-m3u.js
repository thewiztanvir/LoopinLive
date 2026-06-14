const fs = require('fs');
const path = require('path');

// Resolve default paths relative to the project root
const defaultDataDir = path.join(__dirname, '../app/data');
const args = process.argv.slice(2);

console.log('🔄 IPTV Channel Converter (JSON -> M3U)');

function getOutputPathForInput(inputFilePath) {
  const dir = path.dirname(inputFilePath);
  const base = path.basename(inputFilePath, '.json');
  return path.join(dir, `${base}.m3u`);
}

function convertSingleFile(inputFilePath, outputFilePath) {
  console.log(`\n📂 Input JSON:  ${inputFilePath}`);
  console.log(`💾 Output M3U: ${outputFilePath}\n`);

  if (!fs.existsSync(inputFilePath)) {
    throw new Error(`Input file does not exist at "${inputFilePath}"`);
  }

  const rawData = fs.readFileSync(inputFilePath, 'utf8');
  const channels = JSON.parse(rawData);

  if (!Array.isArray(channels)) {
    throw new Error('JSON root element must be an array of channel objects.');
  }

  console.log(`📊 Found ${channels.length} channels. Converting...`);

  const m3uLines = ['#EXTM3U'];

  channels.forEach((channel, index) => {
    if (!channel.url) {
      console.warn(`⚠️ Warning: Channel at index ${index} ("${channel.name || 'Unnamed'}") has no URL. Skipping.`);
      return;
    }

    let extinf = '#EXTINF:-1';

    if (channel.logo) {
      extinf += ` tvg-logo="${channel.logo}"`;
    }

    if (channel.group) {
      extinf += ` group-title="${channel.group}"`;
    }

    extinf += `,${channel.name || 'Unnamed Channel'}`;

    m3uLines.push(extinf);
    m3uLines.push(channel.url);
  });

  const outputDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFilePath, m3uLines.join('\n') + '\n', 'utf8');

  console.log(`✅ Success! M3U playlist generated at: "${outputFilePath}"`);
  console.log(`📝 Total channels in M3U: ${Math.max(0, m3uLines.length / 2 - 0.5)}\n`);
}

if (args.length === 0) {
  console.log(`📁 No arguments passed. Converting all JSON files in: ${defaultDataDir}`);
  const files = fs.readdirSync(defaultDataDir).filter(file => path.extname(file).toLowerCase() === '.json');

  if (files.length === 0) {
    console.error(`❌ No JSON files found in ${defaultDataDir}`);
    process.exit(1);
  }

  let failed = false;
  files.forEach(file => {
    const inputFilePath = path.join(defaultDataDir, file);
    const outputFilePath = getOutputPathForInput(inputFilePath);
    try {
      convertSingleFile(inputFilePath, outputFilePath);
    } catch (error) {
      failed = true;
      console.error(`❌ Conversion failed for ${file}: ${error.message}`);
    }
  });

  if (failed) {
    process.exit(1);
  }
} else {
  const inputPath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : getOutputPathForInput(inputPath);

  try {
    convertSingleFile(inputPath, outputPath);
  } catch (error) {
    console.error('❌ Conversion failed with error:');
    console.error(error.message);
    process.exit(1);
  }
}
