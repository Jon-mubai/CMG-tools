import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: '' };

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty" style={{ padding: 24 }}>
          页面渲染失败：{this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}
