# Infra Progress

## Scope Locked For This Pass

This repo is staged for a reduced first-pass AWS target:

- deploy `apps/api` and `apps/web` only
- defer `apps/docs`
- defer `apps/pipeline-monitor`
- defer worker automation on EC2
- treat Postgres as the only backing store in this pass
- treat PMTiles delivery as S3 + CloudFront, not EC2 local disk delivery
- do not add a separate mirror or hyperscale sync deployment path

`hyperscale` remains part of the facility model in Postgres. What was removed from the deployment path is the old mirror/sync runtime concern, not the facility concept.

## Repo Changes Applied

### Production API contract

Updated [package.json](/Users/robertfarris/map/package.json):

- added `build:deploy:app`
- added `start:api:prod`
- added `validate:api:health`
- added `validate:tile-delivery`
- added `tiles:publish:s3`
- added root workspace devDependencies for `@map-migration/geo-tiles` and `@map-migration/ops` so root-level tile scripts resolve in both the repo root and the staged artifact

Updated [apps/api/package.json](/Users/robertfarris/map/apps/api/package.json):

- `build` now runs [normalize-api-dist-imports.sh](/Users/robertfarris/map/scripts/normalize-api-dist-imports.sh) after `tsc` and `tsc-alias`
- added `start:prod` with `NODE_ENV=production bun dist/index.js`

Added [normalize-api-dist-imports.sh](/Users/robertfarris/map/scripts/normalize-api-dist-imports.sh):

- scans `apps/api/dist`
- rewrites broken relative `effect` imports back to `effect`
- fixes the Bun runtime startup failure in built API output

Added [validate-api-health.sh](/Users/robertfarris/map/scripts/validate-api-health.sh):

- checks `http://127.0.0.1:${PORT:-3001}/api/health`
- allows override through `MAP_API_HEALTH_URL`
- fails on non-200 or missing `"status":"ok"`

Updated the API runtime to fail fast on database readiness:

- [postgres.ts](/Users/robertfarris/map/apps/api/src/db/postgres.ts) now exports `assertPostgresReady()`
- [index.ts](/Users/robertfarris/map/apps/api/src/index.ts) checks Postgres before opening the HTTP listener
- [app.ts](/Users/robertfarris/map/apps/api/src/app.ts) now returns `503 DATABASE_UNAVAILABLE` from `/api/health` when the readiness check fails
- [app-hardening.test.ts](/Users/robertfarris/map/apps/api/test/http/app-hardening.test.ts) now covers both the healthy and database-unavailable paths

Added or updated [apps/api/.env.example](/Users/robertfarris/map/apps/api/.env.example):

- `DATABASE_URL`
- `BOUNDARIES_SOURCE_MODE=postgis`
- `FACILITIES_SOURCE_MODE=postgis`
- `PARCELS_SOURCE_MODE=postgis`
- `AUTO_PARCELS_SYNC=false`
- timeout and request-size settings
- the first-pass EC2 deploy contract comment that fixes the API listener to port `3001`
- required FiberLocator settings for this first-pass AWS app target because the shipped web boot initializes FiberLocator during normal map startup

Updated [runtime-config.ts](/Users/robertfarris/map/apps/api/src/http/runtime-config.ts) and [index.ts](/Users/robertfarris/map/apps/api/src/index.ts):

- the API build now enforces `FIBER_LOCATOR_SOURCE_MODE=external-xyz`
- startup now validates the FiberLocator env contract before opening the HTTP listener

Added [fiber-locator-config.service.test.ts](/Users/robertfarris/map/apps/api/test/geo/fiber-locator/fiber-locator-config.service.test.ts):

- covers required FiberLocator env keys
- covers normalized URL, line-id, and numeric config parsing

### Web tile manifest contract

Added [apps/web/.env.example](/Users/robertfarris/map/apps/web/.env.example) and [tile-manifest-config.service.ts](/Users/robertfarris/map/apps/web/src/features/tiles/tile-manifest-config.service.ts).

Supported env vars:

- `VITE_TILE_MANIFEST_MODE`
- `VITE_PARCELS_MANIFEST_URL`
- `VITE_ENVIRONMENTAL_FLOOD_MANIFEST_URL`
- `VITE_ENVIRONMENTAL_HYDRO_BASINS_MANIFEST_URL`

For the AWS deploy path those manifest URLs are now explicitly treated as:

- required `https://.../tiles/<dataset>/latest.json` CloudFront URLs
- `latest.json` objects cached with `public,max-age=60`
- referenced `.pmtiles` objects cached with `public,max-age=31536000,immutable`

Updated [env.d.ts](/Users/robertfarris/map/apps/web/env.d.ts) to type those env vars.

Updated these layer entrypoints to resolve manifest URLs through the shared helper:

- [parcels.layer.ts](/Users/robertfarris/map/apps/web/src/features/parcels/parcels.layer.ts)
- [flood.layer.ts](/Users/robertfarris/map/apps/web/src/features/flood/flood.layer.ts)
- [hydro-basins.layer.ts](/Users/robertfarris/map/apps/web/src/features/hydro-basins/hydro-basins.layer.ts)

Current behavior:

- local development can still use the existing `/tiles/.../latest.json` paths
- external deploy mode is activated with `VITE_TILE_MANIFEST_MODE=external`
- in external mode, the helper still fails fast if a layer is asked to load without its matching `VITE_*_MANIFEST_URL`
- for the current playground AWS pass, only parcels is required at build/deploy time; flood and hydro-basins remain deferred follow-up
- PMTiles source URLs now resolve relative asset paths against the manifest URL when the manifest is absolute

Updated [packages/geo-tiles/src/index.ts](/Users/robertfarris/map/packages/geo-tiles/src/index.ts):

- `createPmtilesSourceUrl()` now resolves relative PMTiles URLs against an absolute manifest URL when one is provided
- `createManifestEntry()` now supports `publicBaseUrl` so published manifest entries can be absolute

Updated [tile-manifest.test.ts](/Users/robertfarris/map/packages/geo-tiles/test/tile-manifest.test.ts) and [manifest-loading.service.test.ts](/Users/robertfarris/map/apps/web/test/features/layers/manifest-loading.service.test.ts):

- cover manifest-origin-relative PMTiles resolution
- cover absolute PMTiles URL generation
- remove the stale test dependency on the nonexistent `loadParcelsManifest`

### Deploy-safe web build mode

Updated [vite.config.ts](/Users/robertfarris/map/apps/web/vite.config.ts):

- when `VITE_TILE_MANIFEST_MODE=external`, Vite uses `public-static` instead of `public`
- this prevents the build from copying the large local PMTiles tree into `dist`

Added static-only deploy assets:

- [favicon.svg](/Users/robertfarris/map/apps/web/public-static/favicon.svg)
- [dch-logo.svg](/Users/robertfarris/map/apps/web/public-static/dch-logo.svg)

### Manifest publishing contract

Updated [publish-parcels-manifest.ts](/Users/robertfarris/map/scripts/publish-parcels-manifest.ts), [publish-parcels-manifest.types.ts](/Users/robertfarris/map/scripts/publish-parcels-manifest.types.ts), and [rollback-parcels-manifest.ts](/Users/robertfarris/map/scripts/rollback-parcels-manifest.ts):

- `publish-parcels-manifest.ts` now accepts `--public-base-url` and `TILES_PUBLIC_BASE_URL`
- published manifest entries can now point at absolute CloudFront PMTiles URLs
- local artifact copy and rollback logic no longer assume `manifest.current.url` is a relative filesystem path
- rollback checks now derive the expected local artifact path from `dataset + version`

