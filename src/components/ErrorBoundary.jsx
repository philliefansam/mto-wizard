import React from 'react';
import Icon from './Icon';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MTO Wizard Unhandled Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetSession = () => {
    try {
      sessionStorage.removeItem('mto_job_data');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-amber-400">
              <Icon name="warning" className="text-3xl" />
              <h1 className="text-xl font-bold tracking-tight text-white font-geometric">
                Something went wrong in MTO Wizard
              </h1>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              An unexpected error occurred while processing application data. Your saved settings in local storage are safe, but the current view could not be rendered.
            </p>

            {this.state.error && (
              <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 font-mono text-xs text-rose-300 max-h-40 overflow-y-auto break-all">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2"
              >
                <Icon name="refresh" className="text-base" />
                <span>Reload Page</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetSession}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 transition-all flex items-center gap-2"
              >
                <Icon name="restart_alt" className="text-base" />
                <span>Reset Active Session & Reload</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
