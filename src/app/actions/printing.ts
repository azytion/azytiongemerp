'use server';


// Web-based app: system printer/port detection via PowerShell is not available.
// These functions return empty arrays gracefully so the UI falls back to
// manual text input. Hardware detection is handled client-side via
// browser APIs (Web Serial API, window.print()) in HardwareSettings.tsx.

export async function listSystemPrinters(): Promise<string[]> {
    // In a web server context, we cannot enumerate system printers.
    // The browser's window.print() uses the OS print dialog automatically.
    return [];
}

export async function listSerialPorts(): Promise<{ deviceId: string; name: string }[]> {
    // In a web server context, serial ports are accessed via the
    // Web Serial API in the browser (navigator.serial), not server-side.
    return [];
}
