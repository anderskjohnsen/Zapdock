'use strict';
// Tynne bindinger mot Win32-API-ene Zapdock trenger for å erstatte oppgavelinjen:
// appbar (reservere skjermkant), vindusliste, aktivering, skjule Windows-oppgavelinjen
// og DWM-miniatyrer (live forhåndsvisning av et annet vindu, f.eks. WoW).
// På andre plattformer eksporteres stubber slik at UI-et kan utvikles/testes.

const isWin = process.platform === 'win32';

const stub = {
  available: false,
  listWindows: () => [],
  getForeground: () => 0,
  activate: () => {},
  minimize: () => {},
  isMinimized: () => false,
  isWindow: () => false,
  closeWindow: () => {},
  pressKeys: () => {},
  appbarRegister: () => null,
  appbarSetPos: () => null,
  appbarRemove: () => {},
  taskbarHandles: () => [],
  taskbarIsVisible: () => false,
  hideTaskbar: () => null,
  showTaskbar: () => {},
  thumbRegister: () => 0,
  thumbUnregister: () => {},
  thumbSourceSize: () => null,
  thumbUpdate: () => {},
  hwndOf: () => 0,
};

if (!isWin) {
  module.exports = stub;
  return;
}

const koffi = require('koffi');
const user32 = koffi.load('user32.dll');
const shell32 = koffi.load('shell32.dll');
const kernel32 = koffi.load('kernel32.dll');
const dwmapi = koffi.load('dwmapi.dll');

const RECT = koffi.struct('ZD_RECT', {
  left: 'int32_t', top: 'int32_t', right: 'int32_t', bottom: 'int32_t',
});
const SIZE = koffi.struct('ZD_SIZE', { cx: 'int32_t', cy: 'int32_t' });
const APPBARDATA = koffi.struct('ZD_APPBARDATA', {
  cbSize: 'uint32_t',
  hWnd: 'intptr_t',
  uCallbackMessage: 'uint32_t',
  uEdge: 'uint32_t',
  rc: RECT,
  lParam: 'intptr_t',
});
const DWM_THUMBNAIL_PROPERTIES = koffi.struct('ZD_DWM_THUMBNAIL_PROPERTIES', {
  dwFlags: 'uint32_t',
  rcDestination: RECT,
  rcSource: RECT,
  opacity: 'uint8_t',
  fVisible: 'int',
  fSourceClientAreaOnly: 'int',
});

const WNDENUMPROC = koffi.proto('int __stdcall ZD_WNDENUMPROC(intptr_t hwnd, intptr_t lParam)');

const EnumWindows = user32.func('int __stdcall EnumWindows(ZD_WNDENUMPROC *cb, intptr_t lParam)');
const IsWindow = user32.func('int __stdcall IsWindow(intptr_t hWnd)');
const IsWindowVisible = user32.func('int __stdcall IsWindowVisible(intptr_t hWnd)');
const IsIconic = user32.func('int __stdcall IsIconic(intptr_t hWnd)');
const GetWindow = user32.func('intptr_t __stdcall GetWindow(intptr_t hWnd, uint32_t cmd)');
const GetWindowLongPtrW = user32.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hWnd, int index)');
const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(intptr_t hWnd)');
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(intptr_t hWnd, void *buf, int max)');
const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(intptr_t hWnd, _Out_ uint32_t *pid)');
const GetForegroundWindow = user32.func('intptr_t __stdcall GetForegroundWindow()');
const SetForegroundWindow = user32.func('int __stdcall SetForegroundWindow(intptr_t hWnd)');
const BringWindowToTop = user32.func('int __stdcall BringWindowToTop(intptr_t hWnd)');
const ShowWindow = user32.func('int __stdcall ShowWindow(intptr_t hWnd, int cmd)');
const PostMessageW = user32.func('int __stdcall PostMessageW(intptr_t hWnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)');
const FindWindowExW = user32.func('intptr_t __stdcall FindWindowExW(intptr_t parent, intptr_t after, str16 cls, str16 title)');
const keybd_event = user32.func('void __stdcall keybd_event(uint8_t vk, uint8_t scan, uint32_t flags, uintptr_t extra)');

