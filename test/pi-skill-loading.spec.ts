import { existsSync, readdirSync } from 'fs';
import * as path from 'path';
import { resolveBundledPiSkillsDir } from '../src/modules/agent/pi-skill-mapping';

describe('Pi skill loading', () => {
  it('ships bundled SKILL.md directories for every supported pi skill', () => {
    const root = resolveBundledPiSkillsDir();
    const skillDirs = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(skillDirs).toEqual(
      expect.arrayContaining([
        'document-generate',
        'task-breakdown',
        'code-analysis',
        'progress-summary',
        'weekly-report',
        'meeting-minutes',
        'requirement-analysis',
        'project-init',
        'environment-switch',
      ]),
    );

    for (const skillDir of skillDirs) {
      expect(existsSync(path.join(root, skillDir, 'SKILL.md'))).toBe(true);
    }
  });
});
