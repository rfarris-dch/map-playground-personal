export function downloadCsvFile(csv: string, filenamePrefix: string): void {
  const dateLabel = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = `${filenamePrefix}-${dateLabel}.csv`;
  downloadLink.click();
  URL.revokeObjectURL(url);
}