This keeps the publisher compatible with both:

- local same-origin manifests under `apps/web/public`
- absolute PMTiles URLs for S3 + CloudFront delivery

Added [publish-tiles-to-s3.ts](/Users/robertfarris/map/scripts/publish-tiles-to-s3.ts):

- uploads the current versioned `.pmtiles` object to S3 with `Cache-Control: public,max-age=31536000,immutable`
- uploads the matching `latest.json` manifest to S3 with `Cache-Control: public,max-age=60`
- keeps the publish order safe by uploading the immutable `.pmtiles` object before the mutable `latest.json`
- supports optional CloudFront invalidation for the manifest path
- encodes the intended first-pass invalidation strategy: if no invalidation is requested, `latest.json` still refreshes on its short TTL

Added [validate-tile-delivery.ts](/Users/robertfarris/map/scripts/validate-tile-delivery.ts) and [validate-tile-delivery.test.ts](/Users/robertfarris/map/scripts/validate-tile-delivery.test.ts):

- validates that an external `latest.json` URL matches the expected dataset path
- validates manifest parsing and dataset matching
- validates PMTiles range-request behavior (`206` + `Content-Range`, and `Accept-Ranges: bytes` when that header is present)
- validates the expected cache-control policy for `latest.json` and `.pmtiles`
- rejects `.pmtiles` delivery when a CDN applies `Content-Encoding`

### AWS app deployment skeleton

Added:

- [buildspec.yml](/Users/robertfarris/map/aws/app/buildspec.yml)
- [appspec.yml](/Users/robertfarris/map/aws/app/appspec.yml)
- [before-install.sh](/Users/robertfarris/map/aws/app/hooks/before-install.sh)
- [after-install.sh](/Users/robertfarris/map/aws/app/hooks/after-install.sh)
- [application-start.sh](/Users/robertfarris/map/aws/app/hooks/application-start.sh)
- [application-stop.sh](/Users/robertfarris/map/aws/app/hooks/application-stop.sh)
- [validate-service.sh](/Users/robertfarris/map/aws/app/hooks/validate-service.sh)
- [map-app.conf](/Users/robertfarris/map/aws/app/nginx/map-app.conf)
- [map-api.service](/Users/robertfarris/map/aws/app/systemd/map-api.service)

Current deployment behavior:

- CodeBuild pins `BUN_VERSION=1.2.22`
- CodeBuild checks for `perl`, `rg`, and `rsync`
- CodeBuild requires:
  - `VITE_PARCELS_MANIFEST_URL`
  - `VITE_ENVIRONMENTAL_FLOOD_MANIFEST_URL`
  - `VITE_ENVIRONMENTAL_HYDRO_BASINS_MANIFEST_URL`
- CodeBuild now requires those manifest URLs to be `https://` URLs
- CodeBuild exports `VITE_TILE_MANIFEST_MODE=external`
- CodeBuild stages the curated artifact bundle with `rsync -a`
- CodeBuild now writes `aws/app/tile-delivery.env` into the artifact so the deployed host validates the exact manifest URLs baked into the web build
- the artifact now includes manifest-only workspace package manifests for:
  - `apps/docs`
  - `apps/pipeline-monitor`
  - `packages/bench`
  - `packages/fixtures`

Those extra manifests are included so root `bun install --frozen-lockfile` can run inside the staged artifact tree without lockfile drift.

Updated [after-install.sh](/Users/robertfarris/map/aws/app/hooks/after-install.sh):

- requires Bun `1.2.22`
- verifies Bun is available to the `deploy` user on the runtime PATH
- runs `bun install --frozen-lockfile` as `deploy` inside the staged artifact tree
- fails if `/etc/map-app/map-api.env` sets a non-`3001` `PORT`
- requires the deployed env file to include `DATABASE_URL`
- requires the deployed env file to include the FiberLocator upstream keys
- requires `FIBER_LOCATOR_SOURCE_MODE=external-xyz`

Updated [map-api.service](/Users/robertfarris/map/aws/app/systemd/map-api.service):

- service now forces `PORT=3001`
- runtime PATH stays aligned with the deploy-user Bun lookup

Updated [map-app.conf](/Users/robertfarris/map/aws/app/nginx/map-app.conf):

- removed `default_server`
- removed the local `/tiles/` location because this reduced deploy path now assumes external manifests plus external PMTiles delivery
- keeps nginx serving `apps/web/dist`
- keeps `/api` proxied to `127.0.0.1:3001`

Updated [validate-service.sh](/Users/robertfarris/map/aws/app/hooks/validate-service.sh):

- still validates nginx, the web root, and `/api/health`
- now validates `/api/geo/fiber-locator/layers` through the deployed API
- now sources `aws/app/tile-delivery.env`
- now runs `validate-tile-delivery.ts` against parcels, flood, and hydro-basins manifests
- now fails the deployment if the external manifest or PMTiles delivery contract is wrong

## Verification Completed

These checks passed during this pass:

- `bun test apps/api/test/http/app-hardening.test.ts`
  - passed
  - covers healthy `/api/health` and `503 DATABASE_UNAVAILABLE`
- `bun test packages/geo-tiles/test/tile-manifest.test.ts`
  - passed
  - covers manifest-origin PMTiles resolution and absolute manifest entry generation
- `bun test apps/web/test/features/layers/manifest-loading.service.test.ts`
  - passed
  - covers manifest fetch + PMTiles URL resolution against the manifest origin
- `bun run --cwd apps/api build`
  - passed
  - normalization reported `normalized external effect imports in 10 file(s)`
- `VITE_TILE_MANIFEST_MODE=external ... bun run build:deploy:app`
  - passed
  - built the reduced deploy graph for API, web, and workspace dependencies
- `bun test apps/api/test/geo/fiber-locator/fiber-locator-config.service.test.ts`
  - passed
  - covers the required FiberLocator env contract now enforced at startup
- `bun test scripts/validate-tile-delivery.test.ts`
  - passed
  - covers the external manifest and PMTiles delivery validator
- `bun run validate:tile-delivery --dataset=parcels-draw-v1 ...`
  - passed against a standalone local HTTP fixture server
- `bun run ./scripts/publish-tiles-to-s3.ts --dataset=parcels-draw-v1 --bucket=example-bucket --dry-run=1`
  - passed
  - rendered the expected S3 object keys and cache-control settings without mutating anything
- `bun install --frozen-lockfile`
  - passed after adding the root workspace links needed by the root tile scripts
- staged-artifact `bun install --frozen-lockfile`
  - passed again after adding the root workspace links required by the root tile scripts
- staged-artifact API boot using the local `apps/api/.env`
  - passed on `PORT=3902`
- staged-artifact health check using the packaged helper script
  - passed
  - returned `[health] ok http://127.0.0.1:3902/api/health`
- shell syntax validation for deploy hooks and helper scripts
  - passed earlier in this pass

## Issues Found And Fixed

1. Production API startup was broken after build.
The built API output contained relative imports like `../../effect`, which caused Bun runtime failures. Fixed with [normalize-api-dist-imports.sh](/Users/robertfarris/map/scripts/normalize-api-dist-imports.sh) and the updated [apps/api/package.json](/Users/robertfarris/map/apps/api/package.json).

2. Deploy validation could go green without a working database.
The API health route was static and startup did not prove database reachability. Fixed by adding `assertPostgresReady()` to startup and health handling so database unavailability now returns `503` and blocks service startup.

