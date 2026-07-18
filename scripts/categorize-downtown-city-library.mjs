import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const libraryDirectory = resolve('libraries/downtown-city-megakit-standard');
const categories = [
  'Buildings',
  'Walls',
  'Doors & Windows',
  'Columns',
  'Roofs',
  'Trims & Cornices',
  'Floors & Entrances',
  'Streets & Sidewalks',
  'Road Decals',
  'Stairs & Railings',
  'Props',
];

function classify(fileName) {
  if (fileName.startsWith('Building_')) return ['Buildings', ['building', 'architecture']];
  if (fileName.startsWith('Decal_')) return ['Road Decals', ['road', 'marking', 'decal']];
  if (fileName.startsWith('Door')) return ['Doors & Windows', ['architecture', 'opening', 'door']];
  if (fileName.startsWith('Entrance_') || fileName.startsWith('Floor_')) {
    return ['Floors & Entrances', ['architecture', 'ground']];
  }
  if (fileName.startsWith('Prop_')) return ['Props', ['prop', 'street-furniture']];
  if (fileName.startsWith('Roof_')) return ['Roofs', ['architecture', 'roof']];
  if (fileName.startsWith('Sidewalk_') || fileName.startsWith('Street_')) {
    return ['Streets & Sidewalks', ['road', 'street']];
  }
  if (fileName.startsWith('Stairs_')) return ['Stairs & Railings', ['architecture', 'stairs']];
  if (fileName.startsWith('Cornice_') || fileName.startsWith('Trim_')) {
    return ['Trims & Cornices', ['architecture', 'trim']];
  }
  if (/^(Brick|Metal)_.*Column/.test(fileName)) return ['Columns', ['architecture', 'column']];
  if (/^(Brick|Metal)_.*Window/.test(fileName)) {
    return ['Doors & Windows', ['architecture', 'opening', 'window']];
  }
  if (/^(Brick|Metal)_/.test(fileName)) return ['Walls', ['architecture', 'wall']];
  throw new Error(`No category rule for ${fileName}`);
}

function uniqueTags(tags) {
  return [...new Set(tags.map((tag) => tag.toLowerCase()).filter(Boolean))];
}

const manifestPath = resolve(libraryDirectory, 'assets-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

for (const asset of manifest.assets) {
  const fileName = asset.fileName.split('/').at(-1).replace(/\.gltf$/i, '');
  const [category, categoryTags] = classify(fileName);
  asset.category = category;
  asset.tags = uniqueTags([
    'city',
    ...categoryTags,
    ...asset.tags.filter((tag) => tag !== 'floors'),
  ]);
}

const tagTemplates = {
  Buildings: ['city', 'building', 'architecture'],
  Walls: ['city', 'architecture', 'wall', 'brick', 'metal', 'interior', 'exterior'],
  'Doors & Windows': ['city', 'architecture', 'opening', 'door', 'window', 'frame'],
  Columns: ['city', 'architecture', 'column', 'brick', 'metal'],
  Roofs: ['city', 'architecture', 'roof', 'slate', 'corner', 'cornice'],
  'Trims & Cornices': ['city', 'architecture', 'trim', 'cornice', 'brick', 'metal'],
  'Floors & Entrances': ['city', 'architecture', 'ground', 'floor', 'entrance', 'concrete'],
  'Streets & Sidewalks': ['city', 'road', 'street', 'sidewalk', 'asphalt', 'lane', 'curb'],
  'Road Decals': ['city', 'road', 'marking', 'decal', 'crosswalk', 'arrow', 'yellow'],
  'Stairs & Railings': ['city', 'architecture', 'stairs', 'railing', 'metal', 'concrete'],
  Props: ['city', 'prop', 'street-furniture', 'bollard', 'planter', 'drain', 'ac'],
};

await Promise.all([
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  writeFile(
    resolve(libraryDirectory, 'asset-categories.json'),
    `${JSON.stringify({ version: 1, categories }, null, 2)}\n`,
    'utf8',
  ),
  writeFile(
    resolve(libraryDirectory, 'asset-tag-templates.json'),
    `${JSON.stringify({ version: 1, categories: tagTemplates }, null, 2)}\n`,
    'utf8',
  ),
]);

console.log(`Categorized ${manifest.assets.length} Downtown City assets.`);
