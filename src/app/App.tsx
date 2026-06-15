import { AppRouter } from "./router"
import { ToastContainer } from "@/shared/components/ui/ToastContainer"
import { useIdleTimeout } from "@/shared/hooks"

export function App() {
  useIdleTimeout()
  return (
    <>
      <AppRouter />
      <ToastContainer />
    </>
  )
}
