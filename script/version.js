const fs = require('fs');

const pkg = JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }));
const versionString = `export const version = '${pkg.name}@${pkg.version}';`;

fs.writeFileSync('src/_version.ts', versionString);
