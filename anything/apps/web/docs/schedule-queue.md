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