3. Cross-origin PMTiles manifest delivery was only partial.
The web could fetch an absolute manifest URL, but relative PMTiles asset URLs still resolved back to the app origin. Fixed by resolving relative PMTiles URLs against the manifest URL when the manifest is absolute, and by adding absolute manifest entry support to the publisher.

4. The staged artifact could not run `bun install --frozen-lockfile`.
The artifact tree was missing workspace manifests for members still present in the root lockfile. Fixed by adding the missing workspace package manifests to the bundle.

5. A normal web build could try to copy the local PMTiles tree into `dist`.
That hit `ENOSPC` in verification. Fixed by switching deploy builds to `public-static`, requiring external manifest env vars, and leaving PMTiles delivery outside the web `dist`.

6. FiberLocator was still treated like an optional runtime even though the shipped web boot initializes it automatically.
Fixed by making the env contract explicit in `.env.example`, enforcing `FIBER_LOCATOR_SOURCE_MODE=external-xyz`, validating the config at API startup, and making deploy validation hit the live FiberLocator API route.

7. The external PMTiles delivery contract was still tribal knowledge instead of encoded repo behavior.
Fixed by adding a dedicated delivery validator, generating a deploy-time tile-delivery contract file from CodeBuild, and adding a repo-side S3 publish script that sets the intended cache headers and optional CloudFront invalidation path.

8. Root-level tile scripts were not actually runnable from the repo root or the staged artifact.
The root package did not link the workspace packages those scripts import. Fixed by adding `@map-migration/geo-tiles` and `@map-migration/ops` as root workspace devDependencies and revalidating frozen installs in both the repo root and a staged artifact tree.

## Still Deferred

Still not done in this pass:

- EC2 bootstrap automation
- worker deployment and systemd wiring
- DNS cutover
- docs deployment target
- pipeline monitor deployment target
- the remaining AWS resource creation beyond the playground tile bucket

## Current Next Step

The next infra step is AWS-side wiring against this repo state:

- publish the remaining datasets needed for the first-pass web build into `dch-playground-tiles`
- create the artifact bucket for CodeBuild/CodeDeploy bundles
- create the CodeBuild project with the currently required parcels manifest env var
- create the CodeDeploy app and deployment group
- bootstrap the EC2 host with Bun, nginx, and the CodeDeploy agent
- place `/etc/map-app/map-api.env` on the instance

AWS execution has started with the playground tile bucket. No application deployment has been run yet.

## AWS Progress

### Step 1 completed: playground tile bucket

Created the first real AWS resource for the reduced deploy path:

- account: `067665647218`
- role: `AWSReservedSSO_DCHDeveloper_d97a3a81deb87603`
- region: `us-east-2`
- bucket: `dch-playground-tiles`
- bucket ARN: `arn:aws:s3:::dch-playground-tiles`

Applied and verified:

- S3 public access block:
  - `BlockPublicAcls=true`
  - `IgnorePublicAcls=true`
  - `BlockPublicPolicy=true`
  - `RestrictPublicBuckets=true`
- versioning:
  - `Status=Enabled`
- default encryption:
  - `SSEAlgorithm=AES256`
  - `BucketKeyEnabled=true`
- ownership controls:
  - `ObjectOwnership=BucketOwnerEnforced`
- tags:
  - `Project=map`
  - `Environment=playground`
  - `ManagedBy=codex`
  - `Name=dch-playground-tiles`

Commands executed and verified:

- `aws s3api list-objects-v2 --bucket dch-staging-map-tiles-067665647218 --max-keys 5`
- `aws s3api delete-bucket --bucket dch-staging-map-tiles-067665647218 --region us-east-2`
- `aws s3api head-bucket --bucket dch-staging-map-tiles-067665647218`
- `aws s3api create-bucket --bucket dch-playground-tiles --region us-east-2 --create-bucket-configuration LocationConstraint=us-east-2`
- `aws s3api put-public-access-block --bucket dch-playground-tiles ...`
- `aws s3api put-bucket-versioning --bucket dch-playground-tiles ...`
- `aws s3api put-bucket-encryption --bucket dch-playground-tiles ...`
- `aws s3api put-bucket-ownership-controls --bucket dch-playground-tiles ...`
- `aws s3api put-bucket-tagging --bucket dch-playground-tiles ...`
- `aws s3api get-public-access-block --bucket dch-playground-tiles`
- `aws s3api get-bucket-versioning --bucket dch-playground-tiles`
- `aws s3api get-bucket-encryption --bucket dch-playground-tiles`
- `aws s3api get-bucket-tagging --bucket dch-playground-tiles`
- `aws s3api get-bucket-ownership-controls --bucket dch-playground-tiles`

This bucket is now ready to serve as the CloudFront origin for:

- `/tiles/parcels-draw-v1/latest.json`
- `/tiles/parcels-draw-v1/<version>.pmtiles`
- `/tiles/environmental-flood/latest.json`
- `/tiles/environmental-flood/<version>.pmtiles`
- `/tiles/environmental-hydro-basins/latest.json`
- `/tiles/environmental-hydro-basins/<version>.pmtiles`

Next AWS step:
### Step 2 completed: CloudFront distribution for playground tiles

Created the CloudFront delivery layer in front of the private tile bucket:

- distribution id: `E1FYLS6DE8BOXI`
- distribution ARN: `arn:aws:cloudfront::067665647218:distribution/E1FYLS6DE8BOXI`
- CloudFront domain: `d1cf1x3z5qnthi.cloudfront.net`
- comment: `dch playground tiles`
- origin: `dch-playground-tiles.s3.us-east-2.amazonaws.com`
- origin access control id: `E20KHW2RLCWBE1`
- cache policy id: `d4c18641-e05a-4572-8038-fe7040970b25`

CloudFront configuration applied:

- private S3 origin using OAC, not a public bucket
- `ViewerProtocolPolicy=redirect-to-https`
- `Compress=false`
- `PriceClass_100`
- cache policy with:
  - `MinTTL=0`
  - `DefaultTTL=60`
  - `MaxTTL=31536000`
  - no cookies
  - no headers
  - no query strings
  - no edge gzip/brotli normalization in the cache key

Bucket access model applied:

- created an OAC named `dch-playground-tiles-s3-oac`
- attached a bucket policy allowing `cloudfront.amazonaws.com`
- scoped the policy to `arn:aws:cloudfront::067665647218:distribution/E1FYLS6DE8BOXI`
- raw S3 object access remains private

Verification completed:

- `aws cloudfront get-distribution --id E1FYLS6DE8BOXI`
  - confirmed `Status=Deployed`
  - confirmed origin, OAC, cache policy, and viewer protocol policy
- `aws s3api get-bucket-policy --bucket dch-playground-tiles`
  - confirmed the bucket policy only trusts this distribution ARN
- `curl -I https://d1cf1x3z5qnthi.cloudfront.net/tiles/.cloudfront-probe.txt`
  - returned `HTTP/2 200`
  - returned `Cache-Control: public,max-age=60`
  - returned `Accept-Ranges: bytes`
  - came through CloudFront (`x-cache`, `via`, `x-amz-cf-*` headers)
- `curl -I http://d1cf1x3z5qnthi.cloudfront.net/tiles/.cloudfront-probe.txt`
  - returned `301`
  - redirected to `https://...`
- `curl -I https://dch-playground-tiles.s3.us-east-2.amazonaws.com/tiles/.cloudfront-probe.txt`
  - returned `403`
  - confirms the bucket is not publicly readable outside CloudFront

