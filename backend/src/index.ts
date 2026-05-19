import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { reposRouter } from "./routes/repos.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPOS_DIR = join(__dirname, "..", "..", "repos");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/repos", reposRouter(REPOS_DIR));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Git Analyzer backend running on http://localhost:${PORT}`);
  console.log(`Repos directory: ${REPOS_DIR}`);
});
