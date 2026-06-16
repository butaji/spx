/**
 * Notifications Store Unit Tests
 * 
 * Tests error and notification display.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock signals module before import
vi.mock('@preact/signals', () => {
  const store: any[] = [];
  return {
    signal: vi.fn((initial: any) => ({ value: initial ?? store })),
    effect: vi.fn(),
    computed: vi.fn((fn: () => any) => ({ value: fn() })),
  };
});

// Import after mocking
import {
  showError,
  showSuccess,
  showInfo,
  showWarning,
  dismissNotification,
  addNotification,
  notifications,
} from './notifications';

describe('Notifications Store', () => {
  beforeEach(() => {
    notifications.value = [];
  });

  describe('showError', () => {
    it('should create error notification with title and message', () => {
      showError('Test Error', 'This is a test error message');
      
      expect(notifications.value.length).toBe(1);
      expect(notifications.value[0].type).toBe('error');
      expect(notifications.value[0].title).toBe('Test Error');
      expect(notifications.value[0].message).toBe('This is a test error message');
    });

    it('should include solutions when provided', () => {
      const solutions = ['Solution 1', 'Solution 2', 'Solution 3'];
      showError('Error', 'Message', { solution: solutions });
      
      expect(notifications.value[0].solution).toEqual(solutions);
    });

    it('should generate id and return it', () => {
      const id = showError('Error', 'Message');
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(notifications.value[0].id).toBe(id);
    });
  });

  describe('showSuccess', () => {
    it('should create success notification', () => {
      showSuccess('Success', 'Operation completed');
      
      expect(notifications.value.length).toBe(1);
      expect(notifications.value[0].type).toBe('success');
      expect(notifications.value[0].title).toBe('Success');
    });

    it('should have default auto-dismiss', () => {
      showSuccess('Success', 'Done');
      
      expect(notifications.value[0].autoDismiss).toBe(true);
    });
  });

  describe('showInfo', () => {
    it('should create info notification', () => {
      showInfo('Info', 'Here is some information');
      
      expect(notifications.value[0].type).toBe('info');
    });
  });

  describe('showWarning', () => {
    it('should create warning notification', () => {
      showWarning('Warning', 'Be careful');
      
      expect(notifications.value[0].type).toBe('warning');
    });
  });

  describe('dismissNotification', () => {
    it('should remove notification by id', () => {
      const id1 = addNotification({
        type: 'error',
        title: 'Error 1',
        message: 'Msg',
        icon: 'x',
        autoDismiss: false,
        dismissTimeout: 0,
        requiresAction: true,
      });
      const id2 = addNotification({
        type: 'error',
        title: 'Error 2',
        message: 'Msg',
        icon: 'x',
        autoDismiss: false,
        dismissTimeout: 0,
        requiresAction: true,
      });
      
      dismissNotification(id1);
      
      expect(notifications.value.length).toBe(1);
      expect(notifications.value[0].id).toBe(id2);
    });
  });

  describe('addNotification', () => {
    it('should add notification to the store', () => {
      addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        icon: 'info',
        autoDismiss: true,
        dismissTimeout: 5000,
        requiresAction: false,
      });
      
      expect(notifications.value.length).toBe(1);
    });

    it('should set timestamp', () => {
      addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        icon: 'info',
        autoDismiss: true,
        dismissTimeout: 0,
        requiresAction: false,
      });
      
      expect(notifications.value[0].timestamp).toBeDefined();
      expect(typeof notifications.value[0].timestamp).toBe('number');
    });
  });
});
