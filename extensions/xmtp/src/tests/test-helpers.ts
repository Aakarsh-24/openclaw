/**
 * Minimal Test Framework
 *
 * A simple test framework for running unit tests without external dependencies.
 * Provides describe/test/expect functions similar to Jest.
 */

type TestFn = () => void | Promise<void>;

interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
}

const results: TestResult[] = [];
let currentSuite = "";

/**
 * Define a test suite.
 */
export function describe(name: string, fn: () => void): void {
  currentSuite = name;
  console.log(`\n${name}`);
  fn();
}

/**
 * Define a test case.
 */
export function test(name: string, fn: TestFn): void {
  const fullName = currentSuite ? `${currentSuite} > ${name}` : name;
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => {
          results.push({ name: fullName, passed: true });
          console.log(`  ✓ ${name}`);
        })
        .catch((error) => {
          results.push({ name: fullName, passed: false, error });
          console.log(`  ✗ ${name}`);
          console.log(`    Error: ${error.message}`);
        });
    } else {
      results.push({ name: fullName, passed: true });
      console.log(`  ✓ ${name}`);
    }
  } catch (error) {
    results.push({ name: fullName, passed: false, error: error as Error });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${(error as Error).message}`);
  }
}

/**
 * Alias for test.
 */
export const it = test;

/**
 * Assertion helper.
 */
export function expect<T>(actual: T): {
  toBe: (expected: T) => void;
  toEqual: (expected: T) => void;
  toBeUndefined: () => void;
  toBeDefined: () => void;
  toBeTruthy: () => void;
  toBeFalsy: () => void;
  toThrow: (message?: string | RegExp) => void;
  toContain: (item: unknown) => void;
  toHaveLength: (length: number) => void;
} {
  return {
    toBe(expected: T): void {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },

    toEqual(expected: T): void {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr}, got ${actualStr}`);
      }
    },

    toBeUndefined(): void {
      if (actual !== undefined) {
        throw new Error(`Expected undefined, got ${JSON.stringify(actual)}`);
      }
    },

    toBeDefined(): void {
      if (actual === undefined) {
        throw new Error(`Expected value to be defined, got undefined`);
      }
    },

    toBeTruthy(): void {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${JSON.stringify(actual)}`);
      }
    },

    toBeFalsy(): void {
      if (actual) {
        throw new Error(`Expected falsy value, got ${JSON.stringify(actual)}`);
      }
    },

    toThrow(message?: string | RegExp): void {
      if (typeof actual !== "function") {
        throw new Error("Expected a function");
      }
      let threw = false;
      let error: Error | undefined;
      try {
        (actual as () => void)();
      } catch (e) {
        threw = true;
        error = e as Error;
      }
      if (!threw) {
        throw new Error("Expected function to throw");
      }
      if (message) {
        if (typeof message === "string") {
          if (!error?.message.includes(message)) {
            throw new Error(
              `Expected error message to include "${message}", got "${error?.message}"`
            );
          }
        } else if (!message.test(error?.message || "")) {
          throw new Error(
            `Expected error message to match ${message}, got "${error?.message}"`
          );
        }
      }
    },

    toContain(item: unknown): void {
      if (!Array.isArray(actual)) {
        throw new Error("Expected an array");
      }
      if (!actual.includes(item)) {
        throw new Error(
          `Expected array to contain ${JSON.stringify(item)}`
        );
      }
    },

    toHaveLength(length: number): void {
      if (!Array.isArray(actual) && typeof actual !== "string") {
        throw new Error("Expected an array or string");
      }
      if ((actual as unknown[]).length !== length) {
        throw new Error(
          `Expected length ${length}, got ${(actual as unknown[]).length}`
        );
      }
    },
  };
}

/**
 * Print test summary at the end.
 */
process.on("exit", () => {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log("\n" + "=".repeat(50));
  console.log(`Tests: ${passed} passed, ${failed} failed, ${total} total`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}`);
        if (r.error) {
          console.log(`    ${r.error.message}`);
        }
      });
    process.exitCode = 1;
  } else {
    console.log("\nAll tests passed!");
  }
});
