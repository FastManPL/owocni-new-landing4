'use client';

import React, { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  remountKey: number;
  fallback: boolean;
}

/**
 * Łapie DOMException (np. insertBefore) z reconcilera Reacta
 * po mutacjach DOM w sekcjach. Pierwszy błąd → remount. Drugi → komunikat.
 */
export class DOMErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { remountKey: 0, fallback: false };
  }

  static getDerivedStateFromError(): Partial<State> | null {
    return null;
  }

  componentDidCatch(error: unknown): void {
    const isInsertBefore = error instanceof DOMException && error.message.includes('insertBefore');
    if (isInsertBefore && this.state.remountKey === 0) {
      this.setState({ remountKey: 1 });
    } else {
      this.setState({ fallback: true });
    }
  }

  render(): ReactNode {
    if (this.state.fallback) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Odśwież stronę, jeśli zawartość się nie wyświetla.
        </div>
      );
    }
    return <React.Fragment key={this.state.remountKey}>{this.props.children}</React.Fragment>;
  }
}
