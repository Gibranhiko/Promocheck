# Capacitor Setup Guide

This guide walks you through setting up Capacitor for native mobile builds.

## Prerequisites

- Node.js 18+
- npm or yarn
- For Android: Android Studio installed
- For iOS (Mac only): Xcode installed

## Step 1: Install Capacitor Dependencies

```bash
# Install Capacitor core packages
npm install @capacitor/core @capacitor/cli

# Install platform packages
npm install @capacitor/android

# Optional: Install additional plugins
npm install @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen
```

## Step 2: Initialize Capacitor

```bash
# This is interactive - follow the prompts
npx cap init "Cargo Control" "com.profresh.cargocontrol" --web-dir=dist
```

**Note:** This will update `capacitor.config.ts` with your app details. The config file has been pre-created with sensible defaults.

## Step 3: Add Android Platform

```bash
# Build the web app first
npm run build

# Add Android platform
npx cap add android

# Sync web assets to Android
npx cap sync android
```

## Step 4: Generate App Icons and Splash Screens

```bash
# Install the assets generator
npm install -D @capacitor/assets

# Generate icons from SVG (requires icon-512.svg in public/icons/)
npx @capacitor/assets generate --iconSource=public/icons/icon-512.svg
```

## Step 5: Build and Run

### Android

```bash
# Full build: web + sync + APK
npm run build:android

# Or manually:
npm run build && npx cap sync android

# Open in Android Studio
npx cap open android

# Inside Android Studio:
# 1. Connect device via USB (enable USB debugging)
# 2. Or use emulator: Tools → Device Manager → Create Device
# 3. Click "Run" (green triangle)

# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS (Mac Only)

```bash
# Build and sync
npm run build:ios

# Open in Xcode
npx cap open ios

# Inside Xcode:
# 1. Select target device or simulator
# 2. Product → Build
# 3. Run on device or simulator
```

## Build Scripts Added to package.json

```json
{
  "scripts": {
    "build:android": "npm run build && npx cap sync android",
    "build:ios": "npm run build && npx cap sync ios",
    "open:android": "npx cap open android",
    "open:ios": "npx cap open ios"
  }
}
```

## Troubleshooting

### Android Build Fails

```bash
# Clean and rebuild
cd android && ./gradlew clean
npx cap sync android
```

### Capacitor Not Detecting Changes

```bash
# Copy web assets without native rebuild
npx cap copy android

# Full sync (copies assets + updates native files)
npx cap sync android
```

### Firebase Not Working on Device

1. Download `google-services.json` from Firebase Console
2. Place it in `android/app/google-services.json`
3. Rebuild: `npx cap sync android`

### Camera Not Working on Emulator

Camera APIs require a physical device or emulator with camera support.
Test on a real device for camera functionality.

## Next Steps

1. Configure Firebase for Android: Follow Firebase setup guide
2. Set up push notifications (optional): Add Firebase Cloud Messaging
3. Configure app signing for release builds
4. Submit to Google Play Store

## Useful Commands

| Command | Description |
|---------|-------------|
| `npx cap doctor` | Check Capacitor setup |
| `npx cap ls` | List installed platforms |
| `npx cap copy` | Copy web assets only |
| `npx cap sync` | Copy assets + update native |
| `npx cap open android` | Open Android Studio |
| `npx cap open ios` | Open Xcode |
