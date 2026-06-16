export function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function getTestUsername(): string {
  return process.env.TEST_USERNAME ?? "admin";
}

export function getTestPassword(): string {
  return process.env.TEST_PASSWORD ?? "admin123";
}
