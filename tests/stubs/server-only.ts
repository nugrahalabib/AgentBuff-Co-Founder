// Test stub for the `server-only` package. In the app build it throws if a guarded module is imported
// into a client component; under vitest (plain Node) we alias it to this no-op so server modules can be
// unit-tested directly. The real client/server boundary is enforced by `next build`, not by tests.
export {};
