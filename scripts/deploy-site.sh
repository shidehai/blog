#!/bin/sh
set -eu

umask 077

log() {
  echo "deploy $*"
}

fail() {
  echo "deploy status=failed reason=$1" >&2
  exit 1
}

validate_image_ref() {
  image_ref=$1
  prefix="${DEPLOY_IMAGE_REPOSITORY}@sha256:"
  case "$image_ref" in
    "$prefix"*) digest=${image_ref#"$prefix"} ;;
    *) return 1 ;;
  esac
  [ "${#digest}" -eq 64 ] || return 1
  case "$digest" in
    *[!0-9a-f]*) return 1 ;;
  esac
}

atomic_write() {
  destination=$1
  value=$2
  temporary=$(mktemp "$DEPLOY_STATE_DIR/.state.XXXXXX")
  printf '%s\n' "$value" >"$temporary"
  chmod 600 "$temporary"
  mv -f "$temporary" "$destination"
}

compose_default() {
  if [ -s "$image_env_file" ]; then
    docker compose \
      --env-file "$DEPLOY_COMPOSE_ENV_FILE" \
      --env-file "$image_env_file" \
      -f "$DEPLOY_COMPOSE_FILE" \
      "$@"
  else
    docker compose \
      --env-file "$DEPLOY_COMPOSE_ENV_FILE" \
      -f "$DEPLOY_COMPOSE_FILE" \
      "$@"
  fi
}

compose_with_image() {
  selected_image=$1
  shift
  (
    SITE_IMAGE=$selected_image
    export SITE_IMAGE
    compose_default "$@"
  )
}

wait_for_health() {
  container=$1
  deadline=$(($(date +%s) + DEPLOY_TIMEOUT_SECONDS))
  while [ "$(date +%s)" -le "$deadline" ]; do
    state=$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container" 2>/dev/null || true)
    if [ "$state" = running ] && [ "$health" = healthy ]; then
      return 0
    fi
    case "$state" in
      exited | dead | removing)
        echo "deploy candidate_status=$state health=$health" >&2
        return 1
        ;;
    esac
    sleep 1
  done
  echo "deploy candidate_status=timeout" >&2
  return 1
}

