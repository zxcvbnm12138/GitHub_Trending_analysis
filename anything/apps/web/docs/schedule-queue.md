# Schedule Queue

The app uses a durable schedule job queue for automatic report generation.

## Process model

Run two long-lived processes in production:

```bash
npm run start
npm run worker:schedule
```

Build the web app before starting it:

```bash
npm run build
```

The web app saves schedule settings and enqueues the next `daily_report` job.
The worker polls the queue, claims due jobs, generates reports, and enqueues the
next run after completion.

## Useful commands

Create or refresh the queued job for the current schedule:

```bash
npm run worker:schedule:bootstrap
```

Run one worker polling pass without staying alive:

```bash
npm run worker:schedule:once
```

Run the long-lived worker:

```bash
npm run worker:schedule
```

## Environment

Required for real Dify generation:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=...
DIFY_API_URL=...
DIFY_API_KEY=...
```

`DIFY_API_URL`, `DIFY_API_KEY`, and `DATABASE_URL` can also be set from the
admin Settings page. Values are stored in `.data/app-config.json`, which must
remain server-private and uncommitted. Environment variables take precedence
over saved Settings values.

Dify changes apply to new generation requests immediately. Database URL changes
are read when the web service and schedule worker start, so restart both
processes after changing the database configuration.

The Settings page also includes self-check tools:

- Run all checks: verifies database configuration and runs the Dify workflow
  test when Dify is configured.
- Test Dify: runs the workflow once without saving a report.
- Test database: checks database connectivity, required tables, columns, and
  indexes.
- Initialize database: creates missing tables and adds missing columns/indexes;
  it does not delete or rewrite existing data.
- Migrate local data: manually imports reports, schedule, and queued jobs from
  `.data/trending-dashboard.json` into the configured database, skipping rows
  with IDs that already exist.

Optional:

```env
SCHEDULE_WORKER_POLL_MS=15000
SCHEDULE_WORKER_LIMIT=5
```

If `DATABASE_URL` is configured, jobs are stored in the
`report_generation_jobs` table. Without `DATABASE_URL`, local development uses
`.data/trending-dashboard.json`.

Production should use `DATABASE_URL`; the local `.data` file is only for
development and manual testing.

## Fallback endpoint

`/api/schedule/tick` remains available as an authenticated fallback or manual
test endpoint. It is no longer required for normal scheduling when the worker is
running.
