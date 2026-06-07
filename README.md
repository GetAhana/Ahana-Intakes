# Ahana — Client onboarding

Private client onboarding portal for **https://intakes.getahana.com**.

## Pages

| URL | Step |
|-----|------|
| `/` | Welcome landing → plan picker → onboarding |
| `/intake-form-starter` | Starter onboarding |
| `/intake-form-enhanced` | Enhanced onboarding |
| `/intake-form-premium` | Premium onboarding |

## Netlify setup

1. Import this repo as a **separate Netlify site** (not the main marketing site).
2. Custom domain: `intakes.getahana.com`
3. Branch: `main`
4. Publish directory: `.`
5. Set environment variables (see `.env.example`):
   - `Starter_Webhook`, `Enhanced_Webhook`, `Premium_Webhook`, `Make_API`

Form submissions POST to `/api/submit-form` (serverless proxy → Make with `X-Make-ApiKey`).

## Local preview

```bash
npx netlify-cli dev
```
