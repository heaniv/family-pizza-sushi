# Family Pizza Sushi — Vercel edition

Complete static website with all 143 menu items, photos, local fonts, search and order planning. Original yellow and cream design restored, with inline SVG icons that do not depend on device emoji fonts. Includes centered cart controls.

## Deploy from this ZIP

1. Extract this ZIP. Keep vercel.json, package.json, scripts/ and dist/ together in the project root.
2. Open a terminal in the extracted folder.
3. Run: npx vercel --prod
4. Sign in to Vercel and follow its prompts to create or select a project.

The Vercel CLI deploys the extracted project folder. Do not upload this ZIP as a single website file.

Alternative: put these extracted files in a GitHub repository, then import that repository in Vercel using Add New → Project.

## Deployment settings

- Framework preset: Other
- Root directory: the folder containing vercel.json
- Build command: npm run build
- Output directory: dist
- Install command: skipped (no dependencies)

The included vercel.json sets these values. No API keys, environment secrets, database or package installation are required.

The build automatically sets canonical/social URLs using VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL. For a custom domain, optionally set SITE_URL to your full HTTPS origin and redeploy.

## Local preview and checks

Run npm run dev, then open http://127.0.0.1:4173/.
Run npm test to check menu data, totals, search, local assets and links.

## Updating content

- Menu and prices: dist/menu-data.js
- Contact details and page content: dist/index.html
- Styles: dist/style.css
- Browser behavior: dist/app.js and dist/core.js
- Shared vector icons: dist/icons.js
- Photos and fonts: dist/assets/

Order lists are stored locally in the visitor's browser. Customers confirm orders by phone. Online payment and automatic order transmission are not implemented. Verify menu prices and delivery terms with the cafe before launch.

This archive is prepared for Vercel and does not contain the original Sites hosting identity. Font licensing and photography sources are included.

Official deployment documentation: https://vercel.com/docs/cli/deploying-from-cli
