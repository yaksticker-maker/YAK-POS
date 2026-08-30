
const { app, BrowserWindow, ipcMain, dialog} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#0d0d0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('printers:list', async () => {
  const ps = await mainWindow.webContents.getPrintersAsync();
  return ps.map(p => ({
    name: p.name,
    displayName: p.displayName || p.name,
    status: p.status,
    isDefault: !!p.isDefault
  }));
});

function psEscape(s='') {
  return String(s).replace(/'/g, "''");
}

function rawSendBuffer(printerName, buffer, docName='YAK POS RAW') {
  return new Promise((resolve) => {
    const tmp = path.join(os.tmpdir(), `yak_pos_${Date.now()}_${Math.random().toString(16).slice(2)}.bin`);
    fs.writeFileSync(tmp, buffer);

    const printer = psEscape(printerName);
    const file = psEscape(tmp);
    const doc = psEscape(docName);

    const script = `
$code = @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

  public static bool Send(string printerName, byte[] bytes, string docName) {
    IntPtr hPrinter;
    if(!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;

    var di = new DOCINFOA();
    di.pDocName = docName;
    di.pDataType = "RAW";

    if(!StartDocPrinter(hPrinter, 1, di)) {
      ClosePrinter(hPrinter);
      return false;
    }

    StartPagePrinter(hPrinter);

    IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, p, bytes.Length);

    Int32 written = 0;
    bool ok = WritePrinter(hPrinter, p, bytes.Length, out written);

    Marshal.FreeCoTaskMem(p);
    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);

    return ok && written == bytes.Length;
  }
}
'@

Add-Type -TypeDefinition $code
$bytes = [System.IO.File]::ReadAllBytes('${file}')

if([RawPrinterHelper]::Send('${printer}', $bytes, '${doc}')) {
  Write-Output 'OK'
  exit 0
}

Write-Error 'RAW print failed'
exit 2
`;

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true }
    );

    let out = '';
    let err = '';

    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());

    const cleanup = () => {
      try { fs.unlinkSync(tmp); } catch (_) {}
    };

    child.on('close', code => {
      cleanup();
      if (code === 0) resolve({ ok:true, output:out.trim() });
      else resolve({ ok:false, error:(err || out || 'RAW print failed').trim() });
    });

    child.on('error', e => {
      cleanup();
      resolve({ ok:false, error:e.message });
    });
  });
}

function bitmapToEscPosRaster(bitmap, width, height) {
  const widthBytes = Math.ceil(width / 8);
  const data = Buffer.alloc(widthBytes * height, 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const b = bitmap[i];
      const g = bitmap[i + 1];
      const r = bitmap[i + 2];
      const a = bitmap[i + 3] / 255;

      // Blend transparent pixels onto white.
      const rr = r * a + 255 * (1 - a);
      const gg = g * a + 255 * (1 - a);
      const bb = b * a + 255 * (1 - a);
      const gray = 0.299 * rr + 0.587 * gg + 0.114 * bb;

      if (gray < 180) {
        const byteIndex = y * widthBytes + (x >> 3);
        data[byteIndex] |= (0x80 >> (x & 7));
      }
    }
  }

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  return Buffer.concat([
    Buffer.from([0x1b, 0x40]),                 // ESC @ init
    Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]),
    data,
    Buffer.from([0x0a, 0x0a])
  ]);
}