Temporary verification artifact:

- uploaded `s3://dch-playground-tiles/tiles/.cloudfront-probe.txt`
- verified public CloudFront access and private S3 access
- deleted the probe object after verification

Current public tile base:

- `https://d1cf1x3z5qnthi.cloudfront.net/tiles`

Next AWS step:

### Step 3 completed: parcels PMTiles + manifest published and verified

Published the current parcels tileset into the playground tile bucket:

- dataset: `parcels-draw-v1`
- manifest key: `tiles/parcels-draw-v1/latest.json`
- PMTiles key: `tiles/parcels-draw-v1/20260305.b38d54c9.pmtiles`
- public manifest URL: `https://d1cf1x3z5qnthi.cloudfront.net/tiles/parcels-draw-v1/latest.json`
- public PMTiles URL: `https://d1cf1x3z5qnthi.cloudfront.net/tiles/parcels-draw-v1/20260305.b38d54c9.pmtiles`

Publish command executed:

- `bun run ./scripts/publish-tiles-to-s3.ts --dataset=parcels-draw-v1 --bucket=dch-playground-tiles`

Published object metadata verified in S3:

- `aws s3api head-object --bucket dch-playground-tiles --key tiles/parcels-draw-v1/latest.json`
  - `CacheControl=public,max-age=60`
  - `ContentType=application/json`
  - `VersionId=DbjNuEt.kdK.QMW5NzGq7IlKsJTmht91`
  - `ContentLength=637`
- `aws s3api head-object --bucket dch-playground-tiles --key tiles/parcels-draw-v1/20260305.b38d54c9.pmtiles`
  - `CacheControl=public,max-age=31536000,immutable`
  - `ContentType=application/octet-stream`
  - `VersionId=.Edj7mGj3Ecohm.7nejVlnu2tjz1FWon`
  - `ContentLength=16072881481`

Public delivery verified through CloudFront:

- `curl -I https://d1cf1x3z5qnthi.cloudfront.net/tiles/parcels-draw-v1/latest.json`
  - returned `HTTP/2 200`
  - returned `Cache-Control: public,max-age=60`
- `curl -s -D - -H 'Range: bytes=0-15' https://d1cf1x3z5qnthi.cloudfront.net/tiles/parcels-draw-v1/20260305.b38d54c9.pmtiles -o /dev/null`
  - returned `HTTP/2 206`
  - returned `Content-Range: bytes 0-15/16072881481`
  - returned `Cache-Control: public,max-age=31536000,immutable`
- `curl -s https://d1cf1x3z5qnthi.cloudfront.net/tiles/parcels-draw-v1/latest.json`
  - returned the expected `20260305.b38d54c9` parcel manifest

Validator result:

- initial real-CloudFront validation exposed a repo bug: the validator incorrectly required `Accept-Ranges: bytes` even when CloudFront was already serving a valid `206` + `Content-Range` response
- fixed [validate-tile-delivery.ts](/Users/robertfarris/map/scripts/validate-tile-delivery.ts) to treat `206` + correct `Content-Range` as the hard requirement and only enforce `Accept-Ranges` when the header is present
- added coverage in [validate-tile-delivery.test.ts](/Users/robertfarris/map/scripts/validate-tile-delivery.test.ts) for the missing-header case
- `bun test scripts/validate-tile-delivery.test.ts`
  - passed
- `bun run validate:tile-delivery --dataset=parcels-draw-v1 --manifest-url=https://d1cf1x3z5qnthi.cloudfront.net/tiles/parcels-draw-v1/latest.json`
  - passed against the real CloudFront endpoint

Current public base for first-pass tile delivery:

- `https://d1cf1x3z5qnthi.cloudfront.net/tiles`

Next AWS step:

- create the artifact bucket for CodeBuild/CodeDeploy bundles

### Step 4 completed: artifact bucket for app deployments

Created the S3 bucket that will hold CodeBuild/CodeDeploy application bundles:

- bucket: `dch-playground-artifacts-067665647218`
- bucket ARN: `arn:aws:s3:::dch-playground-artifacts-067665647218`
- region: `us-east-2`
- intended use: CodeBuild output artifacts and CodeDeploy revision bundles for the reduced `apps/api` + `apps/web` deployment

Applied and verified:

- S3 public access block:
  - `BlockPublicAcls=true`
  - `IgnorePublicAcls=true`
  - `BlockPublicPolicy=true`
  - `RestrictPublicBuckets=true`
- versioning:
  - `Status=Enabled`
- default encryption:
  - `SSEAlgorithm=AES256`
  - `BucketKeyEnabled=true`
- ownership controls:
  - `ObjectOwnership=BucketOwnerEnforced`
- tags:
  - `Project=map`
  - `Environment=playground`
  - `ManagedBy=codex`
  - `Name=dch-playground-artifacts-067665647218`
- object inventory:
  - bucket is currently empty (`KeyCount=0`)

Commands executed and verified:

- `aws s3api create-bucket --bucket dch-playground-artifacts-067665647218 --region us-east-2 --create-bucket-configuration LocationConstraint=us-east-2`
- `aws s3api put-public-access-block --bucket dch-playground-artifacts-067665647218 ...`
- `aws s3api put-bucket-versioning --bucket dch-playground-artifacts-067665647218 ...`
- `aws s3api put-bucket-encryption --bucket dch-playground-artifacts-067665647218 ...`
- `aws s3api put-bucket-ownership-controls --bucket dch-playground-artifacts-067665647218 ...`
- `aws s3api put-bucket-tagging --bucket dch-playground-artifacts-067665647218 ...`
- `aws s3api get-public-access-block --bucket dch-playground-artifacts-067665647218`
- `aws s3api get-bucket-versioning --bucket dch-playground-artifacts-067665647218`
- `aws s3api get-bucket-encryption --bucket dch-playground-artifacts-067665647218`
- `aws s3api get-bucket-ownership-controls --bucket dch-playground-artifacts-067665647218`
- `aws s3api get-bucket-tagging --bucket dch-playground-artifacts-067665647218`
- `aws s3api list-objects-v2 --bucket dch-playground-artifacts-067665647218 --max-keys 5`

Note from creation:

- `put-bucket-encryption`, `put-bucket-ownership-controls`, and `put-bucket-tagging` briefly returned transient `OperationAborted` responses immediately after bucket creation while S3 was still settling the new bucket state
- rerunning those calls succeeded without changing the intended configuration

Next AWS step:

- create the IAM roles and instance profile needed for the app deploy path:
  - CodeDeploy service role
  - EC2 instance profile role for the app host

### Step 5 completed: CodeBuild service role

Created the service role for the reduced `apps/api` + `apps/web` build project:

- role name: `dch-playground-map-app-codebuild-role`
- role ARN: `arn:aws:iam::067665647218:role/dch-playground-map-app-codebuild-role`
- inline policy name: `dch-playground-map-app-codebuild-inline`

Trust policy verified:

- principal: `codebuild.amazonaws.com`
- action: `sts:AssumeRole`

Inline policy scope verified:

- CloudWatch Logs for `/aws/codebuild/*` in `us-east-2`
  - `logs:CreateLogGroup`
  - `logs:CreateLogStream`
  - `logs:PutLogEvents`
- CodeBuild report groups in this account/region
  - `codebuild:CreateReportGroup`
  - `codebuild:CreateReport`
  - `codebuild:UpdateReport`
  - `codebuild:BatchPutTestCases`
  - `codebuild:BatchPutCodeCoverages`
