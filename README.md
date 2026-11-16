# DevOps Flight Deck Community

A bilingual study tracker for the 28-week AI Cloud & DevOps Engineering plan. Switch between English and Spanish without losing progress. The program includes 112 practice blocks, nine skill checklists, a calendar, a journal and a portfolio and job tracker. Labs can run in Linux, WSL, a VM or on a remote lab host you control.

The community edition runs one Node.js web service and stores student accounts and progress in SQLite. New accounts start with an independent 28-week calendar. The Code Platoon class schedule is optional in **Settings**. This installation has its own accounts and database, separate from the hosted Sites version.

## 1. Run locally

Requirements are Docker Engine or Docker Desktop and Docker Compose v2 with `up --wait` support.

```bash
install -m 600 .env.example .env
# Edit .env and set REGISTRATION_CODE before starting the service.
docker build -t flight-deck:local .
docker compose up -d --wait
curl --fail http://localhost:8080/healthz
```

Before starting Compose, set `REGISTRATION_CODE` in `.env` to a random invitation code, for example one generated with `openssl rand -hex 24`. Open [http://localhost:8080](http://localhost:8080), choose **Create account** and enter the code. Students choose their own username and password. The default port is bound only to loopback. When changing `HOST_PORT`, update `APP_ORIGIN` to match the URL you open.

Leave `REGISTRATION_CODE` empty to close enrollment. To rotate or close it, edit `.env` and recreate the web service with `docker compose up -d --wait` using the currently deployed image. Existing users can sign in with their passwords. Account recovery via email is outside this version.

For development without containers, use Node.js 24 or newer, run `npm ci && npm run check && npm test && npm run build`, and start with `node --env-file=.env server/index.mjs`. The Node server uses `PORT` for its listener and defaults to `./data/tracker.sqlite`. Docker uses `HOST_PORT` for its host-side port and keeps the database in the named volume.

## 2. Create the GitHub repository

Extract the source archive and run these commands from the project directory on a machine where GitHub CLI is signed in.

```bash
gh auth status
git init -b main
git add .
git commit -m "Add bilingual DevOps Flight Deck"
gh repo create flight-deck-community --private --source=. --remote=origin --push
```

On pull requests, GitHub Actions runs a container build that checks TypeScript and exercises the authentication and storage API. Pushes to `main` also smoke-test the built web server and publish to `ghcr.io/OWNER/REPO` using the workflow token. Images get a commit-SHA tag and a `stable` tag. The workflow uses an x86-64 Linux runner. Use a matching home host for registry updates.

## 3. Enable automatic deployments at home

Place the project files under `~/flight-deck` on a Linux host running systemd and Docker Compose. For a private GHCR package, use a GitHub classic token with `read:packages` and package access on the home host. Enter it into the prompt with the deployment user's Docker CLI. Keep it outside the repository.

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
cd ~/flight-deck
mkdir -p ~/.config/flight-deck ~/.config/systemd/user
install -m 600 deploy/deploy.env.example ~/.config/flight-deck/deploy.env
install -m 644 deploy/flight-deck.service deploy/flight-deck.timer ~/.config/systemd/user/
```

Edit `~/.config/flight-deck/deploy.env` with the actual absolute checkout path and lowercase GHCR image repository. Configure the app's `.env` as in step 1. The user running the timer must be able to run Docker commands. If you want the timer to run while logged out, enable systemd lingering for that user with `sudo loginctl enable-linger "$USER"`.

```bash
systemctl --user daemon-reload
systemctl --user start flight-deck.service
systemctl --user enable --now flight-deck.timer
journalctl --user -u flight-deck.service -n 50 --no-pager
```

The timer checks GitHub Container Registry every two minutes. The deploy script pulls `stable`, resolves it to an immutable digest and recreates the service through Compose. It waits for `/healthz` and returns to the previous healthy image if an update fails. An unchanged failed digest is skipped until a new release appears. The host initiates the registry connection. No GitHub runner or inbound SSH connection is involved.

To recreate a release after changing `.env`, use `APP_IMAGE="$(cat .current-image)" docker compose up -d --wait` after the timer's first successful deployment. For a manual rollback, stop the timer and use `APP_IMAGE="$(cat .previous-image)" docker compose up -d --wait` once a previous image exists. The `flight-deck_tracker` volume survives image replacement. Back it up with a SQLite-consistent backup before making schema changes. Preserve it when removing old containers.

## 4. Share with students over HTTPS

Keep the container on loopback and use an HTTPS reverse proxy. For example, point a domain at the host and set up [Caddy](https://caddyserver.com/docs/quick-starts/reverse-proxy) to proxy it.

```caddyfile
study.example.org {
    reverse_proxy 127.0.0.1:8080
}
```

Set `APP_ORIGIN=https://study.example.org` exactly as it appears in the browser, with no trailing slash. Recreate the app service, verify sign-in using that URL, then share the URL and invitation code with your classmates. The origin check and secure cookies use this URL. If inbound HTTPS is unavailable, [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) is an optional HTTPS transport. Set `APP_ORIGIN` to the actual Funnel URL if you use it.

## Architecture

- `app/` contains the React UI, English and Spanish curriculum, and shared input validation.
- `server/` serves the compiled UI and the authenticated tracker API. Passwords are salted and hashed with scrypt. Session tokens are random and only their hashes are stored.
- `compose.yaml` defines the service, health check and persistent SQLite volume.
- `.github/workflows/ci.yml` verifies builds and publishes releases.
- `deploy/` contains the pull-based systemd deployment.

References: [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), [Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up), [Node.js SQLite](https://nodejs.org/api/sqlite.html).