const SHAppBarMessage = shell32.func('uintptr_t __stdcall SHAppBarMessage(uint32_t msg, _Inout_ ZD_APPBARDATA *data)');

const OpenProcess = kernel32.func('intptr_t __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)');
const CloseHandle = kernel32.func('int __stdcall CloseHandle(intptr_t h)');
const QueryFullProcessImageNameW = kernel32.func('int __stdcall QueryFullProcessImageNameW(intptr_t h, uint32_t flags, void *buf, _Inout_ uint32_t *size)');

const DwmGetWindowAttribute = dwmapi.func('int32_t __stdcall DwmGetWindowAttribute(intptr_t hWnd, uint32_t attr, void *out, uint32_t size)');
const DwmRegisterThumbnail = dwmapi.func('int32_t __stdcall DwmRegisterThumbnail(intptr_t dest, intptr_t src, _Out_ intptr_t *thumb)');
const DwmUnregisterThumbnail = dwmapi.func('int32_t __stdcall DwmUnregisterThumbnail(intptr_t thumb)');
const DwmUpdateThumbnailProperties = dwmapi.func('int32_t __stdcall DwmUpdateThumbnailProperties(intptr_t thumb, ZD_DWM_THUMBNAIL_PROPERTIES *props)');
const DwmQueryThumbnailSourceSize = dwmapi.func('int32_t __stdcall DwmQueryThumbnailSourceSize(intptr_t thumb, _Out_ ZD_SIZE *size)');

// Konstanter
const GW_OWNER = 4;
const GWL_EXSTYLE = -20;
const WS_EX_TOOLWINDOW = 0x80;
const WS_EX_APPWINDOW = 0x40000;
const WS_EX_NOACTIVATE = 0x08000000;
const DWMWA_CLOAKED = 14;
const SW_HIDE = 0;
const SW_SHOWNA = 8;
const SW_MINIMIZE = 6;
const SW_RESTORE = 9;
const WM_CLOSE = 0x0010;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const KEYEVENTF_KEYUP = 0x2;
const VK_MENU = 0x12;
const ABM_NEW = 0, ABM_REMOVE = 1, ABM_QUERYPOS = 2, ABM_SETPOS = 3, ABM_GETSTATE = 4, ABM_SETSTATE = 10;
const ABS_AUTOHIDE = 1;
const EDGES = { left: 0, top: 1, right: 2, bottom: 3 };
const DWM_TNP_RECTDESTINATION = 0x1, DWM_TNP_OPACITY = 0x4, DWM_TNP_VISIBLE = 0x8, DWM_TNP_SOURCECLIENTAREAONLY = 0x10;

const textBuf = Buffer.alloc(1024 * 2);
const pathBuf = Buffer.alloc(1024 * 2);
const exeCache = new Map(); // pid -> exe path

function hwndOf(browserWindow) {
  const buf = browserWindow.getNativeWindowHandle();
  return buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0);
}

function getTitle(h) {
  const len = GetWindowTextLengthW(h);
  if (len <= 0) return '';
  const n = GetWindowTextW(h, textBuf, Math.min(len + 1, 1024));
  return textBuf.toString('utf16le', 0, n * 2);
}

function isCloaked(h) {
  const out = Buffer.alloc(4);
  if (DwmGetWindowAttribute(h, DWMWA_CLOAKED, out, 4) !== 0) return false;
  return out.readUInt32LE(0) !== 0;
}

function getPid(h) {
  const pid = [0];
  GetWindowThreadProcessId(h, pid);
  return pid[0];
}