- artifact bucket access limited to `dch-playground-artifacts-067665647218`
  - bucket:
    - `s3:GetBucketLocation`
    - `s3:ListBucket`
  - objects:
    - `s3:GetObject`
    - `s3:GetObjectVersion`
    - `s3:PutObject`
    - `s3:DeleteObject`
    - `s3:AbortMultipartUpload`

Commands executed and verified:

- `aws iam create-role --role-name dch-playground-map-app-codebuild-role --assume-role-policy-document file:///tmp/dch-playground-map-app-codebuild-trust.json --description 'CodeBuild service role for dch playground map app builds'`
- `aws iam put-role-policy --role-name dch-playground-map-app-codebuild-role --policy-name dch-playground-map-app-codebuild-inline --policy-document file:///tmp/dch-playground-map-app-codebuild-policy.json`
- `aws iam get-role --role-name dch-playground-map-app-codebuild-role`
- `aws iam list-role-policies --role-name dch-playground-map-app-codebuild-role`
- `aws iam get-role-policy --role-name dch-playground-map-app-codebuild-role --policy-name dch-playground-map-app-codebuild-inline`
- `aws codestar-connections list-connections`
- `aws codestar-connections get-connection --connection-arn arn:aws:codestar-connections:us-east-2:067665647218:connection/2a4584b1-57a1-4044-9910-82f29402fa08`

GitHub source connection wired:

- existing connection discovered:
  - name: `dch-hawksuite`
  - ARN: `arn:aws:codestar-connections:us-east-2:067665647218:connection/2a4584b1-57a1-4044-9910-82f29402fa08`
  - provider: `GitHub`
  - status: `AVAILABLE`
- the inline policy now also grants:
  - `codestar-connections:UseConnection`
  - scoped to that exact connection ARN
- this is the permission CodeBuild will need when the build project is configured to pull source directly from `https://github.com/datacenterHawk/playground.git`

Next AWS step:

- create the CodeBuild project for the reduced app deploy path

### Step 7 completed: EC2 app-host role and instance profile

Created the app-host IAM resources for the reduced EC2 deployment target:

- role name: `dch-playground-map-app-ec2-role`
- role ARN: `arn:aws:iam::067665647218:role/dch-playground-map-app-ec2-role`
- inline policy name: `dch-playground-map-app-ec2-inline`
- instance profile name: `dch-playground-map-app-instance-profile`
- instance profile ARN: `arn:aws:iam::067665647218:instance-profile/dch-playground-map-app-instance-profile`

Trust policy verified:

- principal: `ec2.amazonaws.com`
- action: `sts:AssumeRole`

Inline policy scope verified:

- artifact bucket read/list access limited to `dch-playground-artifacts-067665647218`
  - bucket:
    - `s3:GetBucketLocation`
    - `s3:ListBucket`
  - objects:
    - `s3:GetObject`
    - `s3:GetObjectVersion`

Instance profile membership verified:

- `dch-playground-map-app-instance-profile` contains `dch-playground-map-app-ec2-role`

Commands executed and verified:

- `aws iam create-role --role-name dch-playground-map-app-ec2-role ...`
- `aws iam put-role-policy --role-name dch-playground-map-app-ec2-role --policy-name dch-playground-map-app-ec2-inline ...`
- `aws iam create-instance-profile --instance-profile-name dch-playground-map-app-instance-profile`
- `aws iam add-role-to-instance-profile --instance-profile-name dch-playground-map-app-instance-profile --role-name dch-playground-map-app-ec2-role`
- `aws iam get-role --role-name dch-playground-map-app-ec2-role`
- `aws iam list-role-policies --role-name dch-playground-map-app-ec2-role`
- `aws iam get-role-policy --role-name dch-playground-map-app-ec2-role --policy-name dch-playground-map-app-ec2-inline`
- `aws iam get-instance-profile --instance-profile-name dch-playground-map-app-instance-profile`

Next AWS step:

- create the CodeBuild project for the reduced app deploy path

### Step 8 completed: CodeBuild project

Created the reduced app build project in CodeBuild:

- project name: `dch-playground-map-app-build`
- project ARN: `arn:aws:codebuild:us-east-2:067665647218:project/dch-playground-map-app-build`
- source repo: `https://github.com/datacenterHawk/playground.git`
- source branch: `main`
- buildspec: `aws/app/buildspec.yml`
- service role: `arn:aws:iam::067665647218:role/dch-playground-map-app-codebuild-role`
- image: `aws/codebuild/standard:7.0`
- compute type: `BUILD_GENERAL1_MEDIUM`
- artifact bucket: `dch-playground-artifacts-067665647218`
- artifact path: `codebuild`
- artifact packaging: `ZIP`

Environment configured:

- `VITE_PARCELS_MANIFEST_URL=https://d1cf1x3z5qnthi.cloudfront.net/tiles/parcels-draw-v1/latest.json`
- flood and hydro manifest URLs are intentionally omitted for this playground pass

Verification completed:

- `aws codebuild create-project --cli-input-json file:///tmp/dch-playground-map-app-build-project.json`
- `aws codebuild batch-get-projects --names dch-playground-map-app-build`
- `aws codebuild list-projects`

Verified persisted settings:

- source type: `GITHUB`
- artifacts type: `S3`
- CloudWatch Logs enabled with group `/aws/codebuild/dch-playground-map-app-build`
- project visibility: `PRIVATE`
- tags:
  - `Project=map`
  - `Environment=playground`
  - `ManagedBy=codex`
  - `Name=dch-playground-map-app-build`

Important note from creation:

- initial creation using the existing CodeStar connection ARN failed with `OAuthProviderException`
- this AWS account already has a legacy CodeBuild GitHub OAuth credential (`arn:aws:codebuild:us-east-2:067665647218:token/github`)
- sibling projects are already using that legacy `type=GITHUB` source path, so this project was created on the same path
- the separate `dch-hawksuite` CodeStar connection still exists and is `AVAILABLE`, but it was not used for this CodeBuild project

Next AWS step:

- launch and bootstrap the EC2 app host

### Step 9 completed: CodeDeploy application and deployment group

Created the CodeDeploy resources for the reduced EC2-backed app deploy path:

- application name: `dch-playground-map-app`
- application id: `8b8b8e31-c9bd-4944-83ba-c3f3f0808940`
- compute platform: `Server`
- deployment group name: `dch-playground-map-app`
- deployment group id: `546ee3c9-17c6-4a6f-a01f-b48e97434620`

Deployment group configuration verified:

- service role: `arn:aws:iam::067665647218:role/dch-playground-map-app-codedeploy-role`
- deployment config: `CodeDeployDefault.OneAtATime`
- deployment style:
  - `IN_PLACE`
  - `WITHOUT_TRAFFIC_CONTROL`
- auto scaling groups:
  - none
- termination hook:
  - disabled

EC2 tag targeting verified:

- the future app host must match all of these tags to join the deployment group:
  - `Project=map`
  - `Environment=playground`
  - `DeployTarget=app`

Commands executed and verified:

- `aws deploy create-application --application-name dch-playground-map-app --compute-platform Server`
- `aws deploy create-deployment-group --application-name dch-playground-map-app --deployment-group-name dch-playground-map-app --service-role-arn arn:aws:iam::067665647218:role/dch-playground-map-app-codedeploy-role --deployment-config-name CodeDeployDefault.OneAtATime --deployment-style deploymentType=IN_PLACE,deploymentOption=WITHOUT_TRAFFIC_CONTROL --ec2-tag-set 'ec2TagSetList=[[{Key=Project,Value=map,Type=KEY_AND_VALUE}],[{Key=Environment,Value=playground,Type=KEY_AND_VALUE}],[{Key=DeployTarget,Value=app,Type=KEY_AND_VALUE}]]'`
- `aws deploy get-application --application-name dch-playground-map-app`
- `aws deploy get-deployment-group --application-name dch-playground-map-app --deployment-group-name dch-playground-map-app`
- `aws deploy list-applications`

