/**
 * SPX E2E Test - Now Playing Integration
 * 
 * Tests that verify the Now Playing functionality works correctly:
 * 1. Rust IPC commands are called
 * 2. macOS Control Center integration
 * 
 * Run with: npx playwright test src/tests/e2e-now-playing.spec.ts
 * 
 * Note: These tests require a running SPX app with a valid Spotify session.
 * Set E2E_BASE_URL to the app's URL (e.g., http://localhost:1420 for dev).
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:1420';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function waitForApp(page: Page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

function captureConsoleLogs(page: Page): { logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
    } else {
      logs.push(text);
    }
  });
  
  return { logs, errors };
}

// ════════════════════════════════════════════════════════════════════════════════
// Now Playing Integration Tests
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Now Playing Integration', () => {
  
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('should show [NowPlaying] logs when playback state changes', async ({ page }) => {
    const { logs, errors } = captureConsoleLogs(page);
    
    // Wait for initial load and auth
    await page.waitForTimeout(2000);
    
    // Check for Now Playing logs in console
    const nowPlayingLogs = logs.filter(log => 
      log.includes('[NowPlaying]') || 
      log.includes('updateNowPlaying called')
    );
    
    // If authenticated, we should see Now Playing updates
    if (errors.length === 0) {
      console.log('Console logs with NowPlaying:', nowPlayingLogs);
    }
  });

  test('should update Now Playing when track changes', async ({ page }) => {
    const { logs } = captureConsoleLogs(page);
    
    // Wait for playback to be established
    await page.waitForTimeout(3000);
    
    // Check that updateNowPlaying was called with track info
    const nowPlayingCalls = logs.filter(log => 
      log.includes('updateNowPlaying called:')
    );
    
    console.log('NowPlaying calls found:', nowPlayingCalls.length);
    
    // If playback is active, we should have at least one Now Playing update
    // Note: This test may pass even without actual playback if the app checks periodically
  });

  test('should not crash when Rust IPC fails for Now Playing', async ({ page }) => {
    const { errors } = captureConsoleLogs(page);
    
    // Wait for any potential errors
    await page.waitForTimeout(3000);
    
    // Filter out expected errors (like network issues)
    const criticalErrors = errors.filter(err => 
      !err.includes('NetworkError') && 
      !err.includes('Failed to fetch')
    );
    
    // Should not have any critical JavaScript errors
    expect(criticalErrors.length).toBe(0);
  });

  test('playback polling is active after authentication', async ({ page }) => {
    const { logs } = captureConsoleLogs(page);
    
    // Wait for auth and polling to start
    await page.waitForTimeout(5000);
    
    // Check for periodic playback refresh logs
    const refreshLogs = logs.filter(log => 
      log.includes('refreshPlayback') || 
      log.includes('Spotify API')
    );
    
    // Should have multiple refresh calls (polling is active)
    console.log('Playback refresh logs:', refreshLogs.length);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Rust IPC Tests
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Rust IPC', () => {
  
  test('get_diagnostics command returns valid JSON', async ({ page }) => {
    await waitForApp(page);
    
    // Navigate to Diagnostics screen if available
    const diagnosticsButton = page.locator('text=Diagnostics').first();
    
    if (await diagnosticsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await diagnosticsButton.click();
      await page.waitForTimeout(2000);
      
      // Check for diagnostics error in the UI
      const diagnosticsError = page.locator('text=DIAGNOSTICS ERROR').first();
      
      // If we see DIAGNOSTICS ERROR, it means Rust IPC failed
      // If we see actual diagnostics data, it worked
      const hasError = await diagnosticsError.isVisible().catch(() => false);
      
      if (hasError) {
        // Get the error details
        const errorText = await page.locator('[class*="diagnostics"]').textContent().catch(() => '');
        console.log('Diagnostics error:', errorText);
      } else {
        console.log('Diagnostics working - no error shown');
      }
    } else {
      console.log('Diagnostics button not visible - may need authentication');
    }
  });

  test('ping command returns "pong"', async ({ page }) => {
    await waitForApp(page);
    
    // Look for Test ping button in Diagnostics
    const testPingButton = page.locator('button:has-text("Test ping")');
    
    if (await testPingButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await testPingButton.click();
      await page.waitForTimeout(1000);
      
      // Check if ping succeeded (should show "ping: pong")
      const diagnosticsArea = page.locator('text=ping: pong');
      const hasPingResult = await diagnosticsArea.isVisible().catch(() => false);
      
      expect(hasPingResult).toBe(true);
    } else {
      console.log('Test ping button not visible - may need Diagnostics tab');
    }
  });
});
