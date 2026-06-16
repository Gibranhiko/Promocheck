import { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.promocheck.app",
  appName: "PromoCheck",
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
        "Se requiere acceso a la cámara para capturar evidencia fotográfica de visitas a tiendas.",
    },
  },
}

export default config
