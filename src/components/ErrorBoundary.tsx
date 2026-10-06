import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Algo salió mal</h2>
          <p className="text-zinc-600 mb-6">Por favor, intenta recargar la página.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold"
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
