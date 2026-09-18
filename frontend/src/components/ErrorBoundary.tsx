import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-(--color-background)">
          <div className="w-full max-w-md p-6 rounded-2xl border border-(--color-border) bg-(--color-surface) text-center space-y-4 shadow-xl">
            <span className="flex h-14 w-14 items-center justify-center mx-auto rounded-full bg-rose-500/20 text-rose-400">
              <AlertTriangle size={30} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-(--color-text)">Something Went Wrong</h2>
              <p className="text-xs text-(--color-text-faint) mt-1 max-w-xs mx-auto">
                An unexpected error occurred in the application. Please reload or return to the main page.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-(--color-surface-2) text-left font-mono text-[11px] text-rose-300 overflow-x-auto max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-(--color-accent) text-white hover:opacity-90 transition-opacity"
              >
                <RefreshCw size={14} /> Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full border border-(--color-border) bg-(--color-surface-2) text-(--color-text) hover:bg-(--color-surface-3) transition-colors"
              >
                <Home size={14} /> Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
