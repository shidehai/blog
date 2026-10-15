#!/bin/sh
set -eu

image=${1:-}
[ "$#" -eq 1 ] && [ -n "$image" ] || { echo "Usage: test-cms-image.sh IMAGE" >&2; exit 2; }
script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
network="blog-cms-image-test-$$"
database="$network-db"
container="$network-app"
cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  docker rm --force "$container" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  exit "$status"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cleanup EXIT

docker network create --internal "$network" >/dev/null
docker run --detach --name "$database" --network "$network" --network-alias database \
  --env POSTGRES_PASSWORD=isolated-image-database-password \
  --env CMS_DB_PASSWORD=isolated-image-owner-database-password \
  --env POSTGRES_DB=cms_image_test --tmpfs /var/lib/postgresql/data \
  --volume "$script_dir/../deploy/init-cms-role.sh:/docker-entrypoint-initdb.d/10-author-cms.sh:ro" \
  postgres:17.9-alpine >/dev/null
deadline=$(($(date +%s) + 60))
until docker exec "$database" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do
  [ "$(date +%s)" -lt "$deadline" ] || { echo "Isolated PostgreSQL startup failed" >&2; exit 1; }
  sleep 1
done
docker exec -i "$database" psql -v ON_ERROR_STOP=1 -U postgres -d cms_image_test >/dev/null <<'SQL'
CREATE TABLE public.legacy_sentinel (value text);
INSERT INTO public.legacy_sentinel VALUES ('legacy data must remain inaccessible');
SQL

docker run --detach --name "$container" --network "$network" \
  --read-only --tmpfs /tmp --tmpfs /data/cms-media:uid=1000,gid=1000,mode=0700 \
  --cap-drop ALL --security-opt no-new-privileges \
  --env DATABASE_URL=postgres://blog_cms:isolated-image-owner-database-password@database:5432/cms_image_test \
  --env CMS_ORIGIN=http://localhost:4322 --env CMS_SITE_ORIGIN=http://localhost:4321 \
  --env CMS_READ_TOKEN=isolated-image-reader-token-32-characters \
  --env CMS_MEDIA_ROOT=/data/cms-media "$image" >/dev/null
deadline=$(($(date +%s) + 60))
until docker exec "$container" node -e "fetch('http://127.0.0.1:4322/admin/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; do
  [ "$(docker inspect --format '{{.State.Status}}' "$container")" = running ] || {
    docker logs "$container" >&2; exit 1;
  }
  [ "$(date +%s)" -lt "$deadline" ] || { docker logs "$container" >&2; exit 1; }
  sleep 1
done
[ "$(docker image inspect --format '{{.Config.User}}' "$image")" = node ]
printf '%s\n' 'isolated-image-owner-password-2026' | docker exec -i "$container" node author-cms/scripts/manage.mjs owner --password-stdin
docker exec -i "$container" node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const notices=await readFile('/app/THIRD_PARTY_NOTICES.txt','utf8');
assert.equal(process.version,'v24.22.0');
for(const directory of ['/usr/local/lib/node_modules/npm','/usr/local/lib/node_modules/corepack','/opt/yarn-v1.22.22']) assert.equal(existsSync(directory),false);
assert.match(notices,/Permission is hereby granted/);assert.match(notices,/LGPLv3/);
assert.match(notices,/SIL OPEN FONT LICENSE Version 1.1/);assert.match(notices,/Runtime Noto CJK font copyright/);assert.match(notices,/Adobe/);
const {createRequire}=await import('node:module');const require=createRequire(`${process.cwd()}/author-cms/scripts/manage.mjs`);
const sharp=require('sharp');
assert.equal(require('next/package.json').version,'15.5.28');
assert.equal(sharp.versions.sharp,'0.35.5');
assert.equal(sharp.versions.vips,'8.18.7');
assert.match(execFileSync('fc-match',['--format=%{family}','sans-serif:lang=zh-cn'],{encoding:'utf8'}),/Noto Sans CJK/);
assert.match(execFileSync('fc-match',['--format=%{family}','sans-serif:charset=4e2d 6587'],{encoding:'utf8'}),/Noto Sans CJK/);
for(const text of ['Blog','中文']) {
  const image=sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" fill="white"/><text x="10" y="42" font-family="sans-serif" font-size="36">${text}</text></svg>`));
  const {data,info}=await image.flatten({background:'#fff'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let ink=0;for(let pixel=0;pixel<data.length;pixel+=info.channels)if(data[pixel]<128)ink++;
  assert.ok(ink>150,`SVG text produced no readable pixels: ${text}`);
}
const origin='http://localhost:4322', base='http://127.0.0.1:4322/admin';
assert.equal((await fetch(`${base}/api/admin/contents`)).status,401);
const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({password:'isolated-image-owner-password-2026'})});
assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie').split(';')[0];
async function admin(path,method='GET',data){const response=await fetch(`${base}/api/admin/${path}`,{method,headers:{origin,cookie,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});assert.ok(response.ok,`${path}: ${response.status}`);return response.json();}
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const form=new FormData();form.append('file',new File([bytes],'smoke.png',{type:'image/png'}));
const uploaded=await fetch(`${base}/api/admin/media`,{method:'POST',headers:{origin,cookie},body:form});assert.equal(uploaded.status,201);const media=await uploaded.json();
assert.equal((await fetch(`${base}/media/${media.id}`)).status,404);
let item=await admin('contents','POST',{kind:'article'});
item=await admin(`contents/${item.id}`,'PUT',{version:item.version,draft:{...item.draft,title:'Container smoke',slug:'container-smoke',content:`## Container\n\n![verified](/media/${media.id})`}});
await admin(`contents/${item.id}/publish`,'POST',{version:item.version,revisionId:item.draftRevisionId,key:crypto.randomUUID()});
const reader=await fetch(`${base}/api/public/catalog`,{headers:{authorization:`Bearer ${process.env.CMS_READ_TOKEN}`}});assert.equal(reader.status,200);assert.equal((await reader.json()).posts[0].slug,'container-smoke');
const publicMedia=await fetch(`${base}/media/${media.id}`);assert.equal(publicMedia.status,200);assert.deepEqual(Buffer.from(await publicMedia.arrayBuffer()),bytes);
const {Pool}=require('pg');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try {assert.equal((await pool.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0].rolsuper,false);await assert.rejects(pool.query('SELECT * FROM public.legacy_sentinel'),error=>error.code==='42501');} finally {await pool.end();}
console.log('CMS image: authenticated edit, Sharp upload, publish and restricted database role passed');
JS
docker exec "$container" node author-cms/scripts/transfer.mjs export /tmp/cms-image-bundle
docker exec "$container" node author-cms/scripts/transfer.mjs verify /tmp/cms-image-bundle
echo "cms runtime image test status=success image=$image"
