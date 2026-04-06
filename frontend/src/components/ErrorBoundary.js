import React from 'react';
import { Button } from './ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    this.setState({ errorInfo });
    
    // Log to help debug
    if (error && error.message) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // Clear error state and navigate home
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected error occurred';
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
          <div className="text-center max-w-md bg-white rounded-xl shadow-lg p-6">
            <div className="text-5xl mb-4">😕</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-4 text-sm">
              We're sorry, but something unexpected happened.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="text-left mb-4 p-2 bg-gray-100 rounded text-xs">
                <summary className="cursor-pointer text-gray-700">Error Details</summary>
                <pre className="mt-2 overflow-auto text-red-600">{errorMessage}</pre>
              </details>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={this.handleRetry} 
                variant="outline"
                className="flex-1"
              >
                Try Again
              </Button>
              <Button 
                onClick={this.handleGoHome} 
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
