const https = require('https');

function get(p) {
  return new Promise((r, x) => {
    https.get('https://argus-agent-production-ab97.up.railway.app' + p, { headers: { Accept: 'application/json' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { r(JSON.parse(d)) } catch { r(d) } });
    }).on('error', x);
  });
}

async function main() {
  const t = await get('/treasury');
  const s = await get('/sources');
  const e = await get('/elo');

  const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', white: '\x1b[37m' };

  console.log(C.cyan + '     █████╗ ██████╗  ██████╗ ██╗   ██╗███████╗' + C.reset);
  console.log(C.cyan + '    ██╔══██╗██╔══██╗██╔════╝ ██║   ██║██╔════╝' + C.reset);
  console.log(C.cyan + '    ███████║██████╔╝██║  ███╗██║   ██║███████╗' + C.reset);
  console.log(C.cyan + '    ██╔══██║██╔══██╗██║   ██║██║   ██║╚════██║' + C.reset);
  console.log(C.cyan + '    ██║  ██║██║  ██║╚██████╔╝╚██████╔╝███████║' + C.reset);
  console.log(C.cyan + '    ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝' + C.reset);
  console.log(C.dim + '       Three eyes. One verdict. — argusarc.xyz' + C.reset);
  console.log('');
  console.log('');
  console.log(C.bold + '  ARGUS LIVE' + C.reset + '  ·  Arc Testnet (5042002)  ·  ' + new Date().toISOString().slice(0, 10));
  console.log('');
  console.log('  ' + C.bold + 'Scans' + C.reset + '        ' + C.green + t.stats.queries + C.reset);
  console.log('  ' + C.bold + 'Consensus' + C.reset + '    ' + C.green + t.stats.consensusReached + C.reset + '  (' + t.stats.avgConfidence + '%)');
  console.log('  ' + C.bold + 'Treasury' + C.reset + '     ' + C.yellow + '$' + t.treasury.balance + ' USDC' + C.reset);
  console.log('  ' + C.bold + 'On-Chain' + C.reset + '     ' + C.green + t.stats.onChainRecords + C.reset + '  records');
  console.log('  ' + C.bold + 'Users' + C.reset + '        ' + C.green + s.assigned + C.reset + '  (Web ' + s.sources.web + ' · CLI ' + s.sources.cli + ' · TG ' + s.sources.telegram + ')');
  console.log('');
  console.log(C.bold + '  Agent ELO' + C.reset);
  for (const a of (e.agents || [])) {
    const bar = '▓'.repeat(Math.round(a.accuracy / 10)) + '░'.repeat(10 - Math.round(a.accuracy / 10));
    console.log('  ' + (a.name || '').padEnd(10) + '  ' + bar + '  ' + a.accuracy + '%  ' + a.elo + ' ELO');
  }
  console.log('');
  console.log(C.dim + '  Web  argusarc.xyz' + C.reset);
  console.log(C.dim + '  CLI  npx argus-scan@latest' + C.reset);
  console.log(C.dim + '  TG   t.me/argus_arc_bot' + C.reset);
}

main().catch(e => console.error(e.message));

