
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yakDesktop', {
  isDesktop: true,
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  testPrinter: args => ipcRenderer.invoke('printer:test', args),
  printReceipt: args => ipcRenderer.invoke('printer:receipt', args),
  openDrawer: args => ipcRenderer.invoke('drawer:open', args),
  saveReportPdf: (payload)=>ipcRenderer.invoke('yak-save-report-pdf',payload),
  printReport: (payload)=>ipcRenderer.invoke('yak-print-report',payload)
});
