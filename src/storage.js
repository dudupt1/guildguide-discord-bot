import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filePath = fileURLToPath(import.meta.url);
const directoryPath = path.dirname(filePath);
const dataPath = path.resolve(directoryPath, '../data.json');

const emptyData = () => ({
  tickets: {},
  suggestions: {},
  warnings: {},
  tasks: {},
});

function normalise(data) {
  return {
    ...emptyData(),
    ...data,
    tickets: data?.tickets ?? {},
    suggestions: data?.suggestions ?? {},
    warnings: data?.warnings ?? {},
    tasks: data?.tasks ?? {},
  };
}

function readData() {
  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    return normalise(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') {
      const initial = emptyData();
      fs.writeFileSync(dataPath, JSON.stringify(initial, null, 2));
      return initial;
    }

    throw new Error(`Could not read data.json: ${error.message}`);
  }
}

function writeData(data) {
  const temporaryPath = `${dataPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
  fs.renameSync(temporaryPath, dataPath);
}

export function getData() {
  return structuredClone(readData());
}

export function updateData(mutator) {
  const data = readData();
  const result = mutator(data);
  writeData(data);
  return result;
}
