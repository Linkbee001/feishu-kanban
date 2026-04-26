import * as path from 'path';

export function resolveBundledPiSkillsDir(rootDir = process.cwd()) {
  return path.join(rootDir, 'pi-skills');
}
