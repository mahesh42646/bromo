# BROMO Brand Guideline (Client Reference Derived)

## Source cues

Based on the UI references under `exampls/`:
- Dark-first, high contrast canvases.
- Rounded cards/chips with strong edge definition.
- Premium accent gradients (violet/blue/cyan family).
- Compact, content-dense mobile-like surfaces.
- Bold headings and strong visual hierarchy.

## Design language contract

These are admin-manageable from `/admin/system/settings`:
- **Personality**: neutral | premium | playful | minimal
- **Icon style**: rounded | sharp | duotone
- **Radius scale**: soft | balanced | bold
- **Surface style**: flat | glass | elevated
- **Content density**: comfortable | compact
- **Motion intensity**: none | subtle | expressive
- **Heading case**: sentence | title | uppercase
- **Gradient style**: none | subtle | vibrant

## Shared theme contract API

Use this endpoint as the source of truth for user-side projects:
- `GET /api/public/theme-contract` (web proxy)
- `GET /settings/public` (direct backend)

These include:
- branding
- full light/dark token palettes
- brand guidelines
- feature flags
- maintenance flags
- global variables

## Mobile + public web usage

- Mobile helper exists at `bromo-mobile/src/config/platform-theme.ts`.
- Public/partner web apps can consume the same contract and map tokens to their CSS/UI library.
- This keeps admin/system settings as the single cross-platform configuration surface.