function getExe(pid) {
  if (exeCache.has(pid)) return exeCache.get(pid);
  let exe = '';
  const hp = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
  if (hp) {
    const size = [1024];
    if (QueryFullProcessImageNameW(hp, 0, pathBuf, size)) exe = pathBuf.toString('utf16le', 0, size[0] * 2);
    CloseHandle(hp);
  }
  if (exeCache.size > 500) exeCache.clear();
  exeCache.set(pid, exe);
  return exe;
}

function isTaskbarWindow(h) {
  if (!IsWindowVisible(h)) return false;
  const ex = Number(GetWindowLongPtrW(h, GWL_EXSTYLE));
  if (ex & WS_EX_TOOLWINDOW) return false;
  if (ex & WS_EX_NOACTIVATE && !(ex & WS_EX_APPWINDOW)) return false;
  if (GetWindow(h, GW_OWNER) && !(ex & WS_EX_APPWINDOW)) return false;
  if (GetWindowTextLengthW(h) <= 0) return false;
  if (isCloaked(h)) return false;
  return true;
}

/** Vinduer som hører hjemme på en oppgavelinje, i Z-rekkefølge. */
function listWindows(exclude = new Set()) {
  const handles = [];
  EnumWindows((h) => {
    try {
      if (!exclude.has(h) && isTaskbarWindow(h)) handles.push(h);
    } catch (_) { /* ignorer enkeltvinduer som feiler */ }
    return 1;
  }, 0);
  return handles.map((h) => {
    const pid = getPid(h);
    return { hwnd: h, title: getTitle(h), pid, exe: getExe(pid), minimized: IsIconic(h) !== 0 };
  });
}

function pressKeys(vks) {
  for (const vk of vks) keybd_event(vk, 0, 0, 0);
  for (const vk of [...vks].reverse()) keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
}

function activate(h) {
  if (!IsWindow(h)) return;
  if (IsIconic(h)) ShowWindow(h, SW_RESTORE);
  // Alt-trikset gjør at Windows lar oss bytte forgrunnsvindu.
  keybd_event(VK_MENU, 0, 0, 0);
  SetForegroundWindow(h);
  keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
  BringWindowToTop(h);
}

// ---------- Appbar ----------

function appbarData(hwnd, edge, callbackMessage) {
  return {
    cbSize: koffi.sizeof(APPBARDATA),
    hWnd: hwnd,
    uCallbackMessage: callbackMessage || 0,
    uEdge: EDGES[edge] ?? EDGES.bottom,
    rc: { left: 0, top: 0, right: 0, bottom: 0 },
    lParam: 0,
  };
}

function appbarRegister(hwnd, edge, callbackMessage) {
  const abd = appbarData(hwnd, edge, callbackMessage);
  SHAppBarMessage(ABM_NEW, abd);
  return { hwnd, edge, callbackMessage };
}

/** monitor: fysiske piksler {x,y,width,height}. Returnerer endelig rektangel i fysiske piksler. */
function appbarSetPos(bar, monitor, thickness) {
  const abd = appbarData(bar.hwnd, bar.edge, bar.callbackMessage);
  const m = { left: monitor.x, top: monitor.y, right: monitor.x + monitor.width, bottom: monitor.y + monitor.height };
  const fit = (rc) => {
    const r = { ...rc };
    if (bar.edge === 'top') r.bottom = r.top + thickness;
    else if (bar.edge === 'left') r.right = r.left + thickness;
    else if (bar.edge === 'right') r.left = r.right - thickness;
    else r.top = r.bottom - thickness;
    return r;
  };
  abd.rc = fit(m);
  SHAppBarMessage(ABM_QUERYPOS, abd);
  abd.rc = fit(abd.rc);
  SHAppBarMessage(ABM_SETPOS, abd);
  const rc = abd.rc;
  return { x: rc.left, y: rc.top, width: rc.right - rc.left, height: rc.bottom - rc.top };
}

