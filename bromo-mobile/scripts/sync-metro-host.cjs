'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cfgPath = path.join(root, 'bromo-config.json');

function detectIp() {
  const ifaces = ['en0', 'en1', 'en2'];
  for (const iface of ifaces) {
    try {
      const ip = execSync(`ipconfig getifaddr ${iface}`, { encoding: 'utf8' }).trim();
      if (ip) return ip;
    } catch {
      // try next
    }
  }
  throw new Error(
    'Could not detect LAN IP (tried en0/en1/en2). Connect Wi‑Fi and run again, or set metroHost manually in bromo-config.json.',
  );
}

const ip = detectIp();
const raw = fs.readFileSync(cfgPath, 'utf8');
const cfg = JSON.parse(raw);
cfg.metroHost = ip;
fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(`Updated ${path.relative(root, cfgPath)} → metroHost: ${ip}`);
console.log('Rebuild the iOS app once so the bundled bromo-config.json updates on device.');
