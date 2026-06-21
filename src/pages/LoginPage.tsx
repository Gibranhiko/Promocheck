import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import { FiAlertCircle, FiMail, FiLock } from "react-icons/fi";
import { login } from "@/features/auth/services/authService";
import { loginSchema } from "@/features/auth/schemas/loginSchema";
import { useAuthStore } from "@/features/auth/store/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect once auth resolves with a valid user
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      // No navigate() here — the useEffect above will fire
      // once useAuth sets the user in the store
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (
          err.code === "auth/user-not-found" ||
          err.code === "auth/wrong-password"
        ) {
          setError("Invalid email or password");
        } else if (err.code === "auth/network-request-failed") {
          setError("Network error. Check your connection.");
        } else {
          setError("Login failed. Please try again.");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-4
                 bg-[radial-gradient(ellipse_at_top,_#0d2040_0%,_#0a0f1e_50%,_#091525_100%)]"
    >
      {/* Aqua glow — top-left */}
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full
                   bg-cyan-400/20 blur-[96px] pointer-events-none"
      />
      {/* Indigo glow — bottom-right */}
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full
                   bg-indigo-600/25 blur-[96px] pointer-events-none"
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 mb-4">
            <span className="text-3xl font-bold text-white">P</span>
          </div>
          <h1 className="text-2xl font-bold text-white">PromoCheck</h1>
          <p className="text-slate-400 mt-1">Inicia sesión para continuar</p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 bg-red-900/30 border border-red-500/40
                         rounded-lg flex items-center gap-2 text-red-300"
          >
            <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Email
            </label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@company.com"
                disabled={isLoading}
                autoComplete="email"
                className="pl-10 w-full rounded-xl px-4 py-3 text-base
                             bg-slate-800/60 border border-slate-600/50
                             text-white placeholder:text-slate-500
                             focus:outline-none focus:ring-2 focus:ring-cyan-400/50
                             focus:border-cyan-400/50 focus:bg-slate-800/80
                             transition-colors duration-150
                             disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                autoComplete="current-password"
                className="pl-10 w-full rounded-xl px-4 py-3 text-base
                             bg-slate-800/60 border border-slate-600/50
                             text-white placeholder:text-slate-500
                             focus:outline-none focus:ring-2 focus:ring-cyan-400/50
                             focus:border-cyan-400/50 focus:bg-slate-800/80
                             transition-colors duration-150
                             disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn w-full py-3 text-base touch-target
                         bg-gradient-to-r from-cyan-500 to-teal-500
                         text-white shadow-sm
                         hover:from-cyan-400 hover:to-teal-400
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
