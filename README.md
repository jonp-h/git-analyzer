# Git Analyzer

## A simple project to analyze and give visual feedback on git repos

The project has been made to only be run locally.

### Installation

Requires node and npm.

- Open the project in the root folder and start the frontend and backend services with the following commands:

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
