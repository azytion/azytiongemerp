'use client';

import { useState, useEffect } from 'react';
import { Printer, Tablet, Save, HardDrive, Wifi, CheckCircle, RefreshCw, Info, Usb } from 'lucide-react';
import { toast } from 'sonner';
import { updateSettings } from '@/app/actions/settings';
import { listSystemPrinters, listSerialPorts } from '@/app/actions/printing';

interface HardwareConfig {
    label_printer_name: string;
    receipt_printer_name: string;
    scale_com_port: string;
    barcode_scanner_prefix: string;
    barcode_scanner_suffix: string;
    cash_drawer_enabled: string;
    cash_drawer_port: string;
    display_pole_enabled: string;
    display_pole_port: string;
}

export default function HardwareSettings({ settings: initialSettings }: { settings: Record<string, string> }) {
    const [config, setConfig] = useState<HardwareConfig>({
        label_printer_name:      initialSettings?.label_printer_name      || '',
        receipt_printer_name:    initialSettings?.receipt_printer_name    || '',
        scale_com_port:          initialSettings?.scale_com_port          || '',
        barcode_scanner_prefix:  initialSettings?.barcode_scanner_prefix  || '',
        barcode_scanner_suffix:  initialSettings?.barcode_scanner_suffix  || 'Enter',
        cash_drawer_enabled:     initialSettings?.cash_drawer_enabled     || 'false',
        cash_drawer_port:        initialSettings?.cash_drawer_port        || '',
        display_pole_enabled:    initialSettings?.display_pole_enabled    || 'false',
        display_pole_port:       initialSettings?.display_pole_port       || '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [printers, setPrinters] = useState<string[]>([]);
    const [ports, setPorts] = useState<{ deviceId: string; name: string }[]>([]);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [loadingPorts, setLoadingPorts] = useState(false);
    const [scaleReading, setScaleReading] = useState<string | null>(null);
    const [testingScale, setTestingScale] = useState(false);

    useEffect(() => {
        loadPrinters();
        loadPorts();
    }, []);

    async function loadPrinters() {
        setLoadingPrinters(true);
        try {
            const list = await listSystemPrinters();
            setPrinters(list);
        } catch { /* silent */ }
        setLoadingPrinters(false);
    }

    async function loadPorts() {
        setLoadingPorts(true);
        try {
            const list = await listSerialPorts();
            setPorts(list);
        } catch { /* silent */ }
        setLoadingPorts(false);
    }

    async function handleSave() {
        setIsSaving(true);
        try {
            const result = await updateSettings(
                Object.fromEntries(Object.entries(config)) as Record<string, string>
            );
            if (result.success) {
                toast.success('Hardware settings saved');
            } else {
                toast.error('Failed to save: ' + result.error);
            }
        } catch {
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    }

    async function testScaleConnection() {
        setTestingScale(true);
        setScaleReading(null);
        try {
            // Web Serial API test (browser-based)
            if ('serial' in navigator) {
                toast.info('Requesting serial port access...');
                const port = await (navigator as any).serial.requestPort();
                await port.open({ baudRate: 9600 });
                const reader = port.readable.getReader();
                const { value } = await Promise.race([
                    reader.read(),
                    new Promise<{ value: Uint8Array }>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
                ]);
                reader.releaseLock();
                await port.close();
                const text = new TextDecoder().decode(value).trim();
                setScaleReading(text || '0.00');
                toast.success(`Scale reading: ${text}`);
            } else {
                toast.warning('Web Serial API not supported in this browser. Use Chrome/Edge.');
            }
        } catch (e: any) {
            if (e.message === 'timeout') {
                toast.error('No data received from scale. Check connection.');
            } else {
                toast.error('Scale test failed: ' + e.message);
            }
        } finally {
            setTestingScale(false);
        }
    }

    const set = (key: keyof HardwareConfig, val: string) =>
        setConfig(c => ({ ...c, [key]: val }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>Hardware Integration</h2>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                    Configure printers, scales, scanners and other peripherals. This is a web-based app — hardware connects via browser APIs or system drivers.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>

                {/* Barcode Scanner */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Usb size={18} color="#3B82F6" />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>Barcode Scanner</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0 }}>USB / Bluetooth keyboard-emulation</p>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>
                            <CheckCircle size={14} /> Active
                        </div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius)', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                        USB/Bluetooth scanners in keyboard-emulation mode work automatically in the POS Terminal. No configuration needed.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                            <label>Prefix (optional)</label>
                            <input type="text" className="input" placeholder="None" value={config.barcode_scanner_prefix}
                                onChange={e => set('barcode_scanner_prefix', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Suffix / Terminator</label>
                            <select className="input" value={config.barcode_scanner_suffix}
                                onChange={e => set('barcode_scanner_suffix', e.target.value)}>
                                <option value="Enter">Enter (default)</option>
                                <option value="Tab">Tab</option>
                                <option value="None">None</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Receipt Printer */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Printer size={18} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>Receipt / Invoice Printer</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0 }}>A4 or thermal receipt printer</p>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Printer Name</label>
                        {printers.length > 0 ? (
                            <select className="input" value={config.receipt_printer_name}
                                onChange={e => set('receipt_printer_name', e.target.value)}>
                                <option value="">— Select printer —</option>
                                {printers.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        ) : (
                            <input type="text" className="input" placeholder="e.g. HP LaserJet Pro"
                                value={config.receipt_printer_name}
                                onChange={e => set('receipt_printer_name', e.target.value)} />
                        )}
                    </div>
                    <div className="form-group">
                        <label>Label / Tag Printer</label>
                        {printers.length > 0 ? (
                            <select className="input" value={config.label_printer_name}
                                onChange={e => set('label_printer_name', e.target.value)}>
                                <option value="">— Select printer —</option>
                                {printers.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        ) : (
                            <input type="text" className="input" placeholder="e.g. Zebra ZD410"
                                value={config.label_printer_name}
                                onChange={e => set('label_printer_name', e.target.value)} />
                        )}
                    </div>
                    <button onClick={loadPrinters} className="btn btn-secondary btn-sm" disabled={loadingPrinters} style={{ alignSelf: 'flex-start' }}>
                        <RefreshCw size={13} className={loadingPrinters ? 'animate-spin' : ''} />
                        {loadingPrinters ? 'Loading...' : 'Refresh printer list'}
                    </button>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', gap: '0.375rem', alignItems: 'flex-start' }}>
                        <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                        Invoices print as PDF via the browser print dialog. Ensure the printer is set as default in your OS.
                    </div>
                </div>

                {/* Digital Scale */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <HardDrive size={18} color="#8B5CF6" />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>Digital Weighing Scale</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0 }}>Serial / USB precision scale</p>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>COM Port / Serial Port</label>
                        {ports.length > 0 ? (
                            <select className="input" value={config.scale_com_port}
                                onChange={e => set('scale_com_port', e.target.value)}>
                                <option value="">— Select port —</option>
                                {ports.map(p => <option key={p.deviceId} value={p.deviceId}>{p.deviceId} — {p.name}</option>)}
                            </select>
                        ) : (
                            <input type="text" className="input" placeholder="e.g. COM3 or /dev/ttyUSB0"
                                value={config.scale_com_port}
                                onChange={e => set('scale_com_port', e.target.value)} />
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={loadPorts} className="btn btn-secondary btn-sm" disabled={loadingPorts}>
                            <RefreshCw size={13} className={loadingPorts ? 'animate-spin' : ''} />
                            {loadingPorts ? 'Detecting...' : 'Detect ports'}
                        </button>
                        <button onClick={testScaleConnection} className="btn btn-outline btn-sm" disabled={testingScale}>
                            {testingScale ? 'Testing...' : 'Test connection'}
                        </button>
                    </div>
                    {scaleReading !== null && (
                        <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--success)' }}>
                            Scale reading: {scaleReading} ct
                        </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', gap: '0.375rem', alignItems: 'flex-start' }}>
                        <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                        Requires Chrome/Edge with Web Serial API enabled. Scale must output ASCII weight data at 9600 baud.
                    </div>
                </div>

                {/* Cash Drawer */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Wifi size={18} color="#10B981" />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>Cash Drawer</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0 }}>Auto-open on cash sale</p>
                            </div>
                        </div>
                        <div
                            onClick={() => set('cash_drawer_enabled', config.cash_drawer_enabled === 'true' ? 'false' : 'true')}
                            style={{ width: 40, height: 22, borderRadius: 99, background: config.cash_drawer_enabled === 'true' ? 'var(--primary)' : 'var(--surface-3)', border: '1px solid var(--border-strong)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
                        >
                            <div style={{ position: 'absolute', top: 2, left: config.cash_drawer_enabled === 'true' ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        </div>
                    </div>
                    {config.cash_drawer_enabled === 'true' && (
                        <div className="form-group">
                            <label>Drawer Port / Printer</label>
                            <input type="text" className="input" placeholder="e.g. COM1 or via receipt printer"
                                value={config.cash_drawer_port}
                                onChange={e => set('cash_drawer_port', e.target.value)} />
                            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
                                Most cash drawers connect via the receipt printer&apos;s RJ11 port.
                            </p>
                        </div>
                    )}
                </div>

                {/* Customer Display Pole */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Tablet size={18} color="#F59E0B" />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>Customer Display Pole</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', margin: 0 }}>Show cart total to customer</p>
                            </div>
                        </div>
                        <div
                            onClick={() => set('display_pole_enabled', config.display_pole_enabled === 'true' ? 'false' : 'true')}
                            style={{ width: 40, height: 22, borderRadius: 99, background: config.display_pole_enabled === 'true' ? 'var(--primary)' : 'var(--surface-3)', border: '1px solid var(--border-strong)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
                        >
                            <div style={{ position: 'absolute', top: 2, left: config.display_pole_enabled === 'true' ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        </div>
                    </div>
                    {config.display_pole_enabled === 'true' && (
                        <div className="form-group">
                            <label>Display Port</label>
                            <input type="text" className="input" placeholder="e.g. COM2"
                                value={config.display_pole_port}
                                onChange={e => set('display_pole_port', e.target.value)} />
                        </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', gap: '0.375rem', alignItems: 'flex-start' }}>
                        <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                        Alternatively, open the POS on a second screen/tablet in display mode for a customer-facing view.
                    </div>
                </div>
            </div>

            <button onClick={handleSave} className="btn btn-primary" disabled={isSaving} style={{ alignSelf: 'flex-start', gap: '0.5rem' }}>
                <Save size={15} />
                {isSaving ? 'Saving...' : 'Save Hardware Settings'}
            </button>
        </div>
    );
}
