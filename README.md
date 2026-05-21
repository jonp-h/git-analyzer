# Git Analyzer

## A simple project to analyze and give visual feedback on git repos

The project has been made to only be run locally.

### Installation

Requires node and npm.

**Note:** To enable optional statistics from GitHub, a fine-grained personal access token must be made. **This is not required.**

- Change the `.env.example` file in the backend folder into `.env`
- Create one at https://github.com/settings/personal-access-tokens
- Required scopes: issues, pull_requests
- Add the token to the `.env` under `GITHUB_TOKEN=`

- Open the project root folder in a terminal and start the frontend and backend services with the following commands:

```
npm i
npm run dev
```

- Scan a git repo by putting it in the `/repos` folder.

- Open http://localhost:5173

## Commands

| Command                | Effect                                        |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Starts both backend and frontend concurrently |
| `npm run dev:backend`  | Backend only                                  |
| `npm run dev:frontend` | Frontend only                                 |
| `npm run build`        | Builds the frontend                           |

`npm install` at the root also installs dependencies for both workspaces via npm workspaces.

> This project has been made with AI Tools
