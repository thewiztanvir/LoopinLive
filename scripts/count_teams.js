const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=2026`;
  const data = await fetchUrl(url);
  const events = data.events || [];
  console.log(`Total events: ${events.length}`);
  
  const allTeams = new Set();
  events.forEach(ev => {
    const comp = ev.competitions[0];
    if (comp && comp.competitors) {
      comp.competitors.forEach(c => {
        if (c.team && c.team.name && !c.team.name.includes("Winner")) {
          allTeams.add(c.team.name);
        }
      });
    }
  });
  console.log(`Total teams found: ${allTeams.size}`);
  
  // Count by round
  const roundsMap = {};
  events.forEach(ev => {
     let r = ev.season?.slug || ev.season?.type?.name || "Unknown";
     roundsMap[r] = (roundsMap[r] || 0) + 1;
  });
  console.log("Matches by round:");
  console.log(roundsMap);
}
main();
