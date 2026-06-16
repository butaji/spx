import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('shows Diagnostics nav item when showDiagnostics is true', () => {
    render(
      <Sidebar
        view={{ type: 'home' }}
        history={[{ type: 'home' }]}
        setHistory={vi.fn()}
        user={{ name: 'Test' }}
        showDiagnostics={true}
      />
    );

    expect(screen.getByLabelText('Diagnostics')).toBeDefined();
  });

  it('hides Diagnostics nav item when showDiagnostics is false', () => {
    render(
      <Sidebar
        view={{ type: 'home' }}
        history={[{ type: 'home' }]}
        setHistory={vi.fn()}
        user={{ name: 'Test' }}
        showDiagnostics={false}
      />
    );

    expect(screen.queryByLabelText('Diagnostics')).toBeNull();
  });
});
