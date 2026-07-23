import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const git = process.env.VYNODENEW_GIT || 'C:\\Users\\Michael\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\git\\cmd\\git.exe';
const sources = [
  ['C:\\Users\\Michael\\OneDrive\\Documents\\VynodeComplete\\VynodeRadarr', 'de4811318ef1eb6560a5e480cc4bba2afc008ca9'],
  ['C:\\Users\\Michael\\OneDrive\\Documents\\VynodeComplete\\VynodeSonarr', 'a29f15e92bd2c21e646d065d9d78066952cac05d']
];

test('reviewed source repositories remain at their baseline commits and clean', () => {
  for (const [path, commit] of sources) {
    assert.equal(execFileSync(git, ['-C', path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), commit);
    assert.equal(execFileSync(git, ['-C', path, 'status', '--porcelain=v1'], { encoding: 'utf8' }).trim(), '');
  }
});
