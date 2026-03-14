# Dagster Control Plane

This code location is the bridge off the repo's custom tile-pipeline status and orchestration code.

It models each dataset as a small asset graph and invokes the existing dataset commands until the
underlying extract/load/build steps are split further.

## Local setup

1. Create a virtualenv and install `apps/dagster`:
   `python -m venv .venv && source .venv/bin/activate && pip install -e apps/dagster`
2. Copy `apps/dagster/.env.example` to `.env` and export the Dagster tokens outside git.
3. Start Dagster locally:
   `dagster dev -m map_dagster.definitions`

