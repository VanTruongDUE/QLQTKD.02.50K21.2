# Render public demo

The Render Blueprint in `render.yaml` creates a temporary demo environment, not a production cinema service:

- The web service and PostgreSQL database use Render's Free plan. The database expires 30 days after creation; export any demo data before then.
- Render's free web service can spin down after inactivity. API requests can take about a minute while it starts again.
- The worker runs alongside the API in the same free web service. It pauses while the service is asleep.
- `PUBLIC_DEMO_MODE=true` enables demo catalog seeding and mock auto-success payments. No real payment is taken; do not use this environment for real ticket sales.
- SMTP and n8n are not configured by the Blueprint. E-ticket email delivery needs a mail provider and rotated n8n credentials.

## Connect the services

1. The `starlight-cinema-demo` Blueprint is connected to this repository on `main`; its API and PostgreSQL resources use the Free plan.
2. The Vercel Production environment has `API_INTERNAL_URL` set to the Render API origin and `NEXT_PUBLIC_API_URL=/api/v1`, so browser requests use the same-origin rewrite.
3. Pushes to `main` trigger the Production deployment. Confirm `https://starlight-api-0iy9.onrender.com/api/v1/health` returns `{"ok":true}` and the Vercel home page loads the seeded catalog.

## Optional manager account

To create the first demo manager, add `INITIAL_MANAGER_EMAIL` and `INITIAL_MANAGER_PASSWORD` to the Render API service's environment variables. The password must be at least 16 characters. Restart the service; startup creates one manager scoped to the seeded cinemas. Remove both variables after the account is created. Staff accounts can then be created from the manager screen.

Generated JWT and QR secrets are stored by Render and shared by the API and its co-hosted worker. Do not copy values from `.env` into the Blueprint or commit them to Git.
