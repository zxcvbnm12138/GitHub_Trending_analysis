# EC2 PM2 Deployment

This deployment shape runs two long-lived processes on one EC2 Linux host:

- `anything-web`: the React Router production web service.
- `anything-worker`: the schedule worker that claims due report jobs.

Nginx proxies public traffic to the web service on `127.0.0.1:3000`.

## One-time server setup

Install Node.js 20 or newer, PM2, and Nginx on the EC2 instance.

```bash
npm install -g pm2
sudo systemctl enable nginx
sudo systemctl start nginx
```

Clone the repository and build the web app.

```bash
git clone <repo-url> /srv/anything
cd /srv/anything/apps/web
npm ci
npm run build
mkdir -p .data
chmod 700 .data
```

Start both production processes.

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` with `sudo`, then run `pm2 save`
again if PM2 asks for it.

## Nginx

Copy the example config and change `server_name` to the real domain.

Ubuntu/Debian:

```bash
sudo cp deploy/nginx.anything.conf /etc/nginx/sites-available/anything.conf
sudo ln -s /etc/nginx/sites-available/anything.conf /etc/nginx/sites-enabled/anything.conf
sudo nginx -t
sudo systemctl reload nginx
```

Amazon Linux:

```bash
sudo cp deploy/nginx.anything.conf /etc/nginx/conf.d/anything.conf
sudo nginx -t
sudo systemctl reload nginx
```

Open ports `80` and `443` in the EC2 security group. Add TLS with your
preferred certificate flow after the HTTP proxy is working.

## Runtime configuration

Production configuration is managed from the admin Settings page and is written
to `.data/app-config.json` on the EC2 instance. Keep this file private:

```bash
chmod 700 .data
chmod 600 .data/app-config.json
```

Do not commit `.data/app-config.json`. Environment variables still override
Settings values when present. If you want Settings to be the source of truth,
leave `DIFY_API_URL`, `DIFY_API_KEY`, and `DATABASE_URL` unset in PM2.

Dify settings apply to new report generation requests immediately. Database
URL changes require reloading both PM2 processes because the database client is
created when the Node process starts.

```bash
pm2 reload ecosystem.config.cjs --update-env
```

After a reload, return to Settings and run the database self-check.

## Manual release

The agreed manual release flow is:

```bash
cd /srv/anything/apps/web
git pull
npm ci
npm run build
pm2 reload ecosystem.config.cjs --update-env
pm2 status
```

Then open the app, go to Settings, and run the relevant self-checks.

## Operations

Useful commands:

```bash
pm2 status
pm2 logs anything-web
pm2 logs anything-worker
pm2 reload ecosystem.config.cjs --update-env
npm run worker:schedule:bootstrap
npm run worker:schedule:once
```

If automatic reports stop running, check `anything-worker` logs first, then run
the Settings database self-check and `npm run worker:schedule:once`.