function appbarRemove(bar) {
  if (!bar) return;
  SHAppBarMessage(ABM_REMOVE, appbarData(bar.hwnd, bar.edge, bar.callbackMessage));
}

// ---------- Windows-oppgavelinjen ----------

function taskbarHandles() {
  const out = [];
  const primary = FindWindowExW(0, 0, 'Shell_TrayWnd', null);
  if (primary) out.push(primary);
  let prev = 0;
  for (let i = 0; i < 16; i++) {
    const h = FindWindowExW(0, prev, 'Shell_SecondaryTrayWnd', null);
    if (!h) break;
    out.push(h);
    prev = h;
  }
  return out;
}

function taskbarIsVisible() {
  return taskbarHandles().some((h) => IsWindowVisible(h));
}

/** Skjuler Windows-oppgavelinjen. Returnerer forrige appbar-tilstand så den kan gjenopprettes. */
function hideTaskbar() {
  const handles = taskbarHandles();
  if (!handles.length) return null;
  const abd = appbarData(handles[0], 'bottom', 0);
  const prevState = Number(SHAppBarMessage(ABM_GETSTATE, abd));
  if (!(prevState & ABS_AUTOHIDE)) {
    abd.lParam = prevState | ABS_AUTOHIDE;
    SHAppBarMessage(ABM_SETSTATE, abd);
  }
  for (const h of handles) ShowWindow(h, SW_HIDE);
  return prevState;
}

function showTaskbar(prevState) {
  const handles = taskbarHandles();
  if (!handles.length) return;
  for (const h of handles) ShowWindow(h, SW_SHOWNA);
  if (typeof prevState === 'number') {
    const abd = appbarData(handles[0], 'bottom', 0);
    abd.lParam = prevState;
    SHAppBarMessage(ABM_SETSTATE, abd);
  }
}

// ---------- DWM-miniatyr (live forhåndsvisning) ----------

function thumbRegister(destHwnd, srcHwnd) {
  const out = [0];
  const hr = DwmRegisterThumbnail(destHwnd, srcHwnd, out);
  return hr === 0 ? out[0] : 0;
}

function thumbUnregister(thumb) {
  if (thumb) DwmUnregisterThumbnail(thumb);
}

function thumbSourceSize(thumb) {
  const size = {};
  if (DwmQueryThumbnailSourceSize(thumb, size) !== 0) return null;
  return { width: size.cx, height: size.cy };
}

/** rect i fysiske piksler relativt til mottakervinduet. */
function thumbUpdate(thumb, rect, visible) {
  if (!thumb) return;
  const props = {
    dwFlags: DWM_TNP_RECTDESTINATION | DWM_TNP_VISIBLE | DWM_TNP_OPACITY | DWM_TNP_SOURCECLIENTAREAONLY,
    rcDestination: { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height },
    rcSource: { left: 0, top: 0, right: 0, bottom: 0 },
    opacity: 255,
    fVisible: visible ? 1 : 0,
    fSourceClientAreaOnly: 1,
  };
  DwmUpdateThumbnailProperties(thumb, props);
}

module.exports = {
  available: true,
  listWindows,
  getForeground: () => Number(GetForegroundWindow()),
  activate,
  minimize: (h) => ShowWindow(h, SW_MINIMIZE),
  isMinimized: (h) => IsIconic(h) !== 0,
  isWindow: (h) => IsWindow(h) !== 0,
  closeWindow: (h) => PostMessageW(h, WM_CLOSE, 0, 0),
  pressKeys,
  appbarRegister,
  appbarSetPos,
  appbarRemove,
  taskbarHandles,
  taskbarIsVisible,
  hideTaskbar,
  showTaskbar,
  thumbRegister,
  thumbUnregister,
  thumbSourceSize,
  thumbUpdate,
  hwndOf,
  VK: { LWIN: 0x5b, D: 0x44, N: 0x4e, A: 0x41 },
};
