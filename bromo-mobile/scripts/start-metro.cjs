'use strict';

/**
 * Starts Metro with:
 * - `--host 0.0.0.0` so the phone can reach the packager on your LAN
 * - `REACT_NATIVE_PACKAGER_HOSTNAME` so HMR / "reload" sees the app as connected
 *
 * Run `npm run metro:sync-ip` first (or set METRO_LAN_HOST) so bromo-config.json has metroHost,
 * then rebuild the iOS app once for physical devices.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cfgPath = path.join(root, 'bromo-config.json');

try {
  execSync('node scripts/sync-metro-host.cjs', { cwd: root, stdio: 'inherit' });
} catch {
  console.warn('[start-metro] metro:sync-ip failed — continuing (simulator / manual host may still work).');
}

let host = '';
try {
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const cfg = JSON.parse(raw);
  host = String(cfg.metroHost ?? '').trim();
} catch {
  /* ignore */
}

const env = {...process.env};
if (host) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = host;
  console.info(`[start-metro] REACT_NATIVE_PACKAGER_HOSTNAME=${host}`);
} else {
  console.info(
    '[start-metro] No metroHost in bromo-config.json — physical device: run `npm run metro:sync-ip` (or METRO_LAN_HOST=192.168.1.12 npm run metro:sync-ip), rebuild iOS, then Dev Menu → bundle host should be this Mac’s IP:8081.',
  );
}

const rn = path.join(root, 'node_modules', '.bin', 'react-native');
const child = spawn(rn, ['start', '--host', '0.0.0.0'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
child.on('exit', code => {
  process.exit(code == null ? 0 : code);
});
child.on('error', err => {
  console.error('[start-metro]', err);
  process.exit(1);
});
