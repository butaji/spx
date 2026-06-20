import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('shows Diagnostics nav item', () => {
    render(
      <Sidebar
        view={{ type: 'home' }}
        history={[{ type: 'home' }]}
        setHistory={vi.fn()}
        user={{ name: 'Test' }}
      />
    );

    expect(screen.getByLabelText('Diagnostics')).toBeDefined();
  });
});
