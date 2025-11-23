# Deployment Guide

## Prerequisites for Static Site Deployment

This app is designed to be deployed as a static website (e.g., to AWS CloudFront + S3).

## Required Files in Public Folder

Before building for production, ensure these files are in the `public/` folder:

1. `generated_world.json` - World state data
2. `lore.json` - Lore narratives (optional, app works without it)

The app will fetch these files from the root of your deployed site:
- `https://your-domain.com/generated_world.json`
- `https://your-domain.com/lore.json`

## Sync Script

Your sync script should copy these files from `world-gen/output/` to `world-explorer/public/`:

```bash
# Example sync command
cp world-gen/output/generated_world.json world-explorer/public/
cp world-gen/output/lore.json world-explorer/public/
```

## Build Process

1. Sync data files to `public/` folder:
   ```bash
   npm run sync  # or your custom sync script
   ```

2. Build the app:
   ```bash
   npm run build
   ```

3. The `dist/` folder will contain:
   - All static assets (HTML, CSS, JS)
   - Files from `public/` folder (including your JSON data)

## Deployment to CloudFront

1. Upload the entire `dist/` folder to your S3 bucket
2. Configure CloudFront to serve from the S3 bucket
3. Ensure CloudFront is configured to:
   - Serve `index.html` as the default root object
   - Handle SPA routing (redirect all routes to `index.html`)
   - Set appropriate cache headers for JSON files

## Cache Considerations

Since your data files are generated dynamically, you may want to:

1. **Set short cache TTL for JSON files** in CloudFront:
   - `generated_world.json`: Cache for 5-10 minutes
   - `lore.json`: Cache for 5-10 minutes

2. **Invalidate CloudFront cache** after deploying new data:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id YOUR_DISTRIBUTION_ID \
     --paths "/generated_world.json" "/lore.json"
   ```

3. **Use versioned filenames** (alternative approach):
   - Generate files as `generated_world_v123.json`
   - Update fetch URLs in app to include version
   - Allows long cache times with instant updates

## Local Development

During development, Vite's dev server will serve files from `public/` automatically, so the same paths work in both dev and production.

## Verification

After deployment, verify the data loads correctly:

1. Open browser DevTools Network tab
2. Navigate to your deployed site
3. Check that `/generated_world.json` and `/lore.json` return 200 OK
4. Verify the app displays your world data

## Troubleshooting

**"Failed to load world data" error:**
- Check that `generated_world.json` exists in `public/` folder before build
- Verify the file was included in the `dist/` folder after build
- Check CloudFront distribution is serving the file correctly

**Lore not appearing:**
- Check browser console for "Lore data not found" warning
- Verify `lore.json` exists and is valid JSON
- This is optional - app works without it
