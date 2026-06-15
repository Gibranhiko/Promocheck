# PWA Icons

## Required Icon Sizes

For PWA compliance, you need to generate the following PNG icons from the SVG source files:

1. **icon-192.png** (192x192px) - Standard icon
2. **icon-512.png** (512x512px) - Large icon
3. **icon-512-maskable.png** (512x512px) - Maskable icon with safe zone

## How to Generate

### Option 1: Using ImageMagick (Recommended)

```bash
# Install ImageMagick if you don't have it
# macOS: brew install imagemagick
# Ubuntu: apt install imagemagick
# Windows: choco install imagemagick

# Generate icons from SVG
convert icons/icon-192.svg -resize 192x192 icons/icon-192.png
convert icons/icon-512.svg -resize 512x512 icons/icon-512.png
convert icons/icon-512.svg -resize 512x512 icons/icon-512-maskable.png
```

### Option 2: Using Online Converters

1. Open `icons/icon-192.svg` in a browser
2. Screenshot or use an online SVG-to-PNG converter
3. Resize to 192x192px
4. Save as `icons/icon-192.png`

Repeat for `icon-512.svg` at 512x512px for both `icon-512.png` and `icon-512-maskable.png`.

### Option 3: Using @capacitor/assets

If using Capacitor (Module 11), you can generate icons automatically:

```bash
npm install -D @capacitor/assets
npx @capacitor/assets generate --iconSource=public/icons/icon-512.svg
```

## Testing PWA

After generating the icons:
1. Build the app: `npm run build`
2. Serve the `dist` folder
3. Open Chrome DevTools → Application → Manifest
4. Verify icons appear correctly
5. Test "Install" button in browser