Next AWS step:

### Step 10 completed: EC2 app host launched

Created the playground app-host access and launch resources:

- SSH key pair:
  - name: `dch-playground-map-app`
  - key pair id: `key-09e3c46c48aee7b68`
  - private key path on this machine: `~/.ssh/dch-playground-map-app.pem`
- dedicated security group:
  - id: `sg-007e44d5bc7a14c36`
  - name: `dch-playground-map-app`
  - VPC: `vpc-00c21b0c13702a004`

Security group rules verified:

- ingress:
  - `tcp/80` from `0.0.0.0/0`
  - `tcp/443` from `0.0.0.0/0`
  - `tcp/22` from `107.139.71.138/32`
- egress:
  - all traffic to `0.0.0.0/0`

Launched the EC2 host:

- instance id: `i-0c7760366e0ebd367`
- name tag: `dch-playground-map-app`
- state: `running`
- AMI: `ami-0a109de184430498e`
  - `al2023-ami-2023.10.20260302.1-kernel-6.12-x86_64`
- instance type: `t3a.large`
- subnet: `subnet-06720607ed289d230`
- AZ: `us-east-2b`
- private IP: `172.31.17.90`
- public IP: `3.145.130.45`
- instance profile: `arn:aws:iam::067665647218:instance-profile/dch-playground-map-app-instance-profile`
- key pair: `dch-playground-map-app`
- attached security group: `sg-007e44d5bc7a14c36`

Instance tags verified:

- `Name=dch-playground-map-app`
- `Project=map`
- `Environment=playground`
- `DeployTarget=app`
- `ManagedBy=codex`

Root volume verified:

- volume id: `vol-0beeda7a7bddb2c57`
- size: `50 GiB`
- type: `gp3`
- delete on termination: `true`
- encrypted: `false`

Commands executed and verified:

- `aws ec2 create-key-pair --key-name dch-playground-map-app`
- `aws ec2 create-security-group --group-name dch-playground-map-app --description 'Playground map app host' --vpc-id vpc-00c21b0c13702a004 ...`
- `aws ec2 authorize-security-group-ingress --group-id sg-007e44d5bc7a14c36 ...`
- `aws ec2 run-instances --image-id ami-0a109de184430498e --instance-type t3a.large --key-name dch-playground-map-app --security-group-ids sg-007e44d5bc7a14c36 --subnet-id subnet-06720607ed289d230 --iam-instance-profile Name=dch-playground-map-app-instance-profile ...`
- `aws ec2 wait instance-running --instance-ids i-0c7760366e0ebd367`
- `aws ec2 describe-instances --instance-ids i-0c7760366e0ebd367`
- `aws ec2 describe-security-groups --group-ids sg-007e44d5bc7a14c36`
- `aws ec2 describe-volumes --volume-ids vol-0beeda7a7bddb2c57`
- `aws ec2 describe-key-pairs --key-names dch-playground-map-app`

Next AWS step:

### Step 11 completed: EC2 host bootstrap

Bootstrapped the app host at `3.145.130.45`:

- OS confirmed:
  - Amazon Linux 2023 (`PRETTY_NAME="Amazon Linux 2023.10.20260302"`)
- packages installed:
  - `nginx`
  - `ruby`
  - `wget`
  - `jq`
  - `git`
  - `unzip`
- CodeDeploy agent installed from the official regional installer:
  - `https://aws-codedeploy-us-east-2.s3.us-east-2.amazonaws.com/latest/install`
- deploy user created:
  - `deploy`
- Bun installed for the deploy user:
  - version `1.2.22`

Runtime layout created:

- `/home/deploy/map`
- `/home/deploy/map/var`
- `/home/deploy/map/.cache`
- `/home/deploy/map/log`
- `/etc/map-app`
- `/etc/map-app/map-api.env.example`

Service state verified:

- `nginx`
  - enabled
  - active
  - version `1.28.2`
- `codedeploy-agent`
  - enabled
  - active
- nginx responds locally:
  - `curl -I http://127.0.0.1/`
  - returned `HTTP/1.1 200 OK`

Deploy-user runtime verified:

- `id deploy`
  - returned `uid=1001(deploy) gid=1001(deploy)`
- `sudo -u deploy /home/deploy/.bun/bin/bun --version`
  - returned `1.2.22`

Commands executed and verified:

- `ssh ec2-user@3.145.130.45 'sudo dnf install -y nginx ruby wget jq git unzip'`
- `ssh ec2-user@3.145.130.45 'wget -q https://aws-codedeploy-us-east-2.s3.us-east-2.amazonaws.com/latest/install -O /tmp/codedeploy-install && sudo /tmp/codedeploy-install auto'`
- `ssh ec2-user@3.145.130.45 'sudo useradd -m -d /home/deploy -s /bin/bash deploy'`
- `ssh ec2-user@3.145.130.45 'sudo install -d -o deploy -g deploy ...'`
- `ssh ec2-user@3.145.130.45 'sudo systemctl enable nginx && sudo systemctl start nginx'`
- `ssh ec2-user@3.145.130.45 'sudo systemctl enable codedeploy-agent && sudo systemctl start codedeploy-agent'`
- `ssh ec2-user@3.145.130.45 'sudo -u deploy bash -lc \"curl -fsSL https://bun.sh/install | bash -s -- bun-v1.2.22\"'`
- `scp apps/api/.env.example ec2-user@3.145.130.45:/tmp/map-api.env.example`
- `ssh ec2-user@3.145.130.45 'sudo mv /tmp/map-api.env.example /etc/map-app/map-api.env.example'`

Bootstrap note:

- the first package-install attempt failed because Amazon Linux 2023 ships `curl-minimal`, and explicitly installing `curl` created a package conflict
- rerunning the bootstrap without the full `curl` package succeeded

Current blocker before the first deployment:

- `/etc/map-app/map-api.env` is still not present
- the discovered local repo env points Postgres at `localhost`, which is not valid for this EC2 host
- no Postgres RDS instance was found in this AWS account during verification
- the real deploy env file still needs the actual reachable Postgres connection and required FiberLocator values

Next AWS step:

- create and place the real `/etc/map-app/map-api.env`
- then trigger the first CodeBuild build and create the first CodeDeploy deployment

### Step 6 completed: CodeDeploy service role

Created the service role for the reduced EC2-backed CodeDeploy path:

- role name: `dch-playground-map-app-codedeploy-role`
- role ARN: `arn:aws:iam::067665647218:role/dch-playground-map-app-codedeploy-role`

Trust policy verified:

- principal: `codedeploy.amazonaws.com`
- action: `sts:AssumeRole`

Managed policy attached and verified:

- policy name: `AWSCodeDeployRole`
- policy ARN: `arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole`
- policy path: `/service-role/`
- AWS description: `Provides CodeDeploy service access to expand tags and interact with Auto Scaling on your behalf.`

Commands executed and verified:

