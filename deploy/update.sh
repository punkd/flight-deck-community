#!/usr/bin/env bash
set -euo pipefail

cd "${FLIGHT_DECK_DIR:?Set FLIGHT_DECK_DIR}"
repository="${IMAGE_REPOSITORY:?Set IMAGE_REPOSITORY}"
[[ "$repository" =~ ^ghcr\.io/[a-z0-9_.-]+/[a-z0-9_.-]+$ ]] || { echo "Invalid GHCR repository" >&2; exit 1; }
exec 9>.deploy.lock
flock -n 9 || exit 0

read_file() { if [[ -f "$1" ]]; then cat "$1"; fi; }
write_file() {
  local file="$1" value="$2" tmp
  tmp="$(mktemp ".${file##.}.XXXXXX")"
  printf '%s\n' "$value" > "$tmp"
  mv -f "$tmp" "$file"
}
compose() { APP_IMAGE="$1" docker compose --env-file .env -f compose.yaml "${@:2}"; }

current="$(read_file .current-image)"
if [[ -z "$current" ]]; then
  existing="$(docker compose --env-file .env -f compose.yaml ps --status running --quiet web)"
  if [[ -n "$existing" ]]; then
    existing_info="$(docker inspect --format '{{.State.Health.Status}} {{.Config.Image}}' "$existing")"
    if [[ "$existing_info" == healthy\ * ]]; then current="${existing_info#healthy }"; fi
  fi
fi
failed="$(read_file .failed-image)"
tag="$repository:stable"
docker pull "$tag"
digests="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$tag")"
candidate=""
while IFS= read -r digest; do
  if [[ "$digest" == "$repository"@sha256:* ]]; then candidate="$digest"; break; fi
done <<< "$digests"
[[ -n "$candidate" ]] || { echo "No immutable digest for $tag" >&2; exit 1; }

if [[ "$candidate" == "$failed" && "$candidate" != "$current" ]]; then
  [[ -z "$current" ]] || compose "$current" up -d --no-build --wait --wait-timeout 70
  echo "Skipping previously failed image: $candidate"
  exit 0
fi

if compose "$candidate" up -d --no-build --wait --wait-timeout 70; then
  if [[ "$candidate" != "$current" ]]; then
    if [[ -n "$current" ]]; then write_file .previous-image "$current"; fi
    write_file .current-image "$candidate"
    rm -f .failed-image
  fi
  echo "Healthy image: $candidate"
  exit 0
fi

compose "$candidate" logs --tail 50 web || true
if [[ "$candidate" != "$current" ]]; then write_file .failed-image "$candidate"; fi
if [[ -n "$current" && "$candidate" != "$current" ]]; then
  echo "Rolling back to $current" >&2
  compose "$current" up -d --no-build --wait --wait-timeout 70
elif [[ -z "$current" ]]; then
  compose "$candidate" down
fi
exit 1
