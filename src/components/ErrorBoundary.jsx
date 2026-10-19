import { Component } from 'react';

/** Any crash while drawing a page shows this instead of a blank white screen. */
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App crashed:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-iron flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-bold text-chalk">Something went wrong on this screen.</h1>
          <p className="text-sm text-knurl mt-2">Your logged workouts are safe. Reload, or go back to Today. If it keeps happening, send us a screenshot on WhatsApp.</p>
          <div className="flex gap-2 justify-center mt-5">
            <button onClick={() => window.location.reload()} className="bg-red-600 text-white font-semibold px-4 py-2.5 rounded-lg">Reload</button>
            <a href="/dashboard" className="border border-line text-chalk font-semibold px-4 py-2.5 rounded-lg">Back to Today</a>
          </div>
        </div>
      </div>
    );
  }
}
