export type RuntimeEnv = {
  log: typeof console.log;
  warn?: typeof console.warn;
  error: typeof console.error;
  exit: (code: number) => never;
};

export const defaultRuntime: RuntimeEnv = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  exit: (code) => {
    process.exit(code);
    throw new Error("unreachable"); // satisfies tests when mocked
  },
};
