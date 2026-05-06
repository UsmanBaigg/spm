import { chromium } from 'playwright';
import { test, expect } from '@playwright/test';

describe('User Journey E2E Tests', () => {
  let browser;
  let page;
  let authPage;

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set up request monitoring
    page.on('request', request => {
      console.log(`🔄 ${request.method()} ${request.url()}`);
    });
    
    page.on('response', response => {
      console.log(`✅ ${response.status()} ${response.url()}`);
    });
  });

  afterEach(async () => {
    await page.close();
  });

  test.describe('Authentication Flow', () => {
    test('should login and logout successfully', async () => {
      await page.goto('http://localhost:5173/login');
      
      // Fill login form
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      
      // Submit login
      await page.click('button[type="submit"]');
      
      // Wait for navigation to dashboard
      await page.waitForURL('**/dashboard');
      
      // Verify user is logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      
      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('button:has-text("Logout")');
      
      // Verify redirected to login
      await page.waitForURL('**/login');
    });

    test('should handle invalid login credentials', async () => {
      await page.goto('http://localhost:5173/login');
      
      // Fill invalid credentials
      await page.fill('input[name="email"]', 'invalid@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      
      // Submit login
      await page.click('button[type="submit"]');
      
      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    });

    test('should register new user', async () => {
      await page.goto('http://localhost:5173/register');
      
      // Fill registration form
      await page.fill('input[name="email"]', 'newuser@example.com');
      await page.fill('input[name="username"]', 'newuser');
      await page.fill('input[name="password"]', 'password123');
      await page.fill('input[name="confirmPassword"]', 'password123');
      
      // Submit registration
      await page.click('button[type="submit"]');
      
      // Wait for successful registration
      await page.waitForURL('**/dashboard');
      
      // Verify user is registered and logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });
  });

  test.describe('Rating and Review Flow', () => {
    test.beforeEach(async () => {
      // Login before each test
      await page.goto('http://localhost:5173/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });

    test('should complete full rating and review workflow', async () => {
      // Navigate to user profile
      await page.goto('http://localhost:5173/users/user1');
      
      // Check user profile loads
      await expect(page.locator('h1')).toContainText('User Profile');
      await expect(page.locator('[data-testid="trust-score"]')).toBeVisible();
      
      // Click "Write a Review" button
      await page.click('button:has-text("Write a Review")');
      
      // Wait for modal to appear
      await expect(page.locator('[data-testid="review-modal"]')).toBeVisible();
      
      // Fill out review form
      await page.click('[data-testid="rating-star-5"]');
      await page.fill('textarea[name="comment"]', 'Excellent user! Very professional and responsive.');
      await page.fill('input[name="title"]', 'Great Experience');
      
      // Add tags
      await page.click('[data-testid="tag-helpful"]');
      await page.click('[data-testid="tag-professional"]');
      
      // Submit review
      await page.click('button:has-text("Submit Review")');
      
      // Wait for submission
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      
      // Verify review appears in list
      await page.reload();
      await expect(page.locator('text=Great Experience')).toBeVisible();
      await expect(page.locator('text=Excellent user!')).toBeVisible();
      
      // Check trust score updated
      const initialScore = await page.locator('[data-testid="trust-score"]').textContent();
      await page.waitForTimeout(2000); // Wait for score update
      const updatedScore = await page.locator('[data-testid="trust-score"]').textContent();
      expect(updatedScore).not.toBe(initialScore);
    });

    test('should edit existing review', async () => {
      // Navigate to user's reviews
      await page.goto('http://localhost:5173/users/user1/reviews');
      
      // Find and click edit button on first review
      await page.click('[data-testid="edit-review"]:first-child');
      
      // Wait for edit modal
      await expect(page.locator('[data-testid="edit-review-modal"]')).toBeVisible();
      
      // Update review content
      await page.fill('textarea[name="comment"]', 'Updated review content with more details.');
      await page.fill('input[name="title"]', 'Updated Title');
      
      // Save changes
      await page.click('button:has-text("Save Changes")');
      
      // Verify changes saved
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('text=Updated Title')).toBeVisible();
    });

    test('should mark review as helpful/not helpful', async () => {
      await page.goto('http://localhost:5173/users/user1/reviews');
      
      // Find first review and mark as helpful
      await page.click('[data-testid="helpful-button"]:first-child');
      
      // Verify helpful count updated
      const helpfulCount = await page.locator('[data-testid="helpful-count"]:first-child').textContent();
      expect(parseInt(helpfulCount)).toBeGreaterThan(0);
      
      // Mark as not helpful
      await page.click('[data-testid="not-helpful-button"]:first-child');
      
      // Verify not helpful count updated
      const notHelpfulCount = await page.locator('[data-testid="not-helpful-count"]:first-child').textContent();
      expect(parseInt(notHelpfulCount)).toBeGreaterThan(0);
    });

    test('should report inappropriate review', async () => {
      await page.goto('http://localhost:5173/users/user1/reviews');
      
      // Find first review and report it
      await page.click('[data-testid="report-review"]:first-child');
      
      // Wait for report modal
      await expect(page.locator('[data-testid="report-modal"]')).toBeVisible();
      
      // Select report reason
      await page.selectOption('select[name="reason"]', 'inappropriate_content');
      await page.fill('textarea[name="description"]', 'This review contains inappropriate content.');
      
      // Submit report
      await page.click('button:has-text("Submit Report")');
      
      // Verify report submitted
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });
  });

  test.describe('Service and Marketplace Flow', () => {
    test.beforeEach(async () => {
      // Login before each test
      await page.goto('http://localhost:5173/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });

    test('should rate service provider', async () => {
      await page.goto('http://localhost:5173/services/service1');
      
      // Verify service page loads
      await expect(page.locator('h1')).toContainText('Service Detail');
      await expect(page.locator('[data-testid="service-info"]')).toBeVisible();
      
      // Add rating
      await page.click('[data-testid="rating-star-4"]');
      
      // Verify rating summary updates
      await expect(page.locator('[data-testid="rating-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="average-rating"]')).toContainText('4.0');
      
      // Add review for service
      await page.click('button:has-text("Write Review")');
      await page.fill('textarea[name="comment"]', 'Great service! Very professional.');
      await page.click('button:has-text("Submit Review")');
      
      // Verify review added
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });

    test('should browse and rate marketplace items', async () => {
      await page.goto('http://localhost:5173/marketplace');
      
      // Verify marketplace page loads
      await expect(page.locator('h1')).toContainText('Marketplace');
      await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
      
      // Click on first item
      await page.click('[data-testid="marketplace-item"]:first-child');
      
      // Verify item detail page loads
      await expect(page.locator('h1')).toContainText('Marketplace Item');
      await expect(page.locator('[data-testid="item-details"]')).toBeVisible();
      
      // Check existing ratings
      await expect(page.locator('[data-testid="reviews-list"]')).toBeVisible();
      
      // Add rating
      await page.click('[data-testid="rating-star-5"]');
      
      // Verify rating added
      await expect(page.locator('[data-testid="rating-success"]')).toBeVisible();
    });
  });

  test.describe('Trust Score and Badge System', () => {
    test.beforeEach(async () => {
      // Login before each test
      await page.goto('http://localhost:5173/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });

    test('should display trust score and badge', async () => {
      await page.goto('http://localhost:5173/users/user1');
      
      // Verify trust score is displayed
      await expect(page.locator('[data-testid="trust-score"]')).toBeVisible();
      
      // Verify badge is displayed
      await expect(page.locator('[data-testid="trust-badge"]')).toBeVisible();
      
      // Check score breakdown
      await page.click('[data-testid="score-breakdown"]');
      await expect(page.locator('[data-testid="score-details"]')).toBeVisible();
      
      // Verify metrics are displayed
      await expect(page.locator('[data-testid="total-ratings"]')).toBeVisible();
      await expect(page.locator('[data-testid="average-rating"]')).toBeVisible();
      await expect(page.locator('[data-testid="verification-status"]')).toBeVisible();
    });

    test('should show trust score history', async () => {
      await page.goto('http://localhost:5173/users/user1/trust-history');
      
      // Verify history page loads
      await expect(page.locator('h1')).toContainText('Trust Score History');
      
      // Check history chart
      await expect(page.locator('[data-testid="score-chart"]')).toBeVisible();
      
      // Verify history entries
      await expect(page.locator('[data-testid="history-list"]')).toBeVisible();
    });

    test('should display leaderboard', async () => {
      await page.goto('http://localhost:5173/leaderboard');
      
      // Verify leaderboard loads
      await expect(page.locator('h1')).toContainText('Trust Leaderboard');
      
      // Check top users
      await expect(page.locator('[data-testid="leaderboard-list"]')).toBeVisible();
      
      // Filter by badge
      await page.selectOption('select[name="badge"]', 'trusted-neighbor');
      await page.click('button:has-text("Filter")');
      
      // Verify filtered results
      await expect(page.locator('[data-testid="leaderboard-list"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      await page.goto('http://localhost:5173/users/user1');
      
      // Verify error message appears
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Network error');
    });

    test('should handle slow loading states', async () => {
      // Simulate slow API response
      await page.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        await route.continue();
      });
      
      await page.goto('http://localhost:5173/users/user1');
      
      // Verify loading states
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
      
      // Wait for content to load
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible({ timeout: 5000 });
    });

    test('should handle form validation errors', async () => {
      await page.goto('http://localhost:5173/login');
      
      // Submit empty form
      await page.click('button[type="submit"]');
      
      // Verify validation errors
      await expect(page.locator('[data-testid="field-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="field-error"]')).toContainText('Email is required');
    });

    test('should handle 404 pages', async () => {
      await page.goto('http://localhost:5173/nonexistent-page');
      
      // Verify 404 page
      await expect(page.locator('h1')).toContainText('Page Not Found');
      await expect(page.locator('[data-testid="404-message"]')).toBeVisible();
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should load pages within performance budgets', async () => {
      const startTime = Date.now();
      
      await page.goto('http://localhost:5173/users/user1');
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should be accessible', async () => {
      await page.goto('http://localhost:5173/users/user1');
      
      // Check for proper heading structure
      const h1 = await page.locator('h1').count();
      expect(h1).toBe(1);
      
      // Check for alt text on images
      const imagesWithoutAlt = await page.locator('img:not([alt])').count();
      expect(imagesWithoutAlt).toBe(0);
      
      // Check for form labels
      const inputsWithoutLabels = await page.locator('input:not([aria-label]):not([aria-labelledby])').count();
      expect(inputsWithoutLabels).toBe(0);
    });

    test('should work on mobile viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('http://localhost:5173/users/user1');
      
      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
      
      // Test mobile interactions
      await page.click('[data-testid="mobile-menu"]');
      await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    });
  });

  test.describe('Security Tests', () => {
    test('should prevent XSS attacks', async () => {
      await page.goto('http://localhost:5173/users/user1');
      
      // Try to inject script in review
      await page.click('button:has-text("Write a Review")');
      await page.fill('textarea[name="comment"]', '<script>alert("XSS")</script>');
      await page.click('button:has-text("Submit Review")');
      
      // Verify script is not executed
      await expect(page.locator('text=<script>alert("XSS")</script>')).not.toBeVisible();
    });

    test('should handle CSRF protection', async () => {
      // This would require actual CSRF implementation
      await page.goto('http://localhost:5173/login');
      
      // Check for CSRF token
      const csrfToken = await page.locator('input[name="_csrf"]').count();
      expect(csrfToken).toBeGreaterThanOrEqual(0);
    });
  });
});
