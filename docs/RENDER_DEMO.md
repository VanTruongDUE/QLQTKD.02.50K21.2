# Render public demo

The Render Blueprint in `render.yaml` creates a temporary demo environment, not a production cinema service:

- The web service and PostgreSQL database use Render's Free plan. The database expires 30 days after creation; export any demo data before then.
- Render's free web service can spin down after inactivity. API requests can take about a minute while it starts again.
- The worker runs alongside the API in the same free web service. It pauses while the service is asleep.
- `PUBLIC_DEMO_MODE=true` enables demo catalog seeding and mock auto-success payments. No real payment is taken; do not use this environment for real ticket sales.
- SMTP and n8n are not configured by the Blueprint. E-ticket email delivery needs a mail provider and rotated n8n credentials.

## Connect the services

1. Create a Blueprint from this repository in Render and choose the Free plan for both resources.
2. After Render supplies the API service URL, open the Vercel project's Environment Variables and set `API_INTERNAL_URL` to that HTTPS origin without a trailing slash, for example `https://starlight-api.onrender.com`.
3. Set `NEXT_PUBLIC_API_URL` to `/api/v1` in Vercel so browser requests use the same-origin rewrite. Redeploy the Vercel project.
4. Confirm `https://<render-api-host>/api/v1/health` returns `{"ok":true}` and the Vercel home page can load the seeded catalog.

## Optional manager account

To create the first demo manager, add `INITIAL_MANAGER_EMAIL` and `INITIAL_MANAGER_PASSWORD` to the Render API service's environment variables. The password must be at least 16 characters. Restart the service; startup creates one manager scoped to the seeded cinemas. Remove both variables after the account is created. Staff accounts can then be created from the manager screen.

Generated JWT and QR secrets are stored by Render and shared by the API and its co-hosted worker. Do not copy values from `.env` into the Blueprint or commit them to Git.