- `aws iam list-policies --scope AWS --query "Policies[?contains(PolicyName, 'CodeDeployRole')].[PolicyName,Arn]" --output table`
- `aws iam create-role --role-name dch-playground-map-app-codedeploy-role --assume-role-policy-document file:///tmp/dch-playground-map-app-codedeploy-trust.json --description 'CodeDeploy service role for dch playground map app deployments'`
- `aws iam attach-role-policy --role-name dch-playground-map-app-codedeploy-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole`
- `aws iam get-role --role-name dch-playground-map-app-codedeploy-role`
- `aws iam list-attached-role-policies --role-name dch-playground-map-app-codedeploy-role`
- `aws iam get-policy --policy-arn arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole`

Next AWS step:

- create the EC2 instance profile role for the app host

Revisit note:

- FiberLocator is not part of the PMTiles publish path for this playground setup.
- Fiber lines continue to load directly from the configured FiberLocator upstream via `FIBER_LOCATOR_SOURCE_MODE=external-xyz`.
- CodeBuild and deploy validation are intentionally parcels-only right now for the playground pass.
- Only the PMTiles-backed datasets still need AWS tile publication follow-up:
  - `environmental-flood`
  - `environmental-hydro-basins`

### Step 12 completed: PostgreSQL RDS for the playground app

Created the first dedicated Postgres RDS instance for this playground deployment:

- DB identifier: `dch-playground-map-postgres`
- engine: `postgres`
- engine version: `17.6`
- instance class: `db.t4g.micro`
- database name: `mapapp`
- master username: `mapapp`
- endpoint: `dch-playground-map-postgres.cdlhgq5au2ly.us-east-2.rds.amazonaws.com`
- port: `5432`
- storage: `20 GiB gp3`
- storage encrypted: `true`
- publicly accessible: `false`
- subnet group: `rds-ec2-db-subnet-group-1`

Database network access was isolated to the app host only:

- DB security group: `sg-08dc0544c6b99a24a`
- security group name: `dch-playground-map-postgres`
- ingress:
  - `tcp/5432`
  - source security group: `sg-007e44d5bc7a14c36` (`dch-playground-map-app`)

Creation notes:

- the first create attempt used `DBName=map` and failed because `map` is a reserved Postgres database name on RDS
- the second create attempt used `--manage-master-user-password` and failed with `KMSKeyNotAccessibleFault`
- the final successful create used an explicit generated password stored locally at `~/.ssh/dch-playground-map-postgres.password`

Database runtime verification completed:

- EC2 host TCP connectivity to RDS verified:
  - `db-port-open`
- `psql` installed on the app host:
  - `psql (PostgreSQL) 17.8`
- authenticated from the app host to the new RDS instance
- enabled PostGIS in the target database:
  - `CREATE EXTENSION IF NOT EXISTS postgis;`
- verified PostGIS version from the host against the live database:
  - `3.5.1`

Commands executed and verified:

- `aws ec2 create-security-group --group-name dch-playground-map-postgres --description 'Postgres access for dch playground map app' --vpc-id vpc-02159c8fef2df5f46`
- `aws ec2 authorize-security-group-ingress --group-id sg-08dc0544c6b99a24a --ip-permissions '[{\"IpProtocol\":\"tcp\",\"FromPort\":5432,\"ToPort\":5432,\"UserIdGroupPairs\":[{\"GroupId\":\"sg-007e44d5bc7a14c36\",\"Description\":\"app-host\"}]}]'`
- `aws rds create-db-instance --db-instance-identifier dch-playground-map-postgres ... --db-name mapapp ...`
- `aws rds wait db-instance-available --db-instance-identifier dch-playground-map-postgres`
- `ssh ec2-user@3.145.130.45 'timeout 5 bash -lc \"</dev/tcp/dch-playground-map-postgres.cdlhgq5au2ly.us-east-2.rds.amazonaws.com/5432\" && echo db-port-open'`
- `ssh ec2-user@3.145.130.45 'psql --version'`
- `ssh ec2-user@3.145.130.45 'PGPASSWORD=... psql \"host=dch-playground-map-postgres.cdlhgq5au2ly.us-east-2.rds.amazonaws.com ...\" -c \"create extension if not exists postgis;\" -c \"select postgis_full_version();\"'`

### Step 13 completed: Live API env file placed on the EC2 host

Placed the real API environment file on the host so the deployed systemd unit can use the new RDS instance:

- env file path: `/etc/map-app/map-api.env`
- ownership: `root:root`
- mode: `600`

The env file now includes the required live runtime contract for this playground pass:

- `NODE_ENV=production`
- `PORT=3001`
- `DATABASE_URL=postgres://mapapp:***@dch-playground-map-postgres.cdlhgq5au2ly.us-east-2.rds.amazonaws.com:5432/mapapp?sslmode=require`
- `BOUNDARIES_SOURCE_MODE=postgis`
- `FACILITIES_SOURCE_MODE=postgis`
- `PARCELS_SOURCE_MODE=postgis`
- `API_DATA_VERSION=playground`
- `AUTO_PARCELS_SYNC=false`
- `EXPOSE_SYNC_INTERNALS=false`
- `FIBER_LOCATOR_SOURCE_MODE=external-xyz`
- `FIBERLOCATOR_API_BASE_URL` from the existing local API env
- `FIBERLOCATOR_STATIC_TOKEN` from the existing local API env
- `FIBERLOCATOR_LINE_IDS` from the existing local API env

Host verification completed:

- file exists with the expected owner and permissions
- the expected key set is present
- sourcing `/etc/map-app/map-api.env` on the host and running `psql "$DATABASE_URL"` succeeds
- the sourced env connects to the expected database/user and returns a PostGIS version

Important state note:

- this completes infrastructure creation for the live Postgres endpoint and host env wiring
- it does **not** mean the database has the application schema or data loaded yet
- the RDS instance is currently a reachable, PostGIS-enabled target that still needs the actual dataset/schema import path

### Step 14 in progress: source Postgres dataset load into RDS

Started the real data-load step from the existing local source database (`dch_os`) into the new RDS instance instead of trying to bootstrap the app from empty SQL shells.

Source database facts verified before the load:

- source database: `dch_os`
- source user: `dch`
- source database size: `183 GB`
- source `parcel_current.parcels` heap size: `27 GB`
- source `parcel_current.parcels` total relation size with indexes: `115 GB`
- source app-serving schemas present:
  - `serve`
  - `facility_current`
  - `market_current`
  - `analytics`
  - `environmental_current`
  - `parcel_current`

RDS sizing change applied before the large copy:

- original RDS size/class:
  - `db.t4g.micro`
  - `20 GiB`
- updated RDS size/class:
  - `db.t4g.small`
  - `250 GiB`

Verified after the modify:

- RDS status returned with:
  - class `db.t4g.small`
  - allocated storage `250`
  - no pending modified values

Serving-schema restore completed successfully:

- restored schemas:
  - `serve`
  - `facility_current`
  - `market_current`
  - `analytics`
- restore path:
  - local `pg_dump`
  - piped over SSH to `psql` running on the EC2 host against RDS

Dependency issue discovered and fixed during restore:

- initial restore failed on:
  - `operator class "public.gin_trgm_ops" does not exist for access method "gin"`
- fixed by enabling:
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- reran the serving-schema restore cleanly after that

Verified row counts on RDS after the successful serving-schema restore:

- `analytics.county_market_pressure_current`
  - `3221`
- `analytics.dim_county`
  - `3221`
- `facility_current.providers`
  - `883`
- `market_current.market_boundaries`
  - `74`
- `market_current.markets`
  - `74`
- `serve.boundary_county_geom_lod1`
  - `3221`
