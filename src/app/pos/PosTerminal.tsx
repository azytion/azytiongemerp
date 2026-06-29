'use client';

/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { createPortal } from 'react-dom';
import { Product, getProducts, getProductByBarcode } from '@/app/actions/products';
import { createSale, CartItem } from '@/app/actions/sales';
import { getCustomers, Customer } from '@/app/actions/customers';
import { getSettings } from '@/app/actions/settings';
import {
    Search,
    ShoppingCart,
    Plus,
    Minus,
    X,
    User,
    Printer,
    Tag,
    Mail,
    CheckCircle,
    DollarSign,
    MessageSquare,
    FileText,
    Gem,
    ChevronDown,
    PauseCircle,
    Clock,
    Cloud,
    CloudOff,
    RefreshCw,
    Users as UsersIcon,
    HandCoins
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import ManagerOverrideModal from '@/components/ManagerOverrideModal';
import { getMemoItemsForSale } from '@/app/actions/memos';
import { getCategories, Category } from '@/app/actions/categories';
import { toast } from 'sonner';
import { saveHeldOrder, getHeldOrders, retrieveHeldOrder } from '@/app/actions/pos';
import ProductEntryModal from '@/components/ProductEntryModal';
import InputModal from '@/components/ui/InputModal';
import { formatCurrency, formatDate, getCurrentCurrencySymbol } from '@/lib/utils';
import { DueCollectionModal } from '@/components/DueCollectionModal';
import { getDiscountRules, DiscountRule } from '@/app/actions/pos-settings';
import { getSetting } from '@/app/actions/settings';
import { getWhatsAppLink } from '@/app/actions/messaging'; // Import messaging actions
import { buildSalesInvoicePDFFromSaleRecord, printPDF } from '@/lib/pdf-generator';
import { sendPDFEmail } from '@/lib/email-pdf';
import { localDB } from '@/lib/db/LocalDB';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useSidebar } from '@/components/SidebarProvider';
import { useConfirm } from '@/components/ConfirmDialog';
import { Broker, getBrokers } from '@/app/actions/brokers';
import { formatExchangeAmount, formatExchangeRateLine, getExchangeSnapshot } from '@/lib/exchange-rates';

