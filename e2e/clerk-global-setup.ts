import { clerkSetup } from '@clerk/testing/playwright';
import type { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  await clerkSetup({
    frontendApiUrl: process.env.CLERK_FRONTEND_API_URL,
  });
}

export default globalSetup;