- `serve.facility_site`
  - `5443`
- `serve.hyperscale_site`
  - `2031`

Environmental restore completed with the source database's current state:

- restored schemas:
  - `environmental_meta`
  - `environmental_current`
- verified row counts on RDS:
  - `environmental_meta.flood_runs`
    - `1`
  - `environmental_current.flood_hazard`
    - `0`

Environmental load note:

- the source `environmental_current.flood_hazard` table was empty at restore time
- a stale local flood-load `psql` transaction was found holding a lock on the source tables
- stale size-probe backends created during verification were terminated
- the stale flood-load backend (`pid 34834`) was terminated so the dump could proceed

Parcel restore status:

- active restore now running for:
  - `parcel_meta`
  - `parcel_current`
- restore path:
  - local `pg_dump`
  - piped over SSH to `psql` on the EC2 host against RDS
- target-side progress verified through `pg_stat_progress_copy`
- last observed live copy state during this log update:
  - relation: `parcel_current.parcels`
  - bytes processed: `7697728822`
  - tuples processed: `801061`

Interrupted-turn recovery note:

- a later interrupted turn killed the local parcel dump producer mid-stream
- the RDS backend was left hanging in:
  - `COPY parcel_current.parcels ...`
  - wait state `ClientRead`
- the stuck backend (`pid 1631`) was terminated on RDS
- the parcel restore was restarted cleanly with the same schema-scoped `pg_dump | psql` path

Current live parcel restore state after the clean restart:

- relation: `parcel_current.parcels`
- bytes processed: `1624963126`
- tuples processed: `166486`
- target parcel heap size observed on RDS:
  - `142 MB`

Current blocker before first deploy:

- the large `parcel_current.parcels` restore is still in progress
- first CodeBuild + CodeDeploy should wait until that copy and its index creation finish

Parcel import completion:

- `parcel_current` and `parcel_meta` are now fully present in RDS
- verified parcel indexes/constraints present:
  - `parcel_current.parcels_build_pk`
  - `parcel_current.parcels_build_geoid_idx`
  - `parcel_current.parcels_build_geom_3857_gist`
  - `parcel_current.parcels_build_state2_idx`
  - `parcel_meta.ingestion_runs_pkey`
  - `parcel_meta.ingestion_runs_data_version_idx`
  - `parcel_meta.ingestion_checkpoints_pkey`
  - `parcel_meta.ingestion_checkpoints_run_id_fkey`

First real AWS build/deploy pass:

- CodeBuild project:
  - `dch-playground-map-app-build`
- successful build:
  - build id `dch-playground-map-app-build:baae2c9d-475b-4296-968e-2ccf11266495`
  - source revision `769ed86ae321bb40fb5b08f30f5847f93e1d7ecd`
  - artifact key `codebuild/baae2c9d-475b-4296-968e-2ccf11266495/dch-playground-map-app-build.zip`
- successful CodeDeploy deployment:
  - deployment id `d-R5P8E5U0H`
  - status `Succeeded`
  - completed at `2026-03-12 06:55:10 CDT`

Build/deploy fixes required to get to green:

- pushed deploy-only fixes to GitHub for:
  - CodeBuild dependency install (`ripgrep`, `rsync`, `perl`)
  - Bun PATH visibility inside CodeBuild for Turborepo
  - POSIX-safe post-build packaging loop in `aws/app/buildspec.yml`
  - retrying `scripts/validate-api-health.sh` so CodeDeploy does not fail on API startup race
- EC2 host cleanup/fixes required during deployment:
  - removed stale `48G` `/home/ec2-user/parcel.dump` that had filled `/`
  - cleared stale CodeDeploy deployment-root contents
  - linked Bun into `/usr/local/bin/bun` and `/usr/local/bin/bunx` so root and systemd/runtime hooks could find it

Failed deployment attempts and resolved causes:

- deployment `d-BTGQ8CNQ4`
  - failed before bundle download because `/opt/codedeploy-agent/deployment-root` could not be created
  - root cause: root volume was full from leftover parcel dump
- deployment `d-OTH1S0U0H`
  - reached `AfterInstall` and failed because `aws/app/hooks/after-install.sh` could not find `bun` as root
  - root cause: Bun existed only under `/home/deploy/.bun/bin`
- deployment `d-8158VTU0H`
  - reached `ValidateService` and failed because `/api/health` was checked before the API listener was ready
  - root cause: single-shot API health helper with no retry

Live deploy verification after the successful deployment:

- web root:
  - `http://3.145.130.45/`
  - returned `HTTP/1.1 200 OK`
- API health through nginx:
  - `http://3.145.130.45/api/health`
  - returned `HTTP/1.1 200 OK`
- parcel manifest through CloudFront:
  - `https://d1cf1x3z5qnthi.cloudfront.net/tiles/parcels-draw-v1/latest.json`
  - returned `HTTP/2 200`
  - cache control `public,max-age=60`

Public exposure hardening applied after deploy:

- app host security group:
  - `sg-007e44d5bc7a14c36`
- removed public ingress:
  - revoked `80` from `0.0.0.0/0`
  - revoked `443` from `0.0.0.0/0`
- restricted ingress to current operator IP only:
  - `22` from `76.187.162.167/32`
  - `80` from `76.187.162.167/32`
  - `443` from `76.187.162.167/32`
- verified after restriction:
  - `http://3.145.130.45/api/health` still returns `200` from the current machine

Current security state:

- RDS remains private:
  - `PubliclyAccessible=false`
  - `5432` allowed only from app-host SG `sg-007e44d5bc7a14c36`
- app host is no longer open to the full public internet
- remaining cleanup item:
  - nginx still logs a warning about a conflicting default server config that should be removed later

Elastic IP attached for stable egress allowlisting:

- allocated Elastic IP:
  - allocation id `eipalloc-0c18d2c905ed294a2`
  - association id `eipassoc-08b469bd84e13f3b9`
  - public IP `18.216.8.178`
- attached to:
  - instance `i-0c7760366e0ebd367`
  - network interface `eni-09da142549fa71ca3`
- verified after association:
  - `http://18.216.8.178/api/health` returns `200`
- this is now the stable public IP to provide for third-party allowlisting

Post-deploy host cleanup:

- fixed nginx default-site conflict:
  - updated `aws/app/nginx/map-app.conf`
  - changed `server_name` from `_` to:
    - `18.216.8.178`
    - `127.0.0.1`
    - `localhost`
  - installed the updated config on-host at `/etc/nginx/conf.d/map-app.conf`
  - reloaded nginx successfully
  - verified `nginx -t` is clean with no conflicting `server_name "_"` warning
- recovered failed OS-level services caused by the earlier disk-full event:
  - `logrotate.service`
  - `update-motd.service`
- verified recovery steps:
  - ran `logrotate` manually after disk cleanup
  - reran `update-motd` successfully
  - reset failed unit state
  - `systemctl --failed` now returns zero failed units

VPN-gated ingress change:

- operator connected to VPN during access hardening
- current VPN egress IP detected locally:
  - `107.139.71.138`
- app host security group `sg-007e44d5bc7a14c36` updated to remove the prior non-VPN ingress IP
- current ingress restrictions:
  - `22` from `107.139.71.138/32`
  - `80` from `107.139.71.138/32`
  - `443` from `107.139.71.138/32`
- verified after the change from the current VPN connection:
  - `http://18.216.8.178/` returns `200`
  - `http://18.216.8.178/api/health` returns `200`
  - SSH to `ec2-user@18.216.8.178` still works
