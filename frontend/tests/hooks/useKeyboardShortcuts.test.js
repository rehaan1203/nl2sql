// frontend/tests/hooks/useKeyboardShortcuts.test.js
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  it('should call onRunQuery on Enter', () => {
    const onRunQuery = jest.fn();
    renderHook(() => useKeyboardShortcuts({ onRunQuery }));
    
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      document.dispatchEvent(event);
    });
    
    expect(onRunQuery).toHaveBeenCalled();
  });

  it('should call onFocusInput on Ctrl+K', () => {
    const onFocusInput = jest.fn();
    renderHook(() => useKeyboardShortcuts({ onFocusInput }));
    
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
      document.dispatchEvent(event);
    });
    
    expect(onFocusInput).toHaveBeenCalled();
  });
});