check_candidate_routes() {
  container=$1
  for path in $DEPLOY_PREFLIGHT_PATHS; do
    case "$path" in
      /*) ;;
      *)
        echo "deploy invalid_preflight_path" >&2
        return 1
        ;;
    esac
    case "$path" in
      *[!A-Za-z0-9._~/%+-]*)
        echo "deploy invalid_preflight_path" >&2
        return 1
        ;;
    esac
    docker exec \
      -e BLOG_CHECK_PATH="$path" \
      "$container" \
      node -e '
        const path = process.env.BLOG_CHECK_PATH;
        fetch(new URL(path, "http://127.0.0.1:4321"))
          .then((response) => {
            if (response.status < 200 || response.status >= 400) process.exit(1);
          })
          .catch(() => process.exit(1));
      '
  done
}

reload_caddy() {
  image=$1
  compose_with_image "$image" exec -T caddy \
    caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
}

run_external_smoke() {
  "$http_smoke_script" "$DEPLOY_SMOKE_URL" /healthz /
}

rollback_to_prior() {
  log "rollback=started image=$prior_image"
  if ! compose_with_image "$prior_image" up \
    --detach \
    --no-deps \
    --force-recreate \
    --wait \
    --wait-timeout "$DEPLOY_TIMEOUT_SECONDS" \
    site; then
    log "rollback=failed stage=replace" >&2
    return 1
  fi
  atomic_write "$image_env_file" "SITE_IMAGE=$prior_image"
  if ! reload_caddy "$prior_image"; then
    log "rollback=failed stage=caddy_reload" >&2
    return 1
  fi
  if ! run_external_smoke; then
    log "rollback=failed stage=external_smoke" >&2
    return 1
  fi
  atomic_write "$current_image_file" "$prior_image"
  rm -f "$pending_file"
  log "rollback=success image=$prior_image"
}

reconcile_pending_deploy() {
  [ -e "$pending_file" ] || return 0
  [ -f "$pending_file" ] && [ -s "$pending_file" ] ||
    fail "pending_state_is_invalid"

  pending_lines=$(wc -l <"$pending_file" | tr -d ' ')
  pending_target=$(sed -n '1s/^target_image=//p' "$pending_file")
  pending_prior=$(sed -n '2s/^prior_image=//p' "$pending_file")
  pending_started=$(sed -n '3s/^started_at=//p' "$pending_file")
  [ "$pending_lines" -eq 3 ] || fail "pending_state_is_invalid"
  validate_image_ref "$pending_target" || fail "pending_target_is_invalid"
  validate_image_ref "$pending_prior" || fail "pending_prior_is_invalid"
  [ "$pending_target" != "$pending_prior" ] || fail "pending_state_is_invalid"
  case "$pending_started" in
    ????-??-??T??:??:??Z) ;;
    *) fail "pending_started_at_is_invalid" ;;
  esac
  case "$pending_started" in
    *[!0-9TZ:-]*) fail "pending_started_at_is_invalid" ;;
  esac

  if [ "$prior_image" = "$pending_target" ]; then
    log "recovery=pending_target image=$pending_target prior=$pending_prior"
    recovered_image=$pending_target
    prior_image=$pending_prior
    traffic_switched=1
    reload_caddy "$recovered_image"
    run_external_smoke
    atomic_write "$previous_image_file" "$prior_image"
    atomic_write "$image_env_file" "SITE_IMAGE=$recovered_image"
    atomic_write "$current_image_file" "$recovered_image"
    atomic_write "$DEPLOY_STATE_DIR/deployed-at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    rm -f "$pending_file"
    traffic_switched=0
    prior_image=$recovered_image
    log "recovery=completed image=$recovered_image previous=$pending_prior"
    return 0
  fi

  if [ "$prior_image" = "$pending_prior" ]; then
    log "recovery=pending_prior image=$pending_prior"
    reload_caddy "$pending_prior"
    run_external_smoke
    atomic_write "$previous_image_file" "$pending_prior"
    atomic_write "$image_env_file" "SITE_IMAGE=$pending_prior"
    atomic_write "$current_image_file" "$pending_prior"
    rm -f "$pending_file"
    log "recovery=completed image=$pending_prior"
    return 0
  fi

  fail "running_image_does_not_match_pending_state"
}

cleanup_repository_images() {
  protected_current=$1
  protected_previous=$2
  docker image ls \
    --digests \
    --format '{{.Repository}}@{{.Digest}}' \
    "$DEPLOY_IMAGE_REPOSITORY" 2>/dev/null |
    while IFS= read -r image_ref; do
      validate_image_ref "$image_ref" || continue
      if [ "$image_ref" = "$protected_current" ] || [ "$image_ref" = "$protected_previous" ]; then
        continue
      fi
      if [ -n "$(docker ps --all --quiet --filter "ancestor=$image_ref")" ]; then
        continue
      fi
      if docker image rm "$image_ref" >/dev/null 2>&1; then
        log "cleanup=removed image=$image_ref"
      else
        log "cleanup=skipped image=$image_ref"
      fi
    done
}

if [ "$#" -ne 1 ]; then
  fail "expected_one_digest_reference"
fi
target_image=$1

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
deploy_config=${BLOG_DEPLOY_CONFIG:-/etc/personal-journal/deploy.env}
if [ -f "$deploy_config" ]; then
  config_owner=$(stat -c '%u' "$deploy_config")
  [ "$config_owner" -eq 0 ] || fail "deploy_config_must_be_root_owned"
  if [ -n "$(find "$deploy_config" -prune -perm /022 -print)" ]; then
    fail "deploy_config_must_not_be_group_or_world_writable"
  fi
  # This root-owned file contains only deployment paths and the allow-list.
  . "$deploy_config"
fi

[ -n "${DEPLOY_IMAGE_REPOSITORY:-}" ] || fail "missing_DEPLOY_IMAGE_REPOSITORY"
[ -n "${DEPLOY_SMOKE_URL:-}" ] || fail "missing_DEPLOY_SMOKE_URL"
[ -n "${DEPLOY_COMPOSE_ENV_FILE:-}" ] || fail "missing_DEPLOY_COMPOSE_ENV_FILE"
case "$DEPLOY_IMAGE_REPOSITORY" in
  ghcr.io/*/*) ;;
  *) fail "repository_must_be_a_ghcr_path" ;;
esac
case "$DEPLOY_IMAGE_REPOSITORY" in
  *[!a-z0-9./_-]*) fail "repository_must_be_lowercase" ;;
  *//* | */../* | */..) fail "repository_path_is_invalid" ;;
esac
validate_image_ref "$target_image" || fail "image_must_match_allowlist_and_sha256_digest"

