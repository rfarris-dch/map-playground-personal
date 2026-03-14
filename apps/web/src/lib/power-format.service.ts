interface FormatMegawattsOptions {
  readonly maximumFractionDigits?: number;
}

export function formatMegawatts(value: number, options: FormatMegawattsOptions = {}): string {
  let maximumFractionDigits = 1;
  if (value >= 100) {
    maximumFractionDigits = 0;
  }
  if (typeof options.maximumFractionDigits === "number") {
    maximumFractionDigits = options.maximumFractionDigits;
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits,
  })} MW`;
}
