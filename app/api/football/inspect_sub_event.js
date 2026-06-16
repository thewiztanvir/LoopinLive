const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Origin": "https://www.espn.com",
      "Referer": "https://www.espn.com/"
    };
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const eventId = "740966";
  const slug = "eng.1";
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
  
  try {
    const summary = await fetchUrl(url);
    if (summary.keyEvents) {
      const subEvent = summary.keyEvents.find(e => e.type && e.type.type.includes('sub'));
      if (subEvent) {
        console.log('--- RAW SUB EVENT ---');
        console.log(JSON.stringify(subEvent, null, 2));
      } else {
        console.log('No sub event found in this match.');
      }
    }
  } catch (err) {
    console.error(err);
  }
}

main();