DEPLOY_COMPOSE_FILE=${DEPLOY_COMPOSE_FILE:-$repository_root/deploy/compose.yaml}
DEPLOY_STATE_DIR=${DEPLOY_STATE_DIR:-/var/lib/personal-journal/deploy}
DEPLOY_TIMEOUT_SECONDS=${DEPLOY_TIMEOUT_SECONDS:-90}
DEPLOY_PREFLIGHT_PATHS=${DEPLOY_PREFLIGHT_PATHS:-/healthz /}
http_smoke_script=${DEPLOY_HTTP_SMOKE_SCRIPT:-$script_dir/http-smoke.sh}

case "$DEPLOY_TIMEOUT_SECONDS" in
  "" | *[!0-9]*) fail "timeout_must_be_a_positive_integer" ;;
esac
[ "$DEPLOY_TIMEOUT_SECONDS" -gt 0 ] || fail "timeout_must_be_a_positive_integer"
[ -r "$DEPLOY_COMPOSE_FILE" ] || fail "compose_file_not_readable"
[ -r "$DEPLOY_COMPOSE_ENV_FILE" ] || fail "compose_env_not_readable"
[ -x "$http_smoke_script" ] || fail "http_smoke_script_not_executable"
command -v docker >/dev/null 2>&1 || fail "docker_not_found"
command -v flock >/dev/null 2>&1 || fail "flock_not_found"

mkdir -p "$DEPLOY_STATE_DIR"
chmod 700 "$DEPLOY_STATE_DIR"
image_env_file=$DEPLOY_STATE_DIR/site-image.env
current_image_file=$DEPLOY_STATE_DIR/current-image
previous_image_file=$DEPLOY_STATE_DIR/previous-image
pending_file=$DEPLOY_STATE_DIR/pending-deploy.env

exec 9>"$DEPLOY_STATE_DIR/deploy.lock"
flock -n 9 || fail "deployment_already_running"

candidate_name=
traffic_switched=0
prior_image=
on_exit() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ -n "$candidate_name" ]; then
    docker rm --force "$candidate_name" >/dev/null 2>&1 || true
  fi
  if [ "$status" -ne 0 ] && [ "$traffic_switched" -eq 1 ]; then
    if ! rollback_to_prior; then
      log "rollback=critical prior_image=$prior_image pending_state=$pending_file" >&2
      exit 70
    fi
  fi
  exit "$status"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap on_exit EXIT

site_container=$(compose_default ps --quiet site)
[ -n "$site_container" ] || fail "site_service_is_not_running"
prior_image=$(docker inspect --format '{{.Config.Image}}' "$site_container")
validate_image_ref "$prior_image" || fail "running_site_is_not_an_allowlisted_digest"
atomic_write "$current_image_file" "$prior_image"
reconcile_pending_deploy

if [ "$target_image" = "$prior_image" ]; then
  run_external_smoke
  atomic_write "$image_env_file" "SITE_IMAGE=$target_image"
  log "status=success result=already_deployed image=$target_image"
  exit 0
fi

log "stage=pull image=$target_image"
docker pull "$target_image" >/dev/null

candidate_name="blog-site-candidate-$(date +%s)-$$"
log "stage=candidate_start name=$candidate_name"
compose_with_image "$target_image" run \
  --detach \
  --no-deps \
  --name "$candidate_name" \
  site >/dev/null
wait_for_health "$candidate_name"
check_candidate_routes "$candidate_name"
docker rm --force "$candidate_name" >/dev/null
candidate_name=
log "stage=candidate_complete"

atomic_write "$previous_image_file" "$prior_image"
atomic_write "$pending_file" "target_image=$target_image
prior_image=$prior_image
started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

traffic_switched=1
log "stage=replace image=$target_image"
compose_with_image "$target_image" up \
  --detach \
  --no-deps \
  --force-recreate \
  --wait \
  --wait-timeout "$DEPLOY_TIMEOUT_SECONDS" \
  site
reload_caddy "$target_image"
run_external_smoke

atomic_write "$image_env_file" "SITE_IMAGE=$target_image"
atomic_write "$current_image_file" "$target_image"
atomic_write "$DEPLOY_STATE_DIR/deployed-at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
rm -f "$pending_file"
traffic_switched=0

cleanup_repository_images "$target_image" "$prior_image" || log "cleanup=warning"
log "status=success image=$target_image previous=$prior_image"
