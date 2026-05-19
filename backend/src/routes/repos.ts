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
