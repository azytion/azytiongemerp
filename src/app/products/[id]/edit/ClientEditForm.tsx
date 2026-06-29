'use client';

/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { updateProduct } from '@/app/actions/products';
import { generateProductImage } from '@/app/actions/ai';
import { uploadProductImage } from '@/app/actions/upload';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, Sparkles, Image as ImageIcon, Trash2, Diamond, Info } from 'lucide-react';
import Link from 'next/link';

export default function ClientEditForm({ product, categories }: { product: any, categories: any[] }) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'gem_details'>('general');
    const [imageUrl, setImageUrl] = useState(product.image_url || '');
    const [generatingImage, setGeneratingImage] = useState(false);

    // Gemstone Data State
    const [gemData, setGemData] = useState({
        gem_carat_weight: product.gem_details?.carat_weight || '',
        gem_dimensions: product.gem_details?.dimensions || '',
        gem_shape: product.gem_details?.shape || '',
        gem_color: product.gem_details?.color || '',
        gem_clarity: product.gem_details?.clarity || '',
        gem_cut_grade: product.gem_details?.cut_grade || '',
        gem_origin: product.gem_details?.origin || '',
        gem_treatment: product.gem_details?.treatment || '',
        gem_certificate_provider: product.gem_details?.certificate_provider || '',
        gem_certificate_number: product.gem_details?.certificate_number || '',
        gem_certificate_url: product.gem_details?.certificate_url || '',
        price_per_carat: '' // Helper
    });

    const [pricingMethod, setPricingMethod] = useState<'per_piece' | 'per_carat'>(product.pricing_method || 'per_piece');
    const [sellingPrice, setSellingPrice] = useState(product.selling_price || '');

    // Initialize price_per_carat if applicable
    useEffect(() => {
        if (pricingMethod === 'per_carat' && product.gem_details?.carat_weight && product.selling_price) {
            const weight = parseFloat(product.gem_details.carat_weight);
            if (weight > 0) {
                setGemData(prev => ({ ...prev, price_per_carat: (product.selling_price / weight).toFixed(2) }));
            }
        }
    }, []);

    const handleGemInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setGemData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-calculate Total Price if Pricing Method is Per Carat
            if (pricingMethod === 'per_carat') {
                if (name === 'gem_carat_weight' || name === 'price_per_carat') {
                    const weight = parseFloat(name === 'gem_carat_weight' ? value : prev.gem_carat_weight) || 0;
                    const perCarat = parseFloat(name === 'price_per_carat' ? value : prev.price_per_carat) || 0;
                    if (weight > 0 && perCarat > 0) {
                        setSellingPrice((weight * perCarat).toFixed(2));
                    }
                }
            }
            return newData;
        });
    };

    // Effect to update price when switching pricing method
    useEffect(() => {
        if (pricingMethod === 'per_carat') {
            const weight = parseFloat(String(gemData.gem_carat_weight)) || 0;
            const perCarat = parseFloat(String(gemData.price_per_carat)) || 0;
            if (weight > 0 && perCarat > 0) {
                setSellingPrice((weight * perCarat).toFixed(2));
            }
        }
    }, [pricingMethod]);

    async function handleSubmit(formData: FormData) {
        formData.set('image_url', imageUrl);
        formData.set('pricing_method', pricingMethod);
        formData.set('selling_price', String(sellingPrice));

        // Set Gem Details (use set to override any existing form values)
        Object.entries(gemData).forEach(([key, value]) => {
            formData.set(key, String(value ?? ''));
        });

        const result = await updateProduct(product.id, formData);
        if (result.success) {
            toast.success('Product updated successfully');
            router.refresh();
        } else {
            toast.error(result.error || 'Failed to update product');
        }
    }

    async function handleGenerateAIImage() {
        const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement;
        const catInput = document.querySelector('select[name="category_id"]') as HTMLSelectElement;

        const name = nameInput?.value;
        const category = catInput?.options[catInput.selectedIndex]?.text || '';

        if (!name) return toast.error("Product name required");

        setGeneratingImage(true);
        const res = await generateProductImage(name, category);
        setGeneratingImage(false);

        if (res.success && res.imageUrl) {
            setImageUrl(res.imageUrl!);
            toast.success("AI Image Generated!");
        } else {
            toast.error(res.error || "Failed to generate image");
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('file', file);

        toast.loading("Uploading image...", { id: 'upload-toast' });
        const res = await uploadProductImage(uploadData);
        toast.dismiss('upload-toast');

        if (res.success && res.imageUrl) {
            setImageUrl(res.imageUrl!);
            toast.success("Image uploaded successfully");
        } else {
            toast.error(res.error || "Failed to upload image");
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={() => setActiveTab('general')}
                    className={activeTab === 'general' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ flex: 1, border: 'none', gap: '0.5rem' }}
                >
                    <Info size={16} /> General Info
                </button>
                <button
                    onClick={() => setActiveTab('gem_details')}
                    className={activeTab === 'gem_details' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ flex: 1, border: 'none', gap: '0.5rem' }}
                >
                    <Diamond size={16} /> Gemstone Details
                </button>
            </div>

            <form action={handleSubmit}>
                <div style={{ display: activeTab === 'general' ? 'block' : 'none' }}>
                    <div className="card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label">Product Name</label>
                                    <input name="name" type="text" className="input" required defaultValue={product.name} />
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label">Barcode</label>
                                    <input name="barcode" type="text" className="input" defaultValue={product.barcode || ''} />
                                </div>
                            </div>

                            <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label">Category</label>
                                    <select name="category_id" className="input" defaultValue={product.category_id || ''}>
                                        <option value="">Select Category</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label">Pricing Method</label>
                                    <select
                                        name="pricing_method"
                                        className="input"
                                        value={pricingMethod}
                                        onChange={(e) => setPricingMethod(e.target.value as any)}
                                    >
                                        <option value="per_piece">Per Piece / Fixed Price</option>
                                        <option value="per_carat">Per Carat (Weight Based)</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label">Product Type</label>
                                    <select name="type" className="input" defaultValue={product.type || 'single'}>
                                        <option value="single">Single Item</option>
                                        <option value="lot">Lot / Parcel</option>
                                        <option value="jewelry">Jewelry Piece</option>
                                    </select>
                                </div>
                            </div>

                            {pricingMethod === 'per_carat' && (
                                <div className="card" style={{ padding: '1rem', background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                            <label className="label">Carat Weight</label>
                                            <input
                                                name="gem_carat_weight"
                                                type="number"
                                                step="0.01"
                                                className="input"
                                                placeholder="0.00"
                                                value={gemData.gem_carat_weight}
                                                onChange={handleGemInputChange}
                                            />
                                        </div>
                                        <div style={{ paddingBottom: '0.75rem' }}>×</div>
                                        <div style={{ flex: 1 }}>
                                            <label className="label">Price Per Carat</label>
                                            <input
                                                name="price_per_carat"
                                                type="number"
                                                step="0.01"
                                                className="input"
                                                placeholder="0.00"
                                                value={gemData.price_per_carat}
                                                onChange={handleGemInputChange}
                                            />
                                        </div>
                                        <div style={{ paddingBottom: '0.75rem' }}>=</div>
                                        <div style={{ flex: 1 }}>
                                            <label className="label">Total Selling Price</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={sellingPrice}
                                                disabled
                                                style={{ backgroundColor: 'var(--muted)', opacity: 0.7 }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label">Cost Price (Total)</label>
                                    <input name="cost_price" type="number" step="0.01" className="input" required defaultValue={product.cost_price} />
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label">Selling Price (Total)</label>
                                    <input
                                        name="selling_price"
                                        type="number"
                                        step="0.01"
                                        className="input"
                                        required
                                        value={sellingPrice}
                                        onChange={(e) => setSellingPrice(e.target.value)}
                                        readOnly={pricingMethod === 'per_carat'}
                                    />
                                </div>
                            </div>

                            <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label">Stock Quantity</label>
                                    <input name="stock" type="number" className="input" defaultValue={product.stock} min="0" />
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label className="label">Reorder Level</label>
                                    <input name="reorder_level" type="number" className="input" defaultValue={product.reorder_level} min="0" />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label">Notes</label>
                                <textarea name="notes" className="input" rows={3} defaultValue={product.notes || ''}></textarea>
                            </div>

                            <div className="card" style={{ padding: '1.5rem', background: 'var(--secondary)', border: '1px dashed var(--border)' }}>
                                <label className="label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <ImageIcon size={18} /> Product Image
                                </label>

                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: '150px',
                                        height: '150px',
                                        background: 'var(--surface)',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        border: '1px solid var(--border)',
                                        position: 'relative'
                                    }}>
                                        {imageUrl ? (
                                            <>
                                                <img
                                                    src={imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}
                                                    alt="Preview"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                                        if (fallback) fallback.style.display = 'flex';
                                                    }}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                                <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                                                    <ImageIcon size={32} style={{ opacity: 0.3 }} />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setImageUrl('')}
                                                    style={{
                                                        position: 'absolute', top: '5px', right: '5px',
                                                        background: 'rgba(0,0,0,0.5)', color: 'white',
                                                        border: 'none', borderRadius: '4px', padding: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem' }}>
                                                <ImageIcon size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                                                <div>No Image</div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>IMAGE URL</label>
                                            <input
                                                name="image_url"
                                                className="input"
                                                placeholder="https://..."
                                                value={imageUrl}
                                                onChange={(e) => setImageUrl(e.target.value)}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileUpload}
                                                style={{ display: 'none' }}
                                                accept="image/*"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="btn btn-outline"
                                                style={{ flex: 1, gap: '0.5rem' }}
                                            >
                                                <ImageIcon size={18} />
                                                Upload from device
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleGenerateAIImage}
                                                disabled={generatingImage}
                                                className="btn btn-outline"
                                                style={{ flex: 1, gap: '0.5rem', borderStyle: 'dashed', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                            >
                                                <Sparkles size={18} />
                                                {generatingImage ? 'Generating...' : 'ZATION GemERP'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <Link href="/inventory-management?tab=products" className="btn btn-outline">Back to Inventory</Link>
                                <button type="submit" className="btn btn-primary">
                                    <Save size={20} />
                                    Update Base Product
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: activeTab === 'gem_details' ? 'block' : 'none' }}>
                    <div className="card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="label">Carat Weight</label>
                                    <input
                                        name="gem_carat_weight"
                                        type="number"
                                        step="0.01"
                                        className="input"
                                        value={gemData.gem_carat_weight}
                                        onChange={handleGemInputChange}
                                        placeholder="e.g. 1.05"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="label">Shape / Cut</label>
                                    <select name="gem_shape" className="input" value={gemData.gem_shape} onChange={handleGemInputChange}>
                                        <option value="">Select Shape</option>
                                        <option value="Round">Round</option>
                                        <option value="Oval">Oval</option>
                                        <option value="Cushion">Cushion</option>
                                        <option value="Emerald">Emerald</option>
                                        <option value="Princess">Princess</option>
                                        <option value="Pear">Pear</option>
                                        <option value="Marquise">Marquise</option>
                                        <option value="Heart">Heart</option>
                                        <option value="Radiant">Radiant</option>
                                        <option value="Asscher">Asscher</option>
                                        <option value="Trillion">Trillion</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="label">Dimensions (L x W x H)</label>
                                    <input
                                        name="gem_dimensions"
                                        className="input"
                                        value={gemData.gem_dimensions}
                                        onChange={handleGemInputChange}
                                        placeholder="e.g. 6.5 x 6.4 x 4.0 mm"
                                    />
                                </div>
                            </div>

                            <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="label">Color</label>
                                    <input
                                        name="gem_color"
                                        className="input"
                                        value={gemData.gem_color}
                                        onChange={handleGemInputChange}
                                        placeholder="e.g. Royal Blue"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="label">Clarity</label>
                                    <select name="gem_clarity" className="input" value={gemData.gem_clarity} onChange={handleGemInputChange}>
                                        <option value="">Select Clarity</option>
                                        <option value="FL">FL (Flawless)</option>
                                        <option value="IF">IF (Internally Flawless)</option>
                                        <option value="VVS1">VVS1</option>
                                        <option value="VVS2">VVS2</option>
                                        <option value="VS1">VS1</option>
                                        <option value="VS2">VS2</option>
                                        <option value="SI1">SI1</option>
                                        <option value="SI2">SI2</option>
                                        <option value="I1">I1 (Included)</option>
                                        <option value="Transparent">Transparent</option>
                                        <option value="Translucent">Translucent</option>
                                        <option value="Opaque">Opaque</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="label">Cut Grade</label>
                                    <select name="gem_cut_grade" className="input" value={gemData.gem_cut_grade} onChange={handleGemInputChange}>
                                        <option value="">Select Cut Grade</option>
                                        <option value="Excellent">Excellent</option>
                                        <option value="Very Good">Very Good</option>
                                        <option value="Good">Good</option>
                                        <option value="Fair">Fair</option>
                                        <option value="Poor">Poor</option>
                                    </select>
                                </div>
                            </div>

                            <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="label">Origin</label>
                                    <input
                                        name="gem_origin"
                                        className="input"
                                        value={gemData.gem_origin}
                                        onChange={handleGemInputChange}
                                        placeholder="e.g. Ceylon (Sri Lanka)"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="label">Treatment</label>
                                    <select name="gem_treatment" className="input" value={gemData.gem_treatment} onChange={handleGemInputChange}>
                                        <option value="">Select Treatment</option>
                                        <option value="None (Unheated)">None (Unheated)</option>
                                        <option value="Heated">Heated</option>
                                        <option value="Heated (Flux)">Heated (Flux)</option>
                                        <option value="Diffusion">Diffusion</option>
                                        <option value="Filled">Filled</option>
                                        <option value="Oiled">Oiled</option>
                                        <option value="Irradiated">Irradiated</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Info size={16} /> Certification Support
                                </h3>
                                <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label className="label">Lab / Provider</label>
                                        <select name="gem_certificate_provider" className="input" value={gemData.gem_certificate_provider} onChange={handleGemInputChange}>
                                            <option value="">Select Lab</option>
                                            <option value="GIA">GIA</option>
                                            <option value="GRS">GRS</option>
                                            <option value="Gubelin">Gubelin</option>
                                            <option value="SSEF">SSEF</option>
                                            <option value="AIGS">AIGS</option>
                                            <option value="Lotus">Lotus</option>
                                            <option value="EGL">EGL</option>
                                            <option value="IGA">IGA</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="label">Certificate Number</label>
                                        <input
                                            name="gem_certificate_number"
                                            className="input"
                                            value={gemData.gem_certificate_number}
                                            onChange={handleGemInputChange}
                                            placeholder="e.g. 1234567890"
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="label">Cert URL / ID</label>
                                        <input
                                            name="gem_certificate_url"
                                            className="input"
                                            value={gemData.gem_certificate_url}
                                            onChange={handleGemInputChange}
                                            placeholder="Online Link to Cert"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <Link href="/inventory-management?tab=products" className="btn btn-outline">Back to Inventory</Link>
                                <button type="submit" className="btn btn-primary">
                                    <Save size={20} />
                                    Update Gem Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
