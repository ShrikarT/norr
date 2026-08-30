export function coalesceFigure<T>(emit: (value: T) => void, windowMs = 400): (value: T) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: T;
  return (value: T) => {
    latest = value;
    if (timer) return;
    timer = setTimeout(() => { timer = undefined; emit(latest); }, windowMs);
  };
}
