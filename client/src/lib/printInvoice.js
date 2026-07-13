function waitForPrintWindow(printWindow) {
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (printWindow.closed) {
        clearInterval(timer);
        resolve();
      }
    }, 300);
    setTimeout(() => {
      clearInterval(timer);
      resolve();
    }, 60000);
  });
}

export async function printPdfBlob(blob, filename = 'invoice.pdf') {
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer,width=420,height=640');
  if (!printWindow) {
    URL.revokeObjectURL(url);
    throw new Error('POPUP_BLOCKED');
  }
  printWindow.document.title = filename;
  return new Promise((resolve, reject) => {
    printWindow.onload = () => {
      try {
        printWindow.focus();
        printWindow.print();
        waitForPrintWindow(printWindow).then(() => {
          URL.revokeObjectURL(url);
          resolve();
        });
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    printWindow.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PRINT_WINDOW_ERROR'));
    };
  });
}
