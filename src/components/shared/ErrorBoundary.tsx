import React from "react";

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-5 bg-[#06080F] p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/[0.25] bg-red-500/[0.08]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="#F87171"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-[1rem] font-bold text-[#E8EAF0] tracking-tight">Something went wrong</h2>
            <p className="mt-1 text-[0.8125rem] text-[#4A5166]">An unexpected error occurred.</p>
          </div>
          <pre className="max-w-lg overflow-auto rounded-xl border border-red-500/[0.20] bg-red-500/[0.06] p-4 text-left font-mono text-[0.75rem] text-[#F87171] leading-relaxed whitespace-pre-wrap break-words">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn-primary h-9 rounded-xl px-5 text-[0.875rem]"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
