# VideoAI

VideoAI is a TypeScript-first AI video generation platform.

Current implementation slice:

- Next.js App Router web app scaffold.
- NestJS API Gateway scaffold.
- Shared TypeScript contracts.
- Service and worker boundary skeletons.
- Local storage and AI provider interfaces.

Read [AGENTS.md](./AGENTS.md) before implementing code. Product and architecture decisions live under [docs](./docs/user-story.md).

Current progress is tracked in [docs/implementation-status.md](./docs/implementation-status.md).

Start everything locally with:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-project.ps1
```
