# Contributing to SPX

## Development Setup

```bash
git clone https://github.com/<your-username>/spx.git
cd spx
npm install
```

## Running Locally

```bash
# Mock mode (no Spotify account required)
SPX_MOCK=1 npm run tauri dev

# With real Spotify — configure .env first
npm run tauri dev
```

## Pull Request Guidelines

- Branch off `main` with a descriptive name (`feat/`, `fix/`, `chore/`)
- Keep changes focused and atomic
- Test mock mode (`SPX_MOCK=1`) to verify no Spotify dependency
- No new committed dependencies without discussion

## Code Style

- TypeScript strict mode — no `any`
- Rust: run `cargo fmt` before committing
- Preact components: PascalCase files, JSX in `.tsx`

## Reporting Issues

- Use GitHub Issues
- Include OS, version info, and repro steps
- For Spotify API bugs, confirm issue exists in official Spotify client
