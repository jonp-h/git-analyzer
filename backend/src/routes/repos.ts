import { Router } from "express";
import { join } from "path";
import { existsSync } from "fs";
import { simpleGit } from "simple-git";
import {
  listRepos,
  getRepoStats,
  getFileBlame,
  getCommitDiff,
} from "../gitReader.js";
import {
  getGitHubRemote,
  fetchGitHubData,
  type GitHubDataResponse,
} from "../github.js";

export function reposRouter(reposDir: string) {
  const router = Router();

  router.get("/", (_req, res) => {
    const repos = listRepos(reposDir);
    res.json(repos);
  });

  router.get("/:name/stats", async (req, res) => {
    try {
      const stats = await getRepoStats(reposDir, req.params.name);
      res.json(stats);
    } catch (err) {
      console.error("Error reading repo:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:name/blame", async (req, res) => {
    const { file } = req.query;
    if (typeof file !== "string" || !file) {
      res.status(400).json({ error: "Missing ?file= query parameter" });
      return;
    }
    try {
      const lines = await getFileBlame(reposDir, req.params.name, file);
      res.json(lines);
    } catch (err) {
      console.error("git blame error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:name/commit/:hash/diff", async (req, res) => {
    const { hash } = req.params;
    if (!/^[0-9a-f]{4,64}$/i.test(hash)) {
      res.status(400).json({ error: "Invalid commit hash" });
      return;
    }
    try {
      const diff = await getCommitDiff(reposDir, req.params.name, hash);
      res.json(diff);
    } catch (err) {
      console.error("git diff error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:name/github-data", async (req, res) => {
    const repoPath = join(reposDir, req.params.name);
    if (!existsSync(repoPath)) {
      res
        .status(404)
        .json({
          error: "Repo not found",
        } satisfies Partial<GitHubDataResponse>);
      return;
    }
    if (!process.env.GITHUB_TOKEN) {
      res.json({
        prs: [],
        issues: [],
        remote: null,
        error: "GITHUB_TOKEN not configured",
      } satisfies GitHubDataResponse);
      return;
    }
    const remote = await getGitHubRemote(repoPath);
    if (!remote) {
      res.json({
        prs: [],
        issues: [],
        remote: null,
        error: "Not a GitHub-hosted repo",
      } satisfies GitHubDataResponse);
      return;
    }
    try {
      const { prs, issues } = await fetchGitHubData(remote.owner, remote.repo);
      res.json({
        prs,
        issues,
        owner: remote.owner,
        repo: remote.repo,
        remote: remote.url,
      } satisfies GitHubDataResponse);
    } catch (err) {
      console.error("GitHub API error:", err);
      res.json({
        prs: [],
        issues: [],
        remote: remote.url,
        error: String(err),
      } satisfies GitHubDataResponse);
    }
  });

  router.post("/:name/pull", async (req, res) => {
    const repoPath = join(reposDir, req.params.name);
    if (!existsSync(repoPath)) {
      res.status(404).json({ error: "Repo not found" });
      return;
    }
    try {
      const git = simpleGit(repoPath);
      const result = await git.pull();
      res.json({ summary: result.summary, files: result.files });
    } catch (err) {
      console.error("git pull error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
