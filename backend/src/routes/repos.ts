import { Router } from "express";
import { join } from "path";
import { existsSync } from "fs";
import { simpleGit } from "simple-git";
import { listRepos, getRepoStats } from "../gitReader.js";

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
