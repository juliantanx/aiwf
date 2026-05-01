import simpleGit, { SimpleGit } from 'simple-git';
import type { GitContext } from '../core/types.js';

let gitInstance: SimpleGit | null = null;

function getGit(basePath: string): SimpleGit {
  if (!gitInstance) {
    gitInstance = simpleGit(basePath);
  }
  return gitInstance;
}

export async function getGitContext(basePath: string = process.cwd()): Promise<GitContext> {
  const git = getGit(basePath);

  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return {
        branch: '',
        commit: '',
      };
    }

    const [branch, commit, remotes] = await Promise.all([
      git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'unknown'),
      git.revparse(['HEAD']).catch(() => ''),
      git.getRemotes(true).catch(() => []),
    ]);

    let author = '';
    try {
      const log = await git.log(['-1']);
      author = log.latest?.author_email ?? '';
    } catch {
      // Ignore errors
    }

    return {
      branch: branch.trim(),
      commit: commit.trim().slice(0, 7),
      author,
      remote: remotes[0]?.refs?.fetch ?? remotes[0]?.refs?.push,
    };
  } catch {
    return {
      branch: '',
      commit: '',
    };
  }
}

export async function isGitRepo(basePath: string = process.cwd()): Promise<boolean> {
  const git = getGit(basePath);
  try {
    return await git.checkIsRepo();
  } catch {
    return false;
  }
}

export async function installGitHook(
  basePath: string,
  hookName: string,
  content: string
): Promise<void> {
  const git = getGit(basePath);
  const gitDir = await git.revparse(['--git-dir']);
  const hookPath = `${gitDir}/hooks/${hookName}`;

  const fs = await import('fs/promises');
  await fs.mkdir(`${gitDir}/hooks`, { recursive: true });
  await fs.writeFile(hookPath, content, { mode: 0o755 });
}

export async function uninstallGitHook(
  basePath: string,
  hookName: string
): Promise<boolean> {
  const git = getGit(basePath);
  const gitDir = await git.revparse(['--git-dir']);
  const hookPath = `${gitDir}/hooks/${hookName}`;

  const fs = await import('fs/promises');
  try {
    await fs.unlink(hookPath);
    return true;
  } catch {
    return false;
  }
}

export async function getGitHookPath(basePath: string): Promise<string> {
  const git = getGit(basePath);
  const gitDir = await git.revparse(['--git-dir']);
  return `${gitDir}/hooks`;
}

export async function getDiff(basePath: string, baseBranch: string = 'main'): Promise<string> {
  const git = getGit(basePath);
  try {
    return await git.diff([baseBranch, 'HEAD']);
  } catch {
    // If base branch doesn't exist, try to get staged changes
    return await git.diff(['--cached']);
  }
}
