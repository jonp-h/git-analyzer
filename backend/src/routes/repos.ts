import { Router } from "express";
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

  return router;
}
