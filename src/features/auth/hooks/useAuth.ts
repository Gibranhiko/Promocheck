import { useEffect } from "react"
import { onAuthStateChange, getUserProfile } from "../services/authService"
import { useAuthStore } from "../store/authStore"

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const { role, name } = await getUserProfile(firebaseUser.uid)
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, name, role })
        } catch {
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, name: null, role: null })
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [setUser, setLoading])

  return { user, isLoading }
}
