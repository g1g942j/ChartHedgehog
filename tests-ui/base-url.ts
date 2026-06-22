export function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

/** URL of the Spring Boot backend (not the Next.js frontend). */
export function getBackendUrl(): string {
  return process.env.BACKEND_URL ?? "http://localhost:8080";
}

export function getTestUsername(): string {
  return process.env.TEST_USERNAME ?? "admin";
}

export function getTestPassword(): string {
  return process.env.TEST_PASSWORD ?? "admin123";
}
