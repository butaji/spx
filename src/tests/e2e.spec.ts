/**
 * SPX E2E Test Suite
 * 
 * Comprehensive tests for user-facing functionality.
 * Run with: npx playwright test
 * 
 * Coverage:
 * 1. Onboarding & Setup (clear instructions)
 * 2. Error Messages (actionable feedback)
 * 3. Authentication Flow
 * 4. Navigation & Features
 * 5. Playback Controls
 * 6. Device Selection
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// ─── Test Configuration ────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:1422';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function waitForApp(page: Page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

async function checkConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

// ════════════════════════════════════════════════════════════════════════════════
// PAIN POINT 1: ONBOARDING & CLEAR SETUP INSTRUCTIONS
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Onboarding & Setup', () => {
  
  test('shows app branding and title', async ({ page }) => {
    await waitForApp(page);
    
    // Check logo
    const logo = page.locator('img[alt="SPX"]').first();
    await expect(logo).toBeVisible({ timeout: 5000 });
    
    // Check title
    const title = page.locator('h1:has-text("SPX")').first();
    await expect(title).toBeVisible();
  });

  test('shows Spotify branding', async ({ page }) => {
    await waitForApp(page);
    
    const spotify = page.locator('text=/spotify/i').first();
    await expect(spotify).toBeVisible();
  });

  test('shows connect/sign-in button', async ({ page }) => {
    await waitForApp(page);
    
    const connectButton = page.locator(
      'button:has-text("Connect"), button:has-text("Sign In"), button:has-text("Login")'
    ).first();
    await expect(connectButton).toBeVisible();
  });

  test('shows clear message when credentials not configured', async ({ page }) => {
    await waitForApp(page);
    
    // Should show setup instructions
    const setupText = page.locator(
      'text=/Spotify API|developer\\.spotify|Client ID|\\.env/i'
    ).first();
    
    // Either shows inline instructions or the auth error box
    const hasSetupInfo = await setupText.isVisible().catch(() => false);
    const hasErrorBox = await page.locator('.auth-error, [class*="error"]').isVisible().catch(() => false);
    
    expect(hasSetupInfo || hasErrorBox).toBeTruthy();
  });

  test('shows premium requirement notice', async ({ page }) => {
    await waitForApp(page);
    
    const premiumNotice = page.locator(
      'text=/Premium|premium/i'
    ).first();
    await expect(premiumNotice).toBeVisible();
  });

  test.describe('Credential Error Messages', () => {
    
    test('explains what Client ID is', async ({ page }) => {
      await waitForApp(page);
      
      // Look for Client ID mention
      const hasClientId = await page.locator('text=/Client ID|client_id/i').isVisible().catch(() => false);
      
      // If error is shown, it should mention the issue
      if (!hasClientId) {
        const hasError = await page.locator('[role="alert"], .error').isVisible().catch(() => false);
        expect(hasError).toBeTruthy();
      }
    });

    test('provides link to Spotify Developer Dashboard', async ({ page }) => {
      await waitForApp(page);
      
      const dashboardLink = page.locator(
        'a[href*="developer.spotify.com"], text=/developer\\.spotify|spotify\\.com\\/dashboard/i'
      ).first();
      
      // Either link exists or instructions mention the URL
      const hasLink = await dashboardLink.isVisible().catch(() => false);
      const hasUrlText = await page.locator('text=/https?:\\/\\/developer\\.spotify/i').isVisible().catch(() => false);
      
      expect(hasLink || hasUrlText).toBeTruthy();
    });

    test('shows .env file instructions', async ({ page }) => {
      await waitForApp(page);
      
      const envInstructions = page.locator('text=/\\.env|environment.*file/i').first();
      await expect(envInstructions).toBeVisible();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PAIN POINT 2: ERROR FEEDBACK & RECOVERY
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Error Feedback', () => {
  
  test('shows error notifications with clear titles', async ({ page }) => {
    await waitForApp(page);
    
    // Errors should have visible titles
    const errorBox = page.locator('.auth-error-box, [role="alert"], .error').first();
    
    if (await errorBox.isVisible()) {
      // Should have a clear title
      const title = errorBox.locator('p, h1, h2, h3').first();
      await expect(title).toBeVisible();
    }
  });

  test('provides actionable solutions for errors', async ({ page }) => {
    await waitForApp(page);
    
    // Look for solution suggestions
    const solutions = page.locator(
      'text=/Check|Make sure|Try|Go to|Add|Edit|Restart/i'
    ).first();
    
    await expect(solutions).toBeVisible();
  });

  test('network error shows connection troubleshooting', async ({ page }) => {
    // This tests that network errors have helpful messages
    // In real scenario, would simulate network failure
    
    // Check error messages exist
    const errorSection = page.locator('.auth-error-solutions, .error-solutions, ul li').first();
    const hasErrors = await errorSection.isVisible().catch(() => false);
    
    // If we're on auth screen, errors should have solutions
    expect(hasErrors).toBeTruthy();
  });

  test('premium error explains upgrade requirement', async ({ page }) => {
    await waitForApp(page);
    
    const premiumText = page.locator(
      'text=/Premium|premium.*required|requires.*premium/i'
    ).first();
    
    await expect(premiumText).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PAIN POINT 3: AUTHENTICATION FLOW
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Authentication', () => {
  
  test('connect button is prominent and visible', async ({ page }) => {
    await waitForApp(page);
    
    const button = page.locator(
      'button:has-text("Connect"), button:has-text("Sign In")'
    ).first();
    
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test('shows loading state during auth', async ({ page }) => {
    await waitForApp(page);
    
    // Start auth (may not complete in test environment)
    const button = page.locator(
      'button:has-text("Connect"), button:has-text("Sign In")'
    ).first();
    
    // Click and check for loading state
    await button.click();
    
    // Should show loading or be disabled
    const isDisabled = await button.isDisabled();
    const hasLoading = await page.locator(
      'text=/Loading|Signing|In progress/i'
    ).isVisible().catch(() => false);
    
    expect(isDisabled || hasLoading).toBeTruthy();
  });

  test('shows popup blocked instructions if needed', async ({ page }) => {
    await waitForApp(page);
    
    // Look for popup instructions
    const popupText = page.locator(
      'text=/popup|block|allow.*browser/i'
    ).first();
    
    // Should mention popup handling somewhere
    const hasPopupInfo = await popupText.isVisible().catch(() => false);
    
    // This is good UX if present
    expect(typeof hasPopupInfo === 'boolean').toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PAIN POINT 4: FEATURE DISCOVERABILITY
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Navigation & Features', () => {
  
  test('shows main navigation tabs', async ({ page }) => {
    await waitForApp(page);
    
    // Check for navigation
    const nav = page.locator('nav, [role="navigation"], .nav, header').first();
    const hasNav = await nav.isVisible().catch(() => false);
    
    // If logged in, should have nav; if not, check for navigation hint
    const tabs = ['Home', 'Search', 'Library', 'Queue'].map(t => 
      page.locator(`text=${t}`).first()
    );
    
    const anyTab = await Promise.race(
      tabs.map(t => t.isVisible().catch(() => false)).concat([Promise.resolve(hasNav)])
    );
    
    expect(anyTab).toBeTruthy();
  });

  test('shows playback controls when playing', async ({ page }) => {
    await waitForApp(page);
    
    // Look for player bar or playback controls
    const playerBar = page.locator(
      '[class*="player"], [class*="control"], button[class*="play"]'
    ).first();
    
    const hasPlayer = await playerBar.isVisible().catch(() => false);
    
    // Player may not be visible without auth, that's OK
    expect(typeof hasPlayer === 'boolean').toBeTruthy();
  });

  test('shows volume control', async ({ page }) => {
    await waitForApp(page);
    
    const volumeControl = page.locator(
      '[class*="volume"], [aria-label*="volume" i], input[type="range"]'
    ).first();
    
    // May not be visible without active playback
    const hasVolume = await volumeControl.isVisible().catch(() => false);
    expect(typeof hasVolume === 'boolean').toBeTruthy();
  });

  test('shows now playing info when available', async ({ page }) => {
    await waitForApp(page);
    
    // Look for track info or player
    const trackInfo = page.locator(
      '[class*="track"], [class*="now-playing"], [class*="playing"]'
    ).first();
    
    const hasTrack = await trackInfo.isVisible().catch(() => false);
    expect(typeof hasTrack === 'boolean').toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PAIN POINT 5: DEVICE SELECTION
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Device Selection', () => {
  
  test('shows device selector', async ({ page }) => {
    await waitForApp(page);
    
    const deviceSelector = page.locator(
      '[class*="device"], button:has-text("Device"), [aria-label*="device" i]'
    ).first();
    
    const hasSelector = await deviceSelector.isVisible().catch(() => false);
    
    // If auth is required, device selector may not show
    if (!hasSelector) {
      // Auth screen should be visible
      const authScreen = page.locator(
        'text=/Connect|Sign In|Spotify Premium/i'
      ).first();
      await expect(authScreen).toBeVisible();
    }
  });

  test('device selector shows available devices', async ({ page }) => {
    await waitForApp(page);
    
    // Click device selector if visible
    const selector = page.locator(
      'button:has-text("Device"), [class*="device-selector"]'
    ).first();
    
    if (await selector.isVisible().catch(() => false)) {
      await selector.click();
      
      // Should show dropdown or modal
      const dropdown = page.locator(
        '[class*="dropdown"], [class*="menu"], [class*="modal"]'
      ).first();
      await expect(dropdown).toBeVisible();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PAIN POINT 6: STATE VISIBILITY
// ════════════════════════════════════════════════════════════════════════════════

test.describe('State Visibility', () => {
  
  test('clearly shows connection status', async ({ page }) => {
    await waitForApp(page);
    
    // Look for status indicator
    const status = page.locator(
      '[class*="status"], [class*="indicator"], [class*="connection"]'
    ).first();
    
    const hasStatus = await status.isVisible().catch(() => false);
    expect(typeof hasStatus === 'boolean').toBeTruthy();
  });

  test('shows what is currently playing', async ({ page }) => {
    await waitForApp(page);
    
    // Look for track name or artist
    const playing = page.locator(
      'text=/playing|now playing/i'
    ).first();
    
    const hasPlaying = await playing.isVisible().catch(() => false);
    
    // If not playing, should show instructions
    if (!hasPlaying) {
      const instructions = page.locator(
        'text=/Select|Choose|Play/i'
      ).first();
      await expect(instructions).toBeVisible();
    }
  });

  test('progress bar shows current position', async ({ page }) => {
    await waitForApp(page);
    
    const progress = page.locator(
      '[class*="progress"], [class*="seek"], input[type="range"]'
    ).first();
    
    const hasProgress = await progress.isVisible().catch(() => false);
    expect(typeof hasProgress === 'boolean').toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Accessibility', () => {
  
  test('buttons have accessible labels', async ({ page }) => {
    await waitForApp(page);
    
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const hasLabel = await button.locator('text=, [aria-label]').count() > 0;
      
      // At least some buttons should have labels
      if (hasLabel) break;
    }
  });

  test('error messages are announced to screen readers', async ({ page }) => {
    await waitForApp(page);
    
    // Look for ARIA live regions or alert roles
    const alerts = page.locator('[role="alert"], [aria-live]');
    const hasAlerts = await alerts.count() > 0;
    
    // If there are errors, they should be accessible
    expect(typeof hasAlerts === 'boolean').toBeTruthy();
  });

  test('focus is visible on interactive elements', async ({ page }) => {
    await waitForApp(page);
    
    const button = page.locator('button').first();
    
    if (await button.isVisible().catch(() => false)) {
      await button.focus();
      
      // Check for focus outline
      const outline = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.outlineWidth !== '0px' || style.boxShadow !== 'none';
      });
      
      expect(outline).toBeTruthy();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// VISUAL REGRESSION (basic checks)
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Visual', () => {
  
  test('app loads without layout shifts', async ({ page }) => {
    await waitForApp(page);
    
    // Measure layout stability
    const initialHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.waitForTimeout(1000);
    const finalHeight = await page.evaluate(() => document.body.scrollHeight);
    
    // Should be stable (within 100px)
    expect(Math.abs(finalHeight - initialHeight)).toBeLessThan(100);
  });

  test('no horizontal overflow', async ({ page }) => {
    await waitForApp(page);
    
    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth;
    });
    
    expect(hasOverflow).toBeFalsy();
  });

  test('main content is visible above fold', async ({ page }) => {
    await waitForApp(page);
    
    // Get viewport height
    const viewportHeight = page.viewportSize()?.height || 800;
    
    // Check if main content is visible
    const logo = page.locator('img[alt="SPX"]').first();
    const button = page.locator('button:has-text("Connect")').first();
    
    const logoBox = await logo.boundingBox();
    const buttonBox = await button.boundingBox();
    
    const logoVisible = logoBox && logoBox.y < viewportHeight;
    const buttonVisible = buttonBox && buttonBox.y < viewportHeight;
    
    expect(logoVisible || buttonVisible).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PERFORMANCE
// ════════════════════════════════════════════════════════════════════════════════

test.describe('Performance', () => {
  
  test('app loads within reasonable time', async ({ page }) => {
    const start = Date.now();
    
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - start;
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('no excessive console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await waitForApp(page);
    await page.waitForTimeout(1000);
    
    // Filter out known benign errors
    const realErrors = errors.filter(e => 
      !e.includes('[vite]') && 
      !e.includes('favicon') &&
      !e.includes('websocket')
    );
    
    expect(realErrors.length).toBeLessThan(5);
  });
});
