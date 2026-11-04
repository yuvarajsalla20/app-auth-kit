// Stand-in for app-core-kit so these tests run alone. Same names and behavior the kit relies on.
export const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
export const NO_CONNECTION_MESSAGE = 'No connection. Check your internet and try again.';
export const withTimeout = <T>(promise: Promise<T>, ms: number, label = 'timeout'): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
