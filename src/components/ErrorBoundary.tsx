import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <p className="text-zinc-400 text-sm font-medium mb-1">Something went wrong loading this section.</p>
          <p className="text-zinc-600 text-xs mb-4">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-xs text-stone-400 hover:text-stone-200 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
