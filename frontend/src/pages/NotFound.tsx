import { useNavigate, Link } from "react-router-dom";
import { Dumbbell, ArrowLeft, Home, Compass } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative z-10">
      <div className="max-w-md w-full text-center">
        {/* Logo / Header */}
        <div className="flex items-center gap-2.5 mb-8 justify-center animate-fade-in">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-accent) text-white shadow-md">
            <Dumbbell size={20} strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-semibold text-(--color-text)">GYMAI</span>
        </div>

        {/* Card Container */}
        <div className="card-hover rounded-(--radius-card) border-2 border-(--color-border) bg-(--color-surface) p-8 shadow-xl relative overflow-hidden backdrop-blur-md animate-fade-in-up">
          {/* Subtle Background Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-(--color-accent)/10 rounded-full blur-2xl pointer-events-none" />
          
          {/* Icon Badge */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-(--color-accent)/10 border border-(--color-accent)/20 flex items-center justify-center text-(--color-accent-strong) shadow-inner">
                <Compass size={40} className="animate-spin-slow" />
              </div>
              <span className="absolute -bottom-2 -right-2 bg-(--color-accent-strong) text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                404
              </span>
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold text-(--color-text) mb-2">
            Page Not Found
          </h1>
          <p className="text-sm text-(--color-text-muted) leading-relaxed mb-6">
            Oops! The page you are looking for doesn't exist, was moved, or is taking a rest day.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-hover) text-(--color-text) font-medium text-sm hover:border-(--color-accent) transition-all cursor-pointer shadow-xs"
            >
              <ArrowLeft size={16} />
              Go Back
            </button>
            <Link
              to="/"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-(--color-accent) text-white font-medium text-sm hover:opacity-90 transition-all shadow-md"
            >
              <Home size={16} />
              Return Home
            </Link>
          </div>
        </div>

        {/* Footer Hint */}
        <p className="text-xs text-(--color-text-faint) mt-6">
          If you believe this is an error, please contact your gym manager or check your URL.
        </p>
      </div>
    </div>
  );
}