export default function PosTerminal() {
    // -------------------------------------------------------------------------
    // State Definitions
    // -------------------------------------------------------------------------
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Phase 9 Security
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
    const [pendingItemAction, setPendingItemAction] = useState<(() => void) | null>(null);
    const [overrideDescription, _setOverrideDescription] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Auto-close success modal
    useEffect(() => {
        const isAutoPrint = settings['pos_auto_print_enabled'] === 'true';
        // Only auto-close if auto-print is enabled, otherwise keep open for manual actions
        if (showSuccessModal && isAutoPrint) {
            const timer = setTimeout(() => {
                setShowSuccessModal(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showSuccessModal, settings]);

    const [cashReceived, setCashReceived] = useState('');
    // Split Payment State
    const [splitPayments, setSplitPayments] = useState<{ method: string, amount: number }[]>([]);
    const [splitAmountInput, setSplitAmountInput] = useState('');
    const [splitMethodInput, setSplitMethodInput] = useState('Cash');

    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'Cheque' | 'Split' | 'Due'>('Cash');
    const [cartDiscount, setCartDiscount] = useState({ type: 'none' as 'none' | 'percentage' | 'fixed', value: 0 });
    const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);
    const [heldOrders, setHeldOrders] = useState<any[]>([]);
    const [processing, setProcessing] = useState(false);
    const [_emailSending, setEmailSending] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [lastBumpedItemId, setLastBumpedItemId] = useState<{ id: number } | null>(null);

    // Phase 25: Product Entry Modal
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [modalProduct, setModalProduct] = useState<Product | null>(null);
    const [modalInitialValues, setModalInitialValues] = useState<{
        quantity: number;
        discount: number;
        price?: number;
    }>({ quantity: 1, discount: 0 });
    const [isCartEditing, setIsCartEditing] = useState(false);
    const [isDueCollectionModalOpen, setIsDueCollectionModalOpen] = useState(false);
    const [emailModalOpen, setEmailModalOpen] = useState(false);

    // Auto Discount State
    const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
    const [autoDiscountEnabled, setAutoDiscountEnabled] = useState(false);

    // Printing
    const [lastSale, setLastSale] = useState<{
        id: number,
        cart: CartItem[],
        total: number,
        cash: number,
        change: number,
        invoice: string,
        customer?: string,
        customerPhone?: string | null,
        customerEmail?: string | null,
        date: string,
        paymentMethod?: string
    } | null>(null);

    const [isPhoneModalOpen, setIsPhoneModalOpen] = useState<{ open: boolean, type: 'whatsapp' }>({ open: false, type: 'whatsapp' });
    const [messagingLoading, setMessagingLoading] = useState(false);

    const [_isEmailModalOpen, _setIsEmailModalOpen] = useState(false);
    const [isHoldNoteModalOpen, setIsHoldNoteModalOpen] = useState(false);
    const [session, setSession] = useState<any>(null);
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
    const [brokerCommission, setBrokerCommission] = useState('');
    const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
    const [brokenProductImages, setBrokenProductImages] = useState<Record<number, boolean>>({});
    const { isMobile } = useSidebar();
    const { confirm } = useConfirm();

    // Per-item notes state: { [cartItemId]: string }
    const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
    const [openNotesItemId, setOpenNotesItemId] = useState<number | null>(null);

    const searchParams = useSearchParams();

    // Memo-to-Sale Integration
    useEffect(() => {
        const memoId = searchParams.get('memoId');
        const itemsParam = searchParams.get('items');

        if (memoId && itemsParam) {
            const itemIds = itemsParam.split(',').map(Number);

            // Fetch and load items
            getMemoItemsForSale(Number(memoId), itemIds).then(res => {
                if (res.success && res.cartItems) {
                    setCart(prev => {
                        // Avoid duplicates if already added
                        const newItems = res.cartItems.filter(newItem =>
                            !prev.some(existing => existing.memo_item_id === newItem.memo_item_id)
                        );
                        if (newItems.length > 0) {
                            toast.success(`Loaded ${newItems.length} items from Memo #${memoId}`);
                            return [...prev, ...newItems];
                        }
                        return prev;
                    });

                    // Clear params to avoid re-adding on refresh (optional, but good UX)
                    window.history.replaceState(null, '', '/pos');
                } else {
                    toast.error("Failed to load memo items");
                }
            });
        }
    }, [searchParams]);

    // ... existing code ...
    const searchInputRef = useRef<HTMLInputElement>(null);
    const noDiscountBtnRef = useRef<HTMLButtonElement>(null);
    const percentBtnRef = useRef<HTMLButtonElement>(null);
    const fixedBtnRef = useRef<HTMLButtonElement>(null);
    const cartDiscountInputRef = useRef<HTMLInputElement>(null);

    // -------------------------------------------------------------------------
    // Derived Calculations
    // -------------------------------------------------------------------------
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const itemDiscount = cart.reduce((acc, item) => acc + (item.discount || 0), 0);

    let cartDiscountAmount = 0;
    if (cartDiscount.type === 'percentage') {
        cartDiscountAmount = (subtotal - itemDiscount) * (cartDiscount.value / 100);
    } else if (cartDiscount.type === 'fixed') {
        cartDiscountAmount = cartDiscount.value;
    }

    const totalDiscount = itemDiscount + cartDiscountAmount;
    const subtotalAfterDiscount = Math.max(0, subtotal - totalDiscount);

    const taxEnabled = settings.tax_enabled === 'true';
    const taxRate = parseFloat(settings.tax_rate || '0');
    const taxInclusive = settings.tax_inclusive === 'true';
    // const currencySymbol = settings.currency_symbol || '$'; // Deprecated in favor of formatCurrency

    let taxAmount = 0;
    let total = subtotalAfterDiscount;

    if (taxEnabled) {
        if (taxInclusive) {
            taxAmount = subtotalAfterDiscount - (subtotalAfterDiscount / (1 + taxRate / 100));
        } else {
            taxAmount = subtotalAfterDiscount * (taxRate / 100);
            total = subtotalAfterDiscount + taxAmount;
        }
    }

    // Loyalty removed — finalTotal equals total directly
    const finalTotal = total;
    const exchangeSnapshot = getExchangeSnapshot(settings);
    const exchangeRateLine = formatExchangeRateLine(exchangeSnapshot);
    const totalExchange = formatExchangeAmount(total, settings);
    const finalTotalExchange = formatExchangeAmount(finalTotal, settings);
    const cashChangeExchange = formatExchangeAmount(Number(cashReceived || 0) - finalTotal, settings);
    const splitRemaining = finalTotal - splitPayments.reduce((acc, p) => acc + p.amount, 0);
    const splitRemainingExchange = formatExchangeAmount(splitRemaining, settings);
    const lastSaleTotalExchange = lastSale ? formatExchangeAmount(lastSale.total, settings) : null;
    const lastSaleChangeExchange = lastSale ? formatExchangeAmount(lastSale.change, settings) : null;

    // -------------------------------------------------------------------------
    // Effects & Data Loading
    // -------------------------------------------------------------------------
    useEffect(() => {
        loadProducts();
        loadCustomers();
        loadCategories();
        loadSettings();
        loadBrokers();
        hydrateLocalData();
    }, []);

    const isOnline = useOnlineStatus();
    const { totalPending: pendingCount } = useOfflineSync();

    async function hydrateLocalData() {
        if (!navigator.onLine) return;
        try {
            const [prodRes, custRes] = await Promise.all([
                getProducts('', undefined, 1, 1000), // Get first 1000 products
                getCustomers('', 1, 1000)
            ]);

            if (prodRes.data) {
                const formattedProds = prodRes.data.map(p => ({
                    ...p,
                    has_variants: 0
                }));
                await localDB.products.clear();
                await localDB.products.bulkAdd(formattedProds as any);
            }
            if (custRes.data) {
                await localDB.customers.clear();
                await localDB.customers.bulkAdd(custRes.data);
            }

            const catRes = await getCategories();
            if (catRes.data) {
                await localDB.categories.clear();
                await localDB.categories.bulkAdd(catRes.data);
            }

            // Hydrate Session
            const { getSession } = await import('@/app/actions/auth');
            const sess = await getSession();
            setSession(sess);
        } catch (error) {
            console.error('Data hydration failed:', error);
        }
    }

    // Checkout Refs
    const cashInputRef = useRef<HTMLInputElement>(null);
    const splitAmountInputRef = useRef<HTMLInputElement>(null);

    // Scanner / Keyboard Listener
    useEffect(() => {
        let barcodeBuffer = '';
        let lastKeyTime = 0;
        let barcodeTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const handleGlobalKeyPress = async (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            // ── Global function keys ──────────────────────────────────────────
            if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
                return;
            }
            if (e.key === 'F4' && !isCheckoutModalOpen && cart.length > 0) {
                e.preventDefault();
                setIsCheckoutModalOpen(true);
                return;
            }
            if (e.key === 'F6' && !isCheckoutModalOpen && cart.length > 0) {
                e.preventDefault();
                handleHoldOrder();
                return;
            }

            // -------------------------------------------------------------------------
            // 1. Checkout Panel Navigation (User Request)
            // -------------------------------------------------------------------------
            if (isCheckoutModalOpen) {
                // Modified Request:
                // "Arrow keys to move ... without hitting enter ... focus needs to be in the cash recieved field as well."

                const methods = ['Cash', 'Bank', 'Cheque', 'Split', 'Due'] as const;
                const currentIndex = methods.indexOf(paymentMethod as any);

                if (e.key === 'ArrowRight') {
                    // Prevent default to avoid moving cursor if focused
                    e.preventDefault();
                    const nextIndex = (currentIndex + 1) % methods.length;
                    const nextMethod = methods[nextIndex];
                    setPaymentMethod(nextMethod);

                    // Force focus back to input if applicable
                    if (nextMethod === 'Cash') setTimeout(() => cashInputRef.current?.focus(), 10);
                    else if (nextMethod === 'Split') setTimeout(() => splitAmountInputRef.current?.focus(), 10);

                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prevIndex = (currentIndex - 1 + methods.length) % methods.length;
                    const prevMethod = methods[prevIndex];
                    setPaymentMethod(prevMethod);

                    if (prevMethod === 'Cash') setTimeout(() => cashInputRef.current?.focus(), 10);
                    else if (prevMethod === 'Split') setTimeout(() => splitAmountInputRef.current?.focus(), 10);

                } else if (e.key === 'Enter') {
                    // Logic from user: "no need to hit enter to select... focus needs to be in cash recieved field as well."
                    // But if they HIT Enter, it means they are done, right?
                    // User says: "if user hit enter the system sould complete the sale"
                    // So if I am in Cash, Enter completes. If I am in Card, Enter completes.

                    if (['Cash', 'Bank', 'Cheque', 'Due'].includes(paymentMethod)) {
                        // If we are in 'Cash', standard input behavior might handle this (onKeyDown in render),
                        // but handleCheckout() calls are safe duplicates if we block duplicate execution via 'processing' state.
                        // However, onKeyDown in input is better for Cash to ensure valid number.
                        // But let's allow Global Enter if not focused on something else weird.
                        if (isInputFocused && paymentMethod === 'Cash') {
                            // Let input's onKeyDown handle it
                            return;
                        }
                        e.preventDefault();
                        handleCheckout();
                    }
                }
            }

            // -------------------------------------------------------------------------
            // 2. Global Shortcuts
            // -------------------------------------------------------------------------

            // Ctrl / Control: Focus Search (User Request)
            if (e.key === 'Control' || e.ctrlKey) {
                // We typically check valid key combos, but raw Control press was requested.
                // Avoid hijacking Ctrl+C/V if possible, but 'Control' usually fires on modifier press only.
                if (e.key === 'Control') {
                    searchInputRef.current?.focus();
                }
                // If scanning triggers Ctrl... (some scanners do Ctrl+J for Enter)
                return;
            }

            // Alt: Clear Cart
            if (e.key === 'Alt') {
                e.preventDefault();
                if (cart.length > 0 && await confirm({ title: 'Clear Cart', message: 'Clear entire cart?', type: 'danger' })) setCart([]);
                return;
            }

            // + Key: Cycle Discount Types
            if (e.key === '+') {
                const isDiscountFocused = target === noDiscountBtnRef.current ||
                    target === percentBtnRef.current ||
                    target === fixedBtnRef.current ||
                    target === cartDiscountInputRef.current;

                if (isDiscountFocused) {
                    e.preventDefault();
                    if (cartDiscount.type === 'none') {
                        setCartDiscount({ type: 'percentage', value: 0 });
                        setTimeout(() => cartDiscountInputRef.current?.focus(), 10);
                    } else if (cartDiscount.type === 'percentage') {
                        setCartDiscount({ type: 'fixed', value: 0 });
                        setTimeout(() => cartDiscountInputRef.current?.focus(), 10);
                    } else {
                        setCartDiscount({ type: 'none', value: 0 });
                        setTimeout(() => noDiscountBtnRef.current?.focus(), 10);
                    }
                    return;
                }
            }

            // Shift: Hold Order
            if (e.key === 'Shift') {
                if (isInputFocused) return;
                if (cart.length > 0) handleHoldOrder();
                return;
            }

            // Enter (Global): Checkout
            if (e.key === 'Enter') {
                // Modified Request: "even if the focus is not in the the cart... system should proceed to checkout"
                // Exception: If user IS typing in an input (e.g. searching, or modal input), we usually block.
                // BUT, if they are in Search Bar and it is EMPTY, hitting Enter should probably trigger Checkout (efficiency).
                // If they are in Search Bar and it has text, Enter triggers Search (handled by handleSearchKeyDown).

                const isSearchFocusedAndEmpty = (target === searchInputRef.current && (!searchQuery || searchQuery.trim() === ''));
                const isDiscountSectionFocused = target === noDiscountBtnRef.current ||
                    target === percentBtnRef.current ||
                    target === fixedBtnRef.current ||
                    target === cartDiscountInputRef.current;

                // If focused on input (EXCEPT empty search/discount input), OR if other modals open, ignore global trigger
                if ((isInputFocused && !isSearchFocusedAndEmpty && target !== cartDiscountInputRef.current) ||
                    isCheckoutModalOpen || isProductModalOpen ||
                    isHeldOrdersModalOpen || isOverrideModalOpen) {
                    // Do nothing
                } else {
                    if (cart.length > 0) {
                        e.preventDefault();
                        if (isDiscountSectionFocused) {
                            setIsCheckoutModalOpen(true);
                        } else {
                            noDiscountBtnRef.current?.focus();
                        }
                    }
                    return;
                }
            }

            // Escape: Close Modals
            if (e.key === 'Escape') {
                if (isCheckoutModalOpen) setIsCheckoutModalOpen(false);
                if (isProductModalOpen) setIsProductModalOpen(false);
                if (isHeldOrdersModalOpen) setIsHeldOrdersModalOpen(false);
                if (isOverrideModalOpen) setIsOverrideModalOpen(false);
                if (document.activeElement === searchInputRef.current) searchInputRef.current?.blur();
                return;
            }

            // -------------------------------------------------------------------------
            // 3. Barcode Scanner Logic
            // -------------------------------------------------------------------------
            // Scanners type fast. Buffer input.
            // Requirement: "even if the system is not focused on the search... it should proceed"

            // If focused on Search, let it type. We handle "Enter" in the Input's onKeyDown.
            if (target === searchInputRef.current) return;

            // If focused on other inputs (Price/Qty in modal), DO NOT interfere.
            if (isInputFocused) return;

            const currentTime = Date.now();
            if (currentTime - lastKeyTime > 50) {
                barcodeBuffer = '';
            }
            lastKeyTime = currentTime;

            // Clear buffer after 300ms of inactivity
            if (barcodeTimeoutId) clearTimeout(barcodeTimeoutId);
            barcodeTimeoutId = setTimeout(() => { barcodeBuffer = ''; }, 300);

            if (e.key === 'Enter') {
                if (barcodeBuffer.length >= 3) {
                    e.preventDefault();
                    const code = barcodeBuffer.trim();
                    barcodeBuffer = '';
                    if (barcodeTimeoutId) { clearTimeout(barcodeTimeoutId); barcodeTimeoutId = null; }
                    handleBarcodeScan(code);
                }
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                barcodeBuffer += e.key;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyPress);
        return () => window.removeEventListener('keydown', handleGlobalKeyPress);
    }, [products, isCheckoutModalOpen, cart, paymentMethod, cartDiscount, searchQuery]); // Added deps for new shortcut logic

    async function handleBarcodeScan(code: string) {
        const res = await getProductByBarcode(code);
        if (res) {
            addToCart(res);
            setSearchQuery('');
        } else {
            toast.error(`Product not found: ${code}`);
        }
    }

    async function loadSettings() {
        const data = await getSettings();
        setSettings(data);

        // Load Discount Rules
        const rules = await getDiscountRules();
        setDiscountRules(rules);

        const autoEnabled = await getSetting('pos_auto_discount_enabled');
        setAutoDiscountEnabled(autoEnabled === 'true');
    }
    async function loadProducts(query = '', categoryId?: number) {
        try {
            const data = await getProducts(query, categoryId, 1, 500);
            setProducts(data.data);
        } catch (_error) {
            console.warn('Network failed, searching local DB...');
            // Local fallback search
            let collection = localDB.products.toCollection();
            if (query) {
                collection = localDB.products.where('name').startsWithIgnoreCase(query);
            }
            const localResults = await collection.toArray();
            setProducts(localResults as any);
        }
    }
    async function loadCustomers() {
        try {
            const data = await getCustomers('', 1, 100);
            setCustomers(data.data);
        } catch (_error) {
            const locals = await localDB.customers.toArray();
            setCustomers(locals as any);
        }
    }
    async function loadCategories() {
        try {
            const data = await getCategories();
            setCategories(data.data);
        } catch (_error) {
            const locals = await localDB.categories.toArray();
            setCategories(locals as any);
        }
    }
    async function loadBrokers() {
        try {
            const res = await getBrokers();
            if (res.success && res.brokers) {
                setBrokers(res.brokers);
            }
        } catch (error) {
            console.error('Failed to load brokers:', error);
        }
    }

    // -------------------------------------------------------------------------
    // Helper Functions
    // -------------------------------------------------------------------------
    function handleCategoryFilter(categoryId: number | null) {
        setSelectedCategory(categoryId);
        loadProducts(searchQuery, categoryId || undefined);
    }

    function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
        const q = e.target.value;
        setSearchQuery(q);
        loadProducts(q, selectedCategory || undefined);
    }

    // Handle Enter in Search Field
    async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter' && searchQuery.trim()) {
            // Attempt to treat as barcode first
            const res = await getProductByBarcode(searchQuery.trim());
            if (res) {
                addToCart(res);
                setSearchQuery('');
                loadProducts('', selectedCategory || undefined);
            } else {
                // If not a barcode match, pick the first product in the list if only 1 result
                if (products.length === 1) {
                    addToCart(products[0]);
                    setSearchQuery('');
                    loadProducts('', selectedCategory || undefined);
                }
            }
        }
    }

    function calculateAutoDiscount(price: number) {
        if (!autoDiscountEnabled) return 0;

        // Find matching rule
        // Rules are ordered by min_price ASC from backend
        // We generally want the most specific rule or the one that matches ranges.
        // Assuming non-overlapping ranges for now or first match.
        const rule = discountRules.find(r =>
            price >= r.min_price &&
            (r.max_price === null || price < r.max_price) &&
            r.is_active
        );

        if (!rule) return 0;

        if (rule.discount_type === 'fixed') {
            return rule.discount_value;
        } else {
            return price * (rule.discount_value / 100);
        }
    }

    // Modified for Phase 25
    function addToCart(product: Product) {
        const existingItem = cart.find(item => item.id === product.id);
        const currentQtyInCart = existingItem ? existingItem.quantity : 0;

        if (product.stock <= currentQtyInCart) {
            toast.error(`Insufficient stock! Available: ${product.stock}`);
            return;
        }

        // Treatment disclosure warning for gemstones
        if (product.gem_details?.treatment && product.gem_details.treatment.toLowerCase() !== 'none' && product.gem_details.treatment.toLowerCase() !== 'unheated') {
            toast.warning(`⚠️ Treatment Disclosure: "${product.name}" has been treated (${product.gem_details.treatment}). Please inform the customer.`, { duration: 5000 });
        }

        // Per-carat pricing: selling_price already stores the total price (rate × weight)
        // No recalculation needed — just use selling_price directly
        const initialPrice = product.selling_price;
        if (product.pricing_method === 'per_carat' && product.gem_details?.carat_weight && product.gem_details.carat_weight > 0) {
            // selling_price IS the total price already — just show the breakdown info
            toast.info(`${product.gem_details.carat_weight}ct — Total: ${formatCurrency(product.selling_price)}`);
        }

        setModalProduct(product);
        const autoDiscount = calculateAutoDiscount(product.selling_price);
        setModalInitialValues({ quantity: 1, discount: autoDiscount, price: initialPrice });
        setIsCartEditing(false);
        setIsProductModalOpen(true);
    }


    function quickAddToCart(product: Product) {
        // Stock validation
        const existingItem = cart.find(item => item.id === product.id);
        const currentQtyInCart = existingItem ? existingItem.quantity : 0;

        if (product.stock <= currentQtyInCart) {
            toast.error(`Insufficient stock! Available: ${product.stock}`);
            return;
        }

        setCart(prev => {
            const existingIndex = prev.findIndex(item => item.id === product.id);
            if (existingIndex >= 0) {
                return prev.map((item, i) => {
                    if (i === existingIndex) {
                        // Inherit per-unit discount
                        const perUnitDiscount = item.quantity > 0 ? (item.discount / item.quantity) : 0;
                        const newQty = item.quantity + 1;
                        return { ...item, quantity: newQty, discount: perUnitDiscount * newQty };
                    }
                    return item;
                });
            }

            const autoDiscount = calculateAutoDiscount(product.selling_price);

            return [...prev, {
                id: product.id,
                variant_id: null,
                variant_name: null,
                name: product.name,
                price: product.selling_price,
                quantity: 1,
                discount: autoDiscount
            }];
        });

        triggerBump(product.id);
    }

    function triggerBump(id: number) {
        setLastBumpedItemId({ id });
        setTimeout(() => setLastBumpedItemId(null), 300);
    }

    function handleCartItemClick(item: CartItem) {
        // Find product details
        const product = products.find(p => p.id === item.id);
        if (!product) return;

        setModalProduct(product);
        setModalInitialValues({
            quantity: item.quantity,
            discount: item.quantity > 0 ? (item.discount / item.quantity) : 0,
            price: item.price,
        });
        setIsCartEditing(true);
        setIsProductModalOpen(true);
    }

    function handleProductModalConfirm(qty: number, discountInput: number, discountType: 'percentage' | 'fixed', price: number) {
        if (!modalProduct) return;

        // Stock Validation
        const availableStock = modalProduct.stock;

        // Calculate TOTAL qty for this item (existing + added, or just new value if editing)
        let proposedTotalQty = qty;
        if (!isCartEditing) {
            const existingItem = cart.find(item => item.id === modalProduct.id);
            proposedTotalQty = (existingItem?.quantity || 0) + qty;
        }

        if (proposedTotalQty > availableStock) {
            toast.error(`Insufficient stock! Available: ${availableStock}`);
            return;
        }

        const perUnitDiscount = discountType === 'percentage'
            ? (price * (discountInput / 100))
            : discountInput;

        setCart(prev => {
            const existingIndex = prev.findIndex(item => item.id === modalProduct.id);

            // CASE 1: Editing existing item (Replace values)
            if (isCartEditing && existingIndex >= 0) {
                const newQty = qty;
                if (newQty <= 0) {
                    if (newQty === 0) {
                        return prev.filter((_, i) => i !== existingIndex);
                    }
                }
                const totalDiscount = perUnitDiscount * newQty;
                return prev.map((item, i) => i === existingIndex ? { ...item, quantity: newQty, discount: totalDiscount, price: price } : item);
            }

            // CASE 2: Adding new item (Merge/Add)
            if (existingIndex >= 0) {
                const existing = prev[existingIndex];
                const newQty = existing.quantity + qty;

                if (newQty === 0) {
                    return prev.filter((_, i) => i !== existingIndex);
                }

                const totalDiscount = perUnitDiscount * newQty;
                return prev.map((item, i) => i === existingIndex ? { ...item, quantity: newQty, discount: totalDiscount, price: price } : item);
            }

            // CASE 3: New Line Item
            return [...prev, {
                id: modalProduct.id,
                variant_id: null,
                variant_name: null,
                name: modalProduct.name,
                price: price,
                quantity: qty,
                discount: perUnitDiscount * qty
            }];
        });

        triggerBump(modalProduct.id);
        setIsProductModalOpen(false);
        setModalProduct(null);
        // Clear search and reload all products so catalog shows full list
        setSearchQuery('');
        loadProducts('', selectedCategory || undefined);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    }

    function removeFromCart(id: number) {
        setCart(prev => prev.filter(item => item.id !== id));
    }

    function updateQuantity(id: number, delta: number) {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = item.quantity + delta;

                // Stock Check on Increment
                if (delta > 0) {
                    const product = products.find(p => p.id === id);
                    const availableStock = product?.stock || 0;

                    if (newQty > availableStock) {
                        toast.error(`Max stock reached: ${availableStock}`);
                        return item;
                    }
                }

                // Recalculate discount proportionally
                const perUnitDiscount = item.quantity > 0 ? (item.discount / item.quantity) : 0;
                const newTotalDiscount = perUnitDiscount * Math.max(0, newQty);

                return { ...item, quantity: Math.max(0, newQty), discount: newTotalDiscount };
            }
            return item;
        }));
    }



    // --- Hold / Retrieve Logic ---
    async function handleHoldOrder() {
        if (cart.length === 0) return;
        setIsHoldNoteModalOpen(true);
    }

    async function executeHoldOrder(note: string) {
        const finalNote = note || `Order at ${formatDate(new Date(), { showTime: true })}`;
        const res = await saveHeldOrder(cart, selectedCustomer?.id || null, finalNote);
        if (res.success) {
            toast.success('Order held successfully');
            setCart([]);
            setSelectedCustomer(null);
            setCartDiscount({ type: 'none', value: 0 });
        } else {
            toast.error('Failed to hold order');
        }
    }

    async function handleOpenHeldOrders() {
        const orders = await getHeldOrders();
        setHeldOrders(orders);
        setIsHeldOrdersModalOpen(true);
    }

    async function _handleRetrieveOrder(id: number) {
        if (cart.length > 0 && !await confirm({ title: 'Retrieve Order', message: 'Current cart will be replaced. Continue?', type: 'warning' })) return;

        const res = await retrieveHeldOrder(id);
        if (res.success) {
            setCart(res.cart);
            // Ideally fetch customer object if ID exists, but for now we just load ID
            if (res.customerId) {
                const cust = customers.find(c => c.id === res.customerId);
                if (cust) setSelectedCustomer(cust);
            }
            toast.success(`Retrieved: ${res.note}`);
            setIsHeldOrdersModalOpen(false);
        } else {
            toast.error('Failed to retrieve order');
        }
    }

    // --- Checkout Logic ---

    // Derived split total
    const totalPaidSplit = splitPayments.reduce((acc, p) => acc + p.amount, 0);
    const remainingSplit = Math.max(0, finalTotal - totalPaidSplit);

    function _addSplitPayment() {
        const amt = parseFloat(splitAmountInput);
        if (!amt || amt <= 0) return;
        if (amt > remainingSplit && splitMethodInput !== 'Cash') {
            // Non-cash shouldn't overpay typically, but allowing for flexibility
        }

        setSplitPayments(prev => [...prev, { method: splitMethodInput, amount: amt }]);
        setSplitAmountInput('');
        // Auto-switch to next logical step or reset
    }

    function _removeSplitPayment(index: number) {
        setSplitPayments(prev => prev.filter((_, i) => i !== index));
    }

    async function handleEmailReceipt() {
        if (lastSale?.customerEmail) {
            processEmailReceipt(lastSale.customerEmail);
        } else {
            setEmailModalOpen(true);
        }
    }

    // ── Shared invoice builder — fetches full sale from DB for complete data ──
    async function buildInvoicePDF(saleId: number) {
        const { getSaleDetails } = await import('@/app/actions/sales');
        const details = await getSaleDetails(saleId);
        if (!details) throw new Error('Sale not found');
        const currentSettings = (settings && Object.keys(settings).length > 0 ? settings : await getSettings()) as Record<string, string>;
        const sale = details.sale as Record<string, any>;
        const items = (details.items as Record<string, any>[]) || [];
        return buildSalesInvoicePDFFromSaleRecord(sale, items, currentSettings);
    }

    async function processEmailReceipt(email: string) {
        if (!lastSale || !email) return;
        setEmailSending(true);
        try {
            const doc = await buildInvoicePDF(lastSale.id);
            await sendPDFEmail(
                doc,
                email,
                `Invoice - ${lastSale.invoice}`,
                `Please find attached the invoice ${lastSale.invoice} for your purchase.`,
                `Invoice-${lastSale.invoice}.pdf`
            );
            toast.success('Invoice emailed successfully');
            setEmailModalOpen(false);
        } catch (error) {
            console.error('Email error:', error);
            toast.error('Failed to send email');
        } finally {
            setEmailSending(false);
        }
    }

    async function handleDownloadInvoice() {
        if (!lastSale) return;
        setProcessing(true);
        try {
            const doc = await buildInvoicePDF(lastSale.id);
            doc.save(`Invoice-${lastSale.invoice}.pdf`);
            toast.success('Invoice downloaded');
        } catch (error) {
            console.error('Download invoice error:', error);
            toast.error('Failed to download invoice');
        } finally {
            setProcessing(false);
        }
    }

    async function handleManualPrint() {
        if (!lastSale) return;
        setProcessing(true);
        try {
            const doc = await buildInvoicePDF(lastSale.id);
            printPDF(doc);
            toast.success('Opening print dialog');
        } catch (error) {
            console.error('Manual print error:', error);
            toast.error('Failed to print');
        } finally {
            setProcessing(false);
        }
    }

    async function handleCheckout() {
        if (processing) return;

        // Validation for Due sales
        const isPartialOrDue = (paymentMethod === 'Due') ||
            (paymentMethod === 'Split' && (finalTotal - splitPayments.reduce((acc, p) => acc + p.amount, 0) > 0.01));

        if (isPartialOrDue && !selectedCustomer) {
            toast.error('Customer selection required for Due sales');
            return;
        }

        // Validation
        let totalReceived = 0;
        let change = 0;
        let detailsJson = '';
        const buildPaymentDetails = (details: Record<string, any>) => JSON.stringify({
            ...details,
            exchange_rate: exchangeSnapshot,
        });

        if (paymentMethod === 'Cash') {
            totalReceived = Number(cashReceived);
            // Validation: Only error if total is positive and received is less than total
            if (finalTotal > 0 && totalReceived < finalTotal) {
                toast.error('Insufficient cash received!');
                return;
            }
            change = totalReceived - finalTotal;
            detailsJson = buildPaymentDetails({ method: 'Cash', received: totalReceived, change });
        } else if (paymentMethod === 'Split') {
            const paidSoFar = splitPayments.reduce((acc, p) => acc + p.amount, 0);
            if (paidSoFar < finalTotal) {
                // Creating a split sale with balance?
                // User request implies "Due" is explicit. "Split" usually means splitting payments to total.
                // However, if there IS a remainder and customer IS selected, we can treat remainder as Due?
                // Let's allow it IF customer is selected (checked above)
                if (!selectedCustomer) {
                    toast.error(`Remaining amount: ${formatCurrency(finalTotal - paidSoFar)}`);
                    return;
                }
                // If customer exists, remainder is Due.
            }
            totalReceived = paidSoFar;
            change = paidSoFar > finalTotal ? paidSoFar - finalTotal : 0;
            detailsJson = buildPaymentDetails({ method: 'Split', payments: splitPayments, change });
        } else if (paymentMethod === 'Due') {
            // Full amount is due
            totalReceived = 0;
            change = 0;
            detailsJson = buildPaymentDetails({ method: 'Due', fullDue: true });
        } else {
            // Bank / Cheque / Credit (Old)
            totalReceived = finalTotal;
            change = 0;
            detailsJson = buildPaymentDetails({ method: paymentMethod, received: finalTotal, change: 0 });
        }

        setProcessing(true);

        const generalDiscount = cartDiscount.type === 'fixed' ? cartDiscount.value : (subtotal * (cartDiscount.type === 'percentage' ? cartDiscount.value / 100 : 0));
        const itemDiscounts = cart.reduce((acc, item) => acc + (item.discount || 0), 0);
        const totalDiscountValue = generalDiscount + itemDiscounts;

        const clientSaleId = crypto.randomUUID();

        try {
            const res = await createSale(
                cart.map(item => ({ ...item, notes: itemNotes[item.id] || item.notes })),
                finalTotal,
                totalReceived,
                selectedCustomer?.id || null,
                paymentMethod,
                detailsJson,
                0, // redeemedPoints — loyalty removed
                totalDiscountValue,
                session?.sub ? parseInt(session.sub) : 1,
                selectedBroker?.id ?? null,
                parseFloat(brokerCommission) || 0,
                clientSaleId
            );

            if (res.success) {
                setLastSale({
                    id: Number(res.data?.saleId) || 0,
                    cart: [...cart],
                    total: finalTotal,
                    cash: totalReceived,
                    change: change,
                    invoice: res.data?.invoiceNumber || '',
                    customer: selectedCustomer?.name,
                    customerPhone: selectedCustomer?.phone,
                    customerEmail: selectedCustomer?.email,
                    date: new Date().toISOString(),
                    paymentMethod: paymentMethod
                });

                setProcessing(false);
                setShowSuccessModal(true);
                setCart([]);
                setCashReceived('');
                setSplitPayments([]); // Reset
                setPaymentMethod('Cash');
                setCartDiscount({ type: 'none', value: 0 });
                setSelectedCustomer(null);
                setSelectedBroker(null);
                setBrokerCommission('');
                setIsCheckoutModalOpen(false);
                loadProducts();

                // Automated A4 PDF print (browser print dialog)
                if (settings['pos_auto_print_enabled'] !== 'false') {
                    toast.success('Sale completed! Generating invoice...');
                    try {
                        const { getSaleDetails } = await import('@/app/actions/sales');
                        const details = await getSaleDetails(Number(res.data?.saleId));
                        if (details) {
                            const doc = buildSalesInvoicePDFFromSaleRecord(
                                details.sale as Record<string, any>,
                                (details.items as Record<string, any>[]) || [],
                                settings
                            );
                            doc.autoPrint();
                            const blobUrl = doc.output('bloburl');
                            window.open(blobUrl, '_blank');
                        }
                    } catch (e) {
                        console.error('Auto-print error:', e);
                        toast.error('Failed to auto-print invoice');
                    }
                } else {
                    toast.success('Sale completed!');
                }

                // Auto WhatsApp notification if enabled and customer has phone
                if (settings['pos_auto_whatsapp_enabled'] === 'true' && selectedCustomer?.phone) {
                    try {
                        const result = await getWhatsAppLink(Number(res.data?.saleId) || 0, selectedCustomer.phone);
                        if (result.success && (result as any).link) window.open((result as any).link, '_blank');
                    } catch { /* silent */ }
                }

                // Auto email receipt if enabled and customer has email
                if (settings['pos_auto_email_receipt'] === 'true' && selectedCustomer?.email) {
                    try {
                        const { getSaleDetails } = await import('@/app/actions/sales');
                        const details = await getSaleDetails(Number(res.data?.saleId));
                        if (details) {
                            const doc = buildSalesInvoicePDFFromSaleRecord(
                                details.sale as Record<string, any>,
                                (details.items as Record<string, any>[]) || [],
                                settings
                            );
                            await sendPDFEmail(
                                doc,
                                selectedCustomer.email,
                                `Invoice ${res.data?.invoiceNumber || ''}`,
                                `Dear ${selectedCustomer.name}, please find your invoice attached.`,
                                `invoice-${res.data?.invoiceNumber || 'receipt'}.pdf`
                            );
                        }
                    } catch { /* silent */ }
                }
            } else {
                toast.error(res.error);
            }
        } catch (error) {
            if (!navigator.onLine) {
            console.error('Sale network failure, queueing offline:', error);
            const offlineSale = {
                clientSaleId,
                items: [...cart],
                totalAmount: finalTotal,
                cashReceived: totalReceived,
                customerId: selectedCustomer?.id || null,
                paymentMethod: paymentMethod,
                paymentDetails: detailsJson,
                redeemedPoints: 0,
                discountAmount: totalDiscountValue,
                userId: session?.sub ? parseInt(session.sub) : 1,
                brokerId: selectedBroker?.id ?? null,
                brokerCommission: parseFloat(brokerCommission) || 0,
                createdAt: new Date().toISOString(),
                synced: 0
            };
            await localDB.offlineSales.add(offlineSale);
            toast.warning('Network offline. Sale saved locally and will sync later.');

            // Clear UI as if successful (but show warning)
            setCart([]);
            setPaymentMethod('Cash');
            setSelectedCustomer(null);
            setIsCheckoutModalOpen(false);
            setShowSuccessModal(true);
            } else {
                toast.error('Sale failed. Please check your connection and try again.');
            }
        } finally {
            setProcessing(false);
        }
    }

    // Background sync is handled globally by useOfflineSync (via OfflineBanner in layout).
    // No duplicate sync loop needed here.

    async function handleWhatsAppReceipt() {
        if (!lastSale) return;

        const phone = lastSale.customerPhone;
        if (phone) {
            // Customer phone available — skip modal, send directly
            executeWhatsAppReceipt(phone);
        } else {
            setIsPhoneModalOpen({ open: true, type: 'whatsapp' });
        }
    }

    async function executeWhatsAppReceipt(phone: string) {
        if (!lastSale) return;
        setMessagingLoading(true);
        const res = await getWhatsAppLink(lastSale.id, phone);
        setMessagingLoading(false);

        if (res.success && res.link) {
            window.open(res.link, '_blank');
        } else {
            toast.error('Failed to generate WhatsApp link: ' + res.error);
        }
    }



    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    return (
        <div className="pos-layout" style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            height: isMobile ? 'auto' : 'calc(100vh - 4rem)', 
            gap: '1rem', 
            overflow: isMobile ? 'visible' : 'hidden',
        }}>

            {/* LEFT: Products Grid */}
            <div className="card pos-products-panel" style={{ 
                flex: isMobile ? 'none' : '1 1 50%', 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: isMobile ? 'visible' : 'hidden', 
                padding: '1rem',
                minHeight: isMobile ? '500px' : 'auto'
            }}>
                {/* Search + Categories */}
                <div style={{ marginBottom: '0.875rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search products... (F2)"
                                className="input"
                                value={searchQuery}
                                onChange={handleSearch}
                                onKeyDown={handleSearchKeyDown}
                                style={{ paddingLeft: '2.5rem', height: '2.375rem', borderRadius: 'var(--radius-md)' }}
                                autoFocus
                            />
                        </div>
                        <div style={{ position: 'relative', minWidth: isMobile ? '130px' : '180px' }}>
                            <Tag size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', zIndex: 1 }} />
                            <select
                                value={selectedCategory || ''}
                                onChange={(e) => handleCategoryFilter(e.target.value ? Number(e.target.value) : null)}
                                className="input"
                                style={{ 
                                    paddingLeft: '2.25rem', 
                                    height: '2.375rem', 
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.8125rem',
                                    appearance: 'none',
                                    background: 'var(--surface-3)',
                                    borderColor: 'var(--border-strong)',
                                    width: '100%',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)' }}>
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product Grid — scrollable */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '0.75rem',
                    alignContent: 'start',
                    paddingRight: '0.25rem',
                }}>
                    {products.map((product) => {
                        const isOut = product.stock <= 0;
                        const isLow = !isOut && product.stock <= product.reorder_level;
                        return (
                            <div
                                key={product.id}
                                style={{
                                    padding: '0.875rem',
                                    cursor: isOut ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem',
                                    background: 'var(--surface-2)',
                                    border: isOut ? '1px solid rgba(244,63,94,0.2)' : isLow ? '1px solid rgba(245,158,11,0.25)' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-lg)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    opacity: isOut ? 0.5 : 1,
                                    minHeight: 155,
                                }}
                                onClick={() => !isOut && addToCart(product)}
                                onDoubleClick={() => !isOut && quickAddToCart(product)}
                                onMouseEnter={e => {
                                    if (isOut) return;
                                    const el = e.currentTarget as HTMLElement;
                                    el.style.transform = 'translateY(-3px)';
                                    el.style.borderColor = 'rgba(212,175,55,0.5)';
                                    el.style.boxShadow = '0 8px 20px rgba(0,0,0,0.25), 0 0 0 1px rgba(212,175,55,0.12)';
                                    el.style.background = 'var(--surface-3)';
                                }}
                                onMouseLeave={e => {
                                    const el = e.currentTarget as HTMLElement;
                                    el.style.transform = '';
                                    el.style.borderColor = isOut ? 'rgba(244,63,94,0.2)' : isLow ? 'rgba(245,158,11,0.25)' : 'var(--border)';
                                    el.style.boxShadow = '';
                                    el.style.background = 'var(--surface-2)';
                                }}
                            >
                                {/* Badge */}
                                {isLow && <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)', padding: '0.1rem 0.4rem', borderRadius: 99, fontSize: '0.5rem', fontWeight: 800, zIndex: 1 }}>LOW</div>}
                                {isOut && <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(244,63,94,0.15)', color: 'var(--destructive)', border: '1px solid rgba(244,63,94,0.3)', padding: '0.1rem 0.4rem', borderRadius: 99, fontSize: '0.5rem', fontWeight: 800, zIndex: 1 }}>OUT</div>}

                                {/* Image */}
                                <div style={{ height: 72, background: 'var(--surface)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                                    {settings['pos_product_images_enabled'] !== 'false' && product.image_url && !brokenProductImages[product.id] ? (
                                        <img
                                            src={product.image_url.startsWith('/') ? product.image_url : `/${product.image_url}`}
                                            alt={product.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={() => setBrokenProductImages(prev => ({ ...prev, [product.id]: true }))}
                                        />
                                    ) : (
                                        <Gem size={24} color="var(--primary)" style={{ opacity: 0.3 }} />
                                    )}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3, color: 'var(--foreground)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '0.375rem' }}>
                                        {product.name}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--primary)' }}>{formatCurrency(product.selling_price)}</span>
                                        <span style={{ fontSize: '0.625rem', color: isOut ? 'var(--destructive)' : isLow ? 'var(--warning)' : 'var(--muted-foreground)', fontWeight: 600 }}>
                                            {product.stock}{product.pricing_method === 'per_carat' ? 'ct' : 'pc'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {products.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--muted-foreground)', gap: '0.75rem', opacity: 0.4 }}>
                            <Gem size={36} />
                            <p style={{ fontSize: '0.875rem' }}>No products found</p>
                        </div>
                    )}
                </div>
            </div>
            {/* RIGHT: Cart */}
            <div className="card pos-cart-panel" style={{ 
                flex: isMobile ? 'none' : '1 1 50%', 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: isMobile ? 'visible' : 'hidden', 
                padding: '1rem',
                minHeight: isMobile ? '600px' : '0'
            }}>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>Current Order</h3>
                            <div
                                title={isOnline ? 'System Online' : 'Offline Mode'}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.25rem 0.6rem',
                                    background: isOnline ? 'rgba(34, 197, 94, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                                    color: isOnline ? '#166534' : '#9a3412',
                                    borderRadius: '2rem',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    cursor: 'default'
                                }}
                            >
                                {isOnline ? (
                                    pendingCount > 0 ? (
                                        <>
                                            <RefreshCw size={12} className="animate-spin" />
                                            {pendingCount} Pending
                                        </>
                                    ) : (
                                        <>
                                            <Cloud size={12} />
                                            Online
                                        </>
                                    )
                                ) : (
                                    <>
                                        <CloudOff size={12} />
                                        Offline
                                    </>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {cart.length > 0 && (
                                <button
                                    onClick={async () => {
                                        if (await confirm({ title: 'Clear Cart', message: 'Remove all items from the cart?', type: 'warning' })) {
                                            setCart([]);
                                            setCartDiscount({ type: 'none', value: 0 });
                                            setSelectedCustomer(null);
                                            setSelectedBroker(null);
                                            setBrokerCommission('');
                                        }
                                    }}
                                    className="btn btn-outline"
                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', gap: '0.35rem', color: 'var(--destructive)', borderColor: 'rgba(244,63,94,0.3)' }}
                                    title="Clear Cart"
                                >
                                    <X size={14} /> Clear
                                </button>
                            )}
                            <button onClick={handleOpenHeldOrders} className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', gap: '0.35rem' }}>
                                <Clock size={14} /> Held
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline pos-party-header-btn"
                                onClick={() => setIsPartyModalOpen(true)}
                                title="Select customer and broker"
                            >
                                <UsersIcon size={14} /> Parties
                            </button>
                        </div>                    </div>
                    {(selectedCustomer || selectedBroker || brokerCommission) && (
                        <button
                            type="button"
                            className="pos-party-chip"
                            onClick={() => setIsPartyModalOpen(true)}
                        >
                            <UsersIcon size={14} />
                            <span>{selectedCustomer ? selectedCustomer.name : 'Walk-in'}</span>
                            <span>/</span>
                            <span>{selectedBroker ? selectedBroker.name : 'No broker'}</span>
                            {brokerCommission && <strong>{formatCurrency(Number(brokerCommission) || 0)}</strong>}
                        </button>
                    )}
                </div>

                <div className="pos-cart-items" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', paddingRight: '0.125rem' }}>
                    {cart.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '0.75rem', color: 'var(--muted-foreground)', opacity: 0.5 }}>
                            <ShoppingCart size={36} />
                            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cart is empty</p>
                            <p style={{ fontSize: '0.75rem' }}>Click products to add them</p>
                        </div>
                    ) : (
                        cart.map((item, index) => {
                            const isBumped = lastBumpedItemId?.id === item.id;
                            const lineTotal = (item.price * item.quantity) - item.discount;
                            return (
                                <div
                                    key={`${item.id}-${index}`}
                                    className={`${isBumped ? 'cart-bump' : ''}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.625rem 0.75rem',
                                        background: isBumped ? 'rgba(212,175,55,0.1)' : 'var(--surface-2)',
                                        borderRadius: 'var(--radius)',
                                        border: `1px solid ${isBumped ? 'rgba(212,175,55,0.3)' : 'var(--border)'}`,
                                        transition: 'all 0.15s ease',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => handleCartItemClick(item)}
                                    onMouseEnter={e => {
                                        if (!isBumped) {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.3)';
                                            (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isBumped) {
                                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                                            (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                                        }
                                    }}
                                >
                                    {/* Item info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.125rem' }}>
                                            <span>{formatCurrency(item.price)}</span>
                                            {item.discount > 0 && <span style={{ color: 'var(--success)' }}>-{formatCurrency(item.discount)}</span>}
                                        </div>
                                        {itemNotes[item.id] && (
                                            <div style={{ fontSize: '0.625rem', color: 'var(--muted-foreground)', fontStyle: 'italic', marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                📝 {itemNotes[item.id]}
                                            </div>
                                        )}
                                        {openNotesItemId === item.id && (
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="Special instructions..."
                                                value={itemNotes[item.id] || ''}
                                                onChange={e => setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                onClick={e => e.stopPropagation()}
                                                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); setOpenNotesItemId(null); } }}
                                                autoFocus
                                                style={{ marginTop: '0.25rem', fontSize: '0.75rem', height: '1.75rem', padding: '0 0.5rem' }}
                                            />
                                        )}
                                    </div>
                                    {/* Qty controls */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                                        <button onClick={e => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                                            style={{ width: 24, height: 24, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--foreground)' }}>
                                            <Minus size={11} />
                                        </button>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, width: 22, textAlign: 'center' }}>{item.quantity}</span>
                                        <button onClick={e => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                                            style={{ width: 24, height: 24, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--foreground)' }}>
                                            <Plus size={11} />
                                        </button>
                                    </div>
                                    {/* Line total */}
                                    <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--primary)', minWidth: 60, textAlign: 'right', flexShrink: 0 }}>
                                        {formatCurrency(lineTotal)}
                                    </div>
                                    {/* Notes button */}
                                    <button onClick={e => { e.stopPropagation(); setOpenNotesItemId(openNotesItemId === item.id ? null : item.id); }}
                                        title="Add special instructions"
                                        style={{ width: 22, height: 22, border: 'none', background: 'transparent', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: itemNotes[item.id] ? 'var(--primary)' : 'var(--muted)', flexShrink: 0 }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = itemNotes[item.id] ? 'var(--primary)' : 'var(--muted)'}
                                    >
                                        <MessageSquare size={13} />
                                    </button>
                                    {/* Remove */}
                                    <button onClick={e => { e.stopPropagation(); removeFromCart(item.id); }}
                                        style={{ width: 22, height: 22, border: 'none', background: 'transparent', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--destructive)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>

                    {/* Discount Section */}
                    <div style={{ padding: '0.75rem', background: 'var(--secondary)', borderRadius: 'var(--radius)', marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <button
                                ref={noDiscountBtnRef}
                                onClick={() => setCartDiscount({ type: 'none', value: 0 })}
                                className={cartDiscount.type === 'none' ? 'btn btn-primary' : 'btn btn-outline'}
                                style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}
                            >
                                No Discount
                            </button>
                            <button
                                ref={percentBtnRef}
                                onClick={() => {
                                    setCartDiscount({ type: 'percentage', value: cartDiscount.type === 'percentage' ? cartDiscount.value : 0 });
                                    setTimeout(() => cartDiscountInputRef.current?.focus(), 10);
                                }}
                                className={cartDiscount.type === 'percentage' ? 'btn btn-primary' : 'btn btn-outline'}
                                style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}
                            >
                                %
                            </button>
                            <button
                                ref={fixedBtnRef}
                                onClick={() => {
                                    setCartDiscount({ type: 'fixed', value: cartDiscount.type === 'fixed' ? cartDiscount.value : 0 });
                                    setTimeout(() => cartDiscountInputRef.current?.focus(), 10);
                                }}
                                className={cartDiscount.type === 'fixed' ? 'btn btn-primary' : 'btn btn-outline'}
                                style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}
                            >
                                Fixed
                            </button>
                        </div>

                        {cartDiscount.type !== 'none' && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                    ref={cartDiscountInputRef}
                                    type="number"
                                    min="0"
                                    max={cartDiscount.type === 'percentage' ? 100 : subtotal}
                                    value={cartDiscount.value || ''}
                                    onChange={(e) => setCartDiscount({ ...cartDiscount, value: Number(e.target.value) })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (cart.length > 0) setIsCheckoutModalOpen(true);
                                        }
                                    }}
                                    className="input"
                                    placeholder={cartDiscount.type === 'percentage' ? '0-100%' : 'Amount'}
                                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', minWidth: '80px', textAlign: 'right' }}>
                                    -{cartDiscountAmount.toFixed(2)}
                                </span>
                            </div>
                        )}
                    </div>

                    {totalDiscount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontSize: '0.875rem' }}>
                            <span>Total Discount</span>
                            <span>-{formatCurrency(totalDiscount)}</span>
                        </div>
                    )}

                    {taxEnabled && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--muted)' }}>
                            <span>{settings.tax_name || 'Tax'} ({taxRate}%{taxInclusive ? ' incl.' : ''})</span>
                            <span>{formatCurrency(taxAmount)}</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '0.5rem' }}>
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                    </div>
                    {totalExchange && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                            <span>{totalExchange.code} equivalent</span>
                            <span>{totalExchange.formatted}</span>
                        </div>
                    )}
                    {exchangeRateLine && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', textAlign: 'right' }}>
                            Rate: {exchangeRateLine}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                            className="btn btn-outline"
                            style={{
                                height: '3.5rem',
                                fontSize: '0.85rem',
                                padding: '0.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.1rem',
                                lineHeight: '1.2'
                            }}
                            disabled={cart.length === 0}
                            onClick={handleHoldOrder}
                        >
                            <PauseCircle size={16} />
                            <span style={{ textAlign: 'center' }}>Hold Order</span>
                        </button>
                        <button
                            className="btn btn-outline"
                            style={{
                                height: '3.5rem',
                                fontSize: '0.85rem',
                                padding: '0.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.1rem',
                                lineHeight: '1.2'
                            }}
                            onClick={() => setIsDueCollectionModalOpen(true)}
                        >
                            <DollarSign size={16} />
                            <span style={{ textAlign: 'center' }}>Due</span>
                        </button>
                        <button
                            className="btn btn-primary"
                            style={{
                                height: '3.5rem',
                                fontSize: '0.9rem',
                                padding: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold'
                            }}
                            disabled={cart.length === 0}
                            onClick={() => setIsCheckoutModalOpen(true)}
                        >
                            Checkout
                        </button>
                    </div>
                </div>
            </div>

            {/* Checkout Modal Overlay */}
            {isCheckoutModalOpen && createPortal(
                <div className="modal-blur-overlay" style={{ zIndex: 999999 }}>
                    <div className="modal-portal-content pos-checkout-modal" style={{ maxWidth: '450px' }}>
                        <div className="card modal-card" style={{ width: '100%', padding: 0 }}>
                            <div className="modal-header">
                                <h2>Checkout</h2>
                                <button onClick={() => setIsCheckoutModalOpen(false)} className="btn-close"><X size={24} /></button>
                            </div>

                        <div className="modal-card-body pos-checkout-modal__body" style={{ padding: '1.5rem' }}>
                            {/* Total + item count summary */}
                            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
                                    {cart.length} item{cart.length !== 1 ? 's' : ''} · {cart.reduce((s, i) => s + i.quantity, 0)} unit{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}
                                </div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                                    {formatCurrency(finalTotal)}
                                </div>
                                {finalTotalExchange && (
                                    <div style={{ fontSize: '1rem', color: 'var(--muted-foreground)', fontWeight: 700, marginTop: '0.5rem' }}>
                                        {finalTotalExchange.formatted} {finalTotalExchange.code}
                                        {exchangeRateLine && (
                                            <div style={{ fontSize: '0.75rem', fontWeight: 500, marginTop: '0.25rem' }}>
                                                Rate: {exchangeRateLine}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {totalDiscount > 0 && (
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 600, marginTop: '0.375rem' }}>
                                        Discount: -{formatCurrency(totalDiscount)}
                                    </div>
                                )}
                            </div>
                            {/* Cart summary */}
                            {cart.length > 0 && (
                                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1.25rem', maxHeight: 140, overflowY: 'auto' }}>
                                    {cart.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0', borderBottom: i < cart.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                            <div style={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                                                <span style={{ fontWeight: 600 }}>{item.quantity}×</span> {item.name}
                                            </div>
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>
                                                {formatCurrency((item.price * item.quantity) - item.discount)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Payment Methods */}
                            <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--muted)' }}>PAYMENT METHOD</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                {(['Cash', 'Bank', 'Cheque', 'Split', 'Due'] as const).map(method => (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => {
                                            if (method === 'Due' && !selectedCustomer) {
                                                toast.error('Please select a customer for due sales');
                                            }
                                            setPaymentMethod(method);
                                            if (method === 'Cash') setTimeout(() => cashInputRef.current?.focus(), 50);
                                            if (method === 'Split') setTimeout(() => splitAmountInputRef.current?.focus(), 50);
                                        }}
                                        className={paymentMethod === method ? 'btn btn-primary' : 'btn btn-outline'}
                                        style={{ padding: '0.75rem 0.25rem', fontSize: '0.75rem', fontWeight: 600 }}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>

                            {/* Dynamic Inputs */}
                            <div style={{ minHeight: '120px' }}>
                                {paymentMethod === 'Cash' && (
                                    <div className="form-group">
                                        <label style={{ fontWeight: 500 }}>Cash Received</label>
                                        <input
                                            ref={cashInputRef}
                                            type="number"
                                            className="input"
                                            style={{ fontSize: '1.75rem', height: '4rem', textAlign: 'center', fontWeight: 'bold' }}
                                            value={cashReceived}
                                            onChange={(e) => setCashReceived(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCheckout()}
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                        {Number(cashReceived) >= finalTotal && (
                                            <div style={{ marginTop: '0.75rem', textAlign: 'center', color: 'var(--success)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                                Change: {formatCurrency(Number(cashReceived) - finalTotal)}
                                                {cashChangeExchange && (
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
                                                        {cashChangeExchange.formatted} {cashChangeExchange.code}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {paymentMethod === 'Split' && (
                                    <div style={{ background: 'var(--secondary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontWeight: 'bold' }}>
                                            <span>Remaining</span>
                                            <span style={{ color: subtotalAfterDiscount - splitPayments.reduce((acc, p) => acc + p.amount, 0) > 0 ? 'var(--destructive)' : 'var(--success)' }}>
                                                {formatCurrency(splitRemaining)}
                                            </span>
                                        </div>
                                        {splitRemainingExchange && (
                                            <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '-0.625rem', marginBottom: '1rem' }}>
                                                {splitRemainingExchange.formatted} {splitRemainingExchange.code}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                            <select
                                                className="input"
                                                style={{ width: '90px' }}
                                                value={splitMethodInput}
                                                onChange={e => setSplitMethodInput(e.target.value)}
                                            >
                                                <option value="Cash">Cash</option>
                                                <option value="Bank">Bank Transfer</option>
                                                <option value="Cheque">Cheque</option>
                                            </select>
                                            <input
                                                ref={splitAmountInputRef}
                                                type="number"
                                                className="input"
                                                placeholder="Amount"
                                                style={{ flex: 1 }}
                                                value={splitAmountInput}
                                                onChange={e => setSplitAmountInput(e.target.value)}
                                                autoFocus
                                            />
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '0 1rem' }}
                                                onClick={() => {
                                                    const amt = parseFloat(splitAmountInput);
                                                    if (amt > 0) {
                                                        setSplitPayments([...splitPayments, { method: splitMethodInput, amount: amt }]);
                                                        setSplitAmountInput('');
                                                    }
                                                }}
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {splitPayments.map((p, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--surface)', borderRadius: '4px' }}>
                                                    <span style={{ fontSize: '0.875rem' }}>{p.method}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</span>
                                                        <button onClick={() => setSplitPayments(splitPayments.filter((_, idx) => idx !== i))} style={{ color: 'var(--destructive)', background: 'none', border: 'none', cursor: 'pointer' }}><Minus size={16} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(paymentMethod === 'Bank' || paymentMethod === 'Cheque') && (
                                    <div style={{ padding: '2rem', background: 'var(--secondary)', borderRadius: 'var(--radius)', textAlign: 'center', border: '1px dashed var(--border)' }}>
                                        <p style={{ margin: 0, color: 'var(--muted)' }}>
                                            {paymentMethod === 'Bank' ? 'Please verify bank transfer / online payment received' :
                                                'Please collect and verify the cheque'}
                                        </p>
                                    </div>
                                )}

                                {paymentMethod === 'Due' && (
                                    <div style={{ padding: '2rem', background: 'var(--secondary)', borderRadius: 'var(--radius)', textAlign: 'center', border: '1px dashed var(--destructive)' }}>
                                        <h3 style={{ color: 'var(--destructive)', marginBottom: '0.5rem' }}>Full Amount Due</h3>
                                        <p style={{ margin: 0, color: 'var(--muted)' }}>
                                            Total <strong>{formatCurrency(finalTotal)}</strong> will be added to
                                            <strong> {selectedCustomer?.name || 'Customer'}</strong>&apos;s balance.
                                        </p>
                                        {!selectedCustomer && <div style={{ color: 'red', fontWeight: 'bold', marginTop: '1rem', animation: 'pulse 1s infinite' }}>PLEASE SELECT A CUSTOMER</div>}
                                    </div>
                                )}
                            </div>

                            <button
                                className={finalTotal < 0 ? 'btn btn-destructive' : 'btn btn-primary'}
                                style={{
                                    width: '100%',
                                    height: '3.75rem',
                                    fontSize: '1.0625rem',
                                    marginTop: '1.5rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.01em',
                                    borderRadius: 'var(--radius-lg)',
                                    boxShadow: finalTotal < 0
                                        ? '0 4px 16px rgba(244,63,94,0.35)'
                                        : '0 4px 16px rgba(212,175,55,0.35)',
                                }}
                                onClick={handleCheckout}
                                disabled={processing}
                            >
                                {processing ? 'Processing...' : (finalTotal < 0 ? 'Complete Return' : 'Complete Sale')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )}

            {isPartyModalOpen && createPortal(
                <div className="modal-blur-overlay" style={{ zIndex: 999999 }} onClick={() => setIsPartyModalOpen(false)}>
                    <div className="modal-portal-content pos-party-modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
                        <div className="card modal-card" style={{ width: '100%', padding: 0 }}>
                            <div className="modal-header pos-party-modal__header">
                                <div>
                                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                        <UsersIcon size={18} /> Order Parties
                                    </h2>
                                    <p>Choose who this order belongs to and who should receive commission.</p>
                                </div>
                                <button onClick={() => setIsPartyModalOpen(false)} className="btn-close"><X size={20} /></button>
                            </div>
                            <div className="modal-card-body pos-party-modal__body">
                                <div className="pos-party-modal__grid">
                                    <section className="pos-party-modal__section">
                                        <div className="pos-party-modal__section-title">
                                            <User size={16} />
                                            Customer
                                        </div>
                                        <label className="label">Customer for this order</label>
                                        <select
                                            className="input"
                                            value={selectedCustomer?.id || ''}
                                            onChange={(e) => {
                                                const cust = customers.find(c => c.id === Number(e.target.value));
                                                setSelectedCustomer(cust || null);
                                            }}
                                        >
                                            <option value="">Walk-in customer</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        <div className="pos-party-modal__hint">
                                            Due sales and automatic receipts use the selected customer&apos;s account details.
                                        </div>
                                        {selectedCustomer && (
                                            <div className="pos-party-modal__info">
                                                {selectedCustomer.phone && <span>Phone: {selectedCustomer.phone}</span>}
                                                {selectedCustomer.email && <span>Email: {selectedCustomer.email}</span>}
                                            </div>
                                        )}
                                    </section>

                                    <section className="pos-party-modal__section">
                                        <div className="pos-party-modal__section-title">
                                            <UsersIcon size={16} />
                                            Broker / Middleman
                                        </div>
                                        <label className="label">Broker for this order</label>
                                        <select
                                            className="input"
                                            value={selectedBroker?.id || ''}
                                            onChange={(e) => {
                                                const broker = brokers.find(b => b.id === Number(e.target.value));
                                                setSelectedBroker(broker || null);
                                            }}
                                        >
                                            <option value="">No broker</option>
                                            {brokers.filter(b => b.is_active).map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>

                                        <label className="label" style={{ marginTop: '0.875rem' }}>Commission</label>
                                        <div style={{ position: 'relative' }}>
                                            <HandCoins size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                                            <input
                                                type="number"
                                                className="input"
                                                placeholder="0.00"
                                                style={{ paddingLeft: '2.25rem' }}
                                                value={brokerCommission}
                                                onChange={(e) => setBrokerCommission(e.target.value)}
                                            />
                                        </div>
                                        {selectedBroker && (
                                            <div className="pos-party-modal__info">
                                                {selectedBroker.phone && <span>Phone: {selectedBroker.phone}</span>}
                                                {selectedBroker.email && <span>Email: {selectedBroker.email}</span>}
                                            </div>
                                        )}
                                    </section>
                                </div>

                                <div className="pos-party-modal__summary">
                                    <div>
                                        <span>Customer</span>
                                        <strong>{selectedCustomer ? selectedCustomer.name : 'Walk-in'}</strong>
                                    </div>
                                    <div>
                                        <span>Broker</span>
                                        <strong>{selectedBroker ? selectedBroker.name : 'None'}</strong>
                                    </div>
                                    <div>
                                        <span>Commission</span>
                                        <strong>{brokerCommission ? formatCurrency(Number(brokerCommission) || 0) : formatCurrency(0)}</strong>
                                    </div>
                                </div>

                                <div className="modal-action-row" style={{ marginTop: 0 }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setSelectedCustomer(null);
                                            setSelectedBroker(null);
                                            setBrokerCommission('');
                                        }}
                                    >
                                        Clear Parties
                                    </button>
                                    <button type="button" className="btn btn-primary" onClick={() => setIsPartyModalOpen(false)}>
                                        Apply to Order
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isDueCollectionModalOpen && <DueCollectionModal isOpen={isDueCollectionModalOpen} onClose={() => setIsDueCollectionModalOpen(false)} />}

            <InputModal
                isOpen={emailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                title="Email Invoice"
                placeholder="customer@example.com"
                defaultValue={lastSale?.customerEmail || ''}
                confirmLabel="Send Email"
                onConfirm={processEmailReceipt}
            />

            {/* Success Modal */}
            {showSuccessModal && lastSale && createPortal(
                <div className="modal-blur-overlay" style={{ zIndex: 999999 }}>
                    <div className="modal-portal-content" style={{ maxWidth: '420px' }}>
                        <div style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 'var(--radius-xl)',
                            boxShadow: 'var(--shadow-xl)',
                            overflow: 'hidden',
                            animation: 'modalScaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
                        }}>
                        {/* Green success header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                            padding: '1.75rem 1.5rem 1.25rem',
                            textAlign: 'center',
                            position: 'relative',
                        }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 0.875rem',
                                border: '2px solid rgba(255,255,255,0.4)',
                            }}>
                                <CheckCircle size={30} color="white" />
                            </div>
                            <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem', margin: 0, letterSpacing: '-0.02em' }}>
                                Sale Successful!
                            </h2>
                            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8125rem', margin: '0.25rem 0 0', fontFamily: 'var(--font-mono)' }}>
                                {lastSale.invoice}
                            </p>
                        </div>

                        {/* Total amount */}
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</div>
                                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--foreground)', letterSpacing: '-0.03em' }}>
                                    {formatCurrency(lastSale.total)}
                                </div>
                                {lastSaleTotalExchange && (
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', fontWeight: 700, marginTop: '0.25rem' }}>
                                        {lastSaleTotalExchange.formatted} {lastSaleTotalExchange.code}
                                    </div>
                                )}
                            </div>
                            {lastSale.change > 0 && (
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Change</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>
                                        {formatCurrency(lastSale.change)}
                                    </div>
                                    {lastSaleChangeExchange && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontWeight: 700, marginTop: '0.25rem' }}>
                                            {lastSaleChangeExchange.formatted} {lastSaleChangeExchange.code}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        {settings['pos_auto_print_enabled'] !== 'true' && (
                            <div style={{ padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <button onClick={handleWhatsAppReceipt} disabled={messagingLoading}
                                    className="btn btn-secondary btn-sm"
                                    style={{ gap: '0.375rem', justifyContent: 'center', borderColor: 'rgba(37,211,102,0.3)', color: '#128C7E' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396 0 12.032c0 2.12.556 4.189 1.613 6.041L0 24l6.105-1.602a11.803 11.803 0 005.937 1.597h.005c6.632 0 12.028-5.397 12.031-12.034a11.85 11.85 0 00-3.529-8.498z" />
                                    </svg>
                                    WhatsApp
                                </button>
                                <button onClick={handleEmailReceipt} disabled={messagingLoading}
                                    className="btn btn-secondary btn-sm" style={{ gap: '0.375rem', justifyContent: 'center' }}>
                                    <Mail size={14} /> Email
                                </button>
                                <button onClick={handleManualPrint} disabled={processing}
                                    className="btn btn-secondary btn-sm" style={{ gap: '0.375rem', justifyContent: 'center' }}>
                                    <Printer size={14} /> Print
                                </button>
                                <button onClick={handleDownloadInvoice} disabled={processing}
                                    className="btn btn-secondary btn-sm" style={{ gap: '0.375rem', justifyContent: 'center' }}>
                                    <FileText size={14} /> Download PDF
                                </button>
                            </div>
                        )}

                        {/* Done button */}
                        <div style={{ padding: settings['pos_auto_print_enabled'] !== 'true' ? '0 1.5rem 1.5rem' : '1.5rem' }}>
                            <button onClick={() => setShowSuccessModal(false)}
                                className="btn btn-primary"
                                style={{ width: '100%', height: '3rem', fontSize: '1rem', fontWeight: 700, borderRadius: 'var(--radius-lg)' }}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )}

            {isHeldOrdersModalOpen && createPortal(
                <div className="modal-blur-overlay" style={{ zIndex: 999999 }}>
                    <div className="modal-portal-content" style={{ maxWidth: '600px' }}>
                        <div className="card" style={{ width: '100%', padding: 0 }}>
                            <div className="modal-header">
                                <h2>Held Orders</h2>
                                <button onClick={() => setIsHeldOrdersModalOpen(false)} className="btn-close"><X size={20} /></button>
                            </div>
                        <div style={{ padding: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
                            {heldOrders.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>No held orders found.</div>
                            ) : (
                                heldOrders.map((order) => (
                                    <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{order.name || 'Unnamed Order'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{formatDate(order.date)}</div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                const res = await retrieveHeldOrder(order.id);
                                                if (res.success) {
                                                    setCart(res.cart);
                                                    setSelectedCustomer(customers.find(c => c.id === res.customerId) || null);
                                                    setIsHeldOrdersModalOpen(false);
                                                    toast.success('Order retrieved');
                                                }
                                            }}
                                            className="btn btn-primary"
                                        >
                                            Retrieve
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )}

            <ProductEntryModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                onConfirm={handleProductModalConfirm}
                product={modalProduct}
                currencySymbol={getCurrentCurrencySymbol()}
                initialQuantity={modalInitialValues.quantity}
                initialDiscount={modalInitialValues.discount}
                initialPrice={modalInitialValues.price}
            />

            <ManagerOverrideModal
                isOpen={isOverrideModalOpen}
                onClose={() => {
                    setIsOverrideModalOpen(false);
                    setPendingItemAction(null);
                }}
                onSuccess={() => {
                    if (pendingItemAction) {
                        pendingItemAction();
                        setPendingItemAction(null);
                    }
                }}
                actionDescription={overrideDescription}
            />
            {/* Input Modals */}


            <InputModal
                isOpen={isHoldNoteModalOpen}
                onClose={() => setIsHoldNoteModalOpen(false)}
                defaultValue={`Order at ${formatDate(new Date(), { showTime: true })}`}
                confirmLabel="Hold Order"
                title="Hold Order"
                onConfirm={(note) => executeHoldOrder(note)}
            />

            <InputModal
                isOpen={isPhoneModalOpen.open}
                onClose={() => setIsPhoneModalOpen({ ...isPhoneModalOpen, open: false })}
                onConfirm={executeWhatsAppReceipt}
                title="Send WhatsApp Receipt"
                description="Enter customer phone number (with country code, e.g., 923001234567)."
                placeholder="923001234567"
                inputType="text"
                confirmLabel="Open WhatsApp"
                defaultValue={lastSale?.customerPhone || ''}
            />
        </div>
    );
}

function _ShoppingBagIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
    )
}
