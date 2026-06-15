import { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.profresh.cargocontrol",
  appName: "Cargo Control",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#ffffff",
    },
    // Camera permission strings injected into iOS Info.plist by `npx cap sync ios`
    Camera: {
      NSCameraUsageDescription:
        "Camera access is required to capture photos of cargo loading and unloading operations.",
    },
  },
}

export default config
