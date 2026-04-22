'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cfgPath = path.join(root, 'bromo-config.json');
/** Monorepo root `bromo/bromo-config.json` (used by bromo-web); optional mirror so editors see the same metroHost. */
const monorepoCfgPath = path.join(root, '..', 'bromo-config.json');

function mergeMetroHostIntoMonorepo(metroHost) {
  try {
    if (!fs.existsSync(monorepoCfgPath)) return;
    const raw = fs.readFileSync(monorepoCfgPath, 'utf8');
    const obj = JSON.parse(raw);
    obj.metroHost = metroHost;
    fs.writeFileSync(monorepoCfgPath, `${JSON.stringify(obj, null, 2)}\n`);
    console.log(`Updated ${path.relative(root, monorepoCfgPath)} → metroHost: ${metroHost || '(cleared)'}`);
  } catch (e) {
    console.warn('[metro:sync-ip] Could not mirror metroHost to repo-root bromo-config.json:', e.message);
  }
}

function detectIp() {
  const envHost = (process.env.METRO_LAN_HOST || process.env.BROMO_METRO_HOST || '').trim();
  if (envHost) return envHost;

  const ifaces = ['en0', 'en1', 'en2', 'en3'];
  for (const iface of ifaces) {
    try {
      const ip = execSync(`ipconfig getifaddr ${iface}`, { encoding: 'utf8' }).trim();
      if (ip) return ip;
    } catch {
      // try next
    }
  }
  return null;
}

function detectBonjourHost() {
  try {
    const localHostName = execSync('scutil --get LocalHostName', { encoding: 'utf8' }).trim();
    if (!localHostName) return null;
    // Bonjour host is stable across DHCP IP changes on the same machine.
    return `${localHostName}.local`;
  } catch {
    return null;
  }
}

function detectMetroHost() {
  const envHost = (process.env.METRO_LAN_HOST || process.env.BROMO_METRO_HOST || '').trim();
  if (envHost) return envHost;

  // Default to a stable hostname so device reconnect survives LAN IP changes.
  const bonjour = detectBonjourHost();
  if (bonjour) return bonjour;

  return detectIp();
}

function main() {
  let raw;
  try {
    raw = fs.readFileSync(cfgPath, 'utf8');
  } catch (e) {
    console.error(`Missing ${cfgPath}:`, e.message);
    process.exit(1);
  }

  const cfg = JSON.parse(raw);
  const prev = String(cfg.metroHost ?? '').trim();
  const looksLikePlaceholder = (h) => !h || h.toLowerCase().includes('x.x');
  const metroHost = detectMetroHost();

  if (!metroHost) {
    if (looksLikePlaceholder(prev)) {
      cfg.metroHost = '';
      fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
      mergeMetroHostIntoMonorepo('');
      console.warn('[metro:sync-ip] Cleared invalid metroHost placeholder from bromo-config.json.');
    }
    console.warn(
      '[metro:sync-ip] Could not detect a usable Metro host (Bonjour hostname or LAN IP). ' +
        'Set METRO_LAN_HOST=192.168.1.12 (or My-Mac.local) and run again, or edit metroHost in bromo-config.json.',
    );
    if (!looksLikePlaceholder(prev)) {
      console.warn('[metro:sync-ip] Leaving metroHost unchanged.');
    }
    process.exit(0);
  }

  cfg.metroHost = metroHost;
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  mergeMetroHostIntoMonorepo(metroHost);
  console.log(`Updated ${path.relative(root, cfgPath)} → metroHost: ${metroHost}`);
  console.log('Rebuild the iOS app once so bundled bromo-config.json matches (physical device).');
}

main();
