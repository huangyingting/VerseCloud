import { Component, type ErrorInfo, type ReactNode } from 'react'

interface SceneBoundaryProps {
  children: ReactNode
  resetKey: string
}

interface SceneBoundaryState {
  failed: boolean
}

export class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false }

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The poetry map could not be rendered.', error, info.componentStack)
  }

  componentDidUpdate(previousProps: SceneBoundaryProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="scene-error" role="alert">
          <span>山河暂隐</span>
          <h2>地图未能在此设备上展开</h2>
          <p>仍可使用右上角诗库阅读全部作品，或刷新页面后重试。</p>
          <button type="button" onClick={() => window.location.reload()}>重新展开</button>
        </section>
      )
    }

    return this.props.children
  }
}