async function renderHtmlToEscPos(html, paper='58') {
  // Common thermal printable widths:
  // 58 mm = 384 dots, 80 mm = 576 dots
  const targetWidth = paper === '80' ? 576 : 384;
  const fontSize = paper === '80' ? 20 : 18;
  const sidePadding = paper === '80' ? 12 : 8;

  const win = new BrowserWindow({
    show: false,
    width: targetWidth,
    height: 1000,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: false
    }
  });

  const doc = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      *{box-sizing:border-box}
      html,body{
        margin:0!important;
        padding:0!important;
        background:#fff!important;
        color:#000!important;
        width:${targetWidth}px!important;
        max-width:${targetWidth}px!important;
        overflow:hidden!important;
      }
      body{
        padding:4px ${sidePadding}px 4px!important;
        font-family:Tahoma,Arial,sans-serif!important;
        font-size:${fontSize}px!important;
        line-height:1.28!important;
        -webkit-font-smoothing:none;
      }
      h1,h2,h3{
        margin:2px 0 5px!important;
        line-height:1.15!important;
      }
      hr{
        border:0!important;
        border-top:1px dashed #000!important;
        margin:6px 0!important;
      }
      div,span,p{
        max-width:100%!important;
      }
      img{
        max-width:100%!important;
        height:auto!important;
      }
    </style>
  </head>
  <body>${html}</body>
  </html>`;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(doc));
  win.webContents.setZoomFactor(1);

  // Measure the real bottom edge of receipt content instead of the browser viewport.
  // This prevents a tall blank bitmap from being sent to continuous thermal paper.
  let contentHeight = await win.webContents.executeJavaScript(`
    (() => {
      const body = document.body;
      const children = Array.from(body.children);
      let bottom = 0;
      for (const el of children) {
        const r = el.getBoundingClientRect();
        bottom = Math.max(bottom, r.bottom);
      }
      return Math.ceil(Math.max(bottom, body.getBoundingClientRect().bottom, 1));
    })()
  `);
  contentHeight = Math.max(1, Math.min(Math.ceil(contentHeight) + 2, 5000));

  win.setContentSize(targetWidth, Math.max(120, contentHeight));
  await new Promise(r => setTimeout(r, 80));

  // IMPORTANT: capture only the receipt content area, not the whole hidden window.
  let image = await win.webContents.capturePage({
    x: 0,
    y: 0,
    width: targetWidth,
    height: contentHeight
  });

  // On Windows with 125%/150% display scaling, capturePage may return a bitmap
  // wider than the CSS width. Force it back to the exact thermal head width.
  const original = image.getSize();
  if (original.width !== targetWidth) {
    const scaledHeight = Math.max(1, Math.round(original.height * targetWidth / original.width));
    image = image.resize({
      width: targetWidth,
      height: scaledHeight,
      quality: 'best'
    });
  }

  const size = image.getSize();
  const bitmap = image.getBitmap();
  win.destroy();

  return bitmapToEscPosRaster(bitmap, size.width, size.height);
}

async function rawReceiptPrint(printerName, html, paper='58', docName='YAK POS Receipt') {
  try {
    const bytes = await renderHtmlToEscPos(html, paper);
    return await rawSendBuffer(printerName, bytes, docName);
  } catch (e) {
    return { ok:false, error:e.message || String(e) };
  }
}

function rawDrawerKick(printerName) {
  // ESC/POS cash drawer pulse. This is the ONLY drawer-opening path.
  const bytes = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  return rawSendBuffer(printerName, bytes, 'YAK POS Cash Drawer');
}

ipcMain.handle('drawer:open', async (event, args) => {
  const { deviceName } = args || {};
  if (!deviceName) return { ok:false, error:'No printer selected' };
  return await rawDrawerKick(deviceName);
});

ipcMain.handle('printer:test', async (event, args) => {
  const { deviceName, paper='58' } = args || {};
  if (!deviceName) return { ok:false, error:'No printer selected' };

  const now = new Date().toLocaleString('th-TH');
  const html = `
    <div style="text-align:center">
      <h2 style="margin:0">YAK POS</h2>
      <div><b>TEST RECEIPT</b></div>
    </div>
    <hr>
    <div>Printer: ${deviceName}</div>
    <div>Paper: ${paper} mm</div>
    <div>Date/Time: ${now}</div>
    <hr>
    <div style="display:flex;justify-content:space-between">
      <span>Test Item x1</span><span>10.00</span>
    </div>
    <hr>
    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:1.15em">
      <span>TOTAL</span><span>10.00</span>
    </div>
    <hr>
    <div style="text-align:center"><b>TEST PRINT SUCCESS</b></div>
    <div style="text-align:center">Printer is ready</div>
  `;

  return await rawReceiptPrint(deviceName, html, paper, 'YAK POS Test Receipt');
});

ipcMain.handle('printer:receipt', async (event, args) => {
  const { deviceName, paper='58', html='' } = args || {};
  if (!deviceName) return { ok:false, error:'No printer selected' };
  if (!html) return { ok:false, error:'Empty receipt' };

  // IMPORTANT: Receipt is RAW raster only. No drawer pulse is included here.
  return await rawReceiptPrint(deviceName, html, paper, 'YAK POS Receipt');
});


ipcMain.handle('yak-save-report-pdf', async (event, payload={}) => {
  let win;
  try{
    win=new BrowserWindow({show:false,width:900,height:1200,webPreferences:{contextIsolation:true,nodeIntegration:false}});
    await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(payload.html||''));
    const pdf=await win.webContents.printToPDF({
      printBackground:true,
      pageSize:'A4',
      margins:{marginType:'default'}
    });
    const {canceled,filePath}=await dialog.showSaveDialog({
      title:'บันทึกรายงาน PDF',
      defaultPath:`YAK_POS_REPORT_${new Date().toISOString().slice(0,10)}.pdf`,
      filters:[{name:'PDF',extensions:['pdf']}]
    });
    if(canceled||!filePath)return {ok:false,canceled:true};
    fs.writeFileSync(filePath,pdf);
    return {ok:true,filePath};
  }catch(e){
    return {ok:false,error:String(e)};
  }finally{
    if(win&&!win.isDestroyed())win.destroy();
  }
});

ipcMain.handle('yak-print-report', async (event, payload={}) => {
  let win;
  try{
    win=new BrowserWindow({show:false,width:900,height:1200,webPreferences:{contextIsolation:true,nodeIntegration:false}});
    await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(payload.html||''));
    return await new Promise(resolve=>{
      win.webContents.print({silent:false,printBackground:true},(success,failureReason)=>{
        resolve(success?{ok:true}:{ok:false,error:failureReason});
      });
    });
  }catch(e){
    return {ok:false,error:String(e)};
  }finally{
    setTimeout(()=>{if(win&&!win.isDestroyed())win.destroy()},500);
  }
});
