#!/usr/bin/env node

const {spawnSync} = require('node:child_process');

const allowed = [
  'src/screens/ProfileScreen.tsx',
  'src/screens/EditProfileScreen.tsx',
  'src/context/AuthContext.tsx',
  'src/api/authApi.ts',
];
const args = [
  '-n',
  '\\b(profile|target|user)\\.(email|phone)\\b',
  'src',
  ...allowed.flatMap(path => ['--glob', `!${path}`]),
];
const result = spawnSync('rg', args, {cwd: __dirname + '/..', encoding: 'utf8'});

if (result.status === 0) {
  process.stderr.write(result.stdout);
  process.stderr.write('Public profile/contact fields must stay out of non-self surfaces. Use AuthContext/EditProfile/Profile only.\\n');
  process.exit(1);
}

if (result.status !== 1) {
  process.stderr.write(result.stderr || 'Privacy check failed to run.\\n');
  process.exit(result.status ?? 1);
}
