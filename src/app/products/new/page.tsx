'use client';

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */
import { createProduct } from '@/app/actions/products';
import { getCategories, Category } from '@/app/actions/categories';
import { generateProductImage } from '@/app/actions/ai';
import { uploadProductImage } from '@/app/actions/upload';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save, Info, Sparkles, Image as ImageIcon, Trash2, Diamond } from 'lucide-react';
import Link from 'next/link';

export default function NewProductPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const submittedRef = useRef(false); // prevent double submission
    const [activeTab, setActiveTab] = useState<'general' | 'gem_details'>('general');
    const [categories, setCategories] = useState<Category[]>([]);
    const [saving, setSaving] = useState(false);
    const [generatingImage, setGeneratingImage] = useState(false);

    // Form state for general info
    const [formData, setFormData] = useState({
        name: '',
        barcode: '',
        category_id: '',
        stock: '0',
        cost_price: '',
        selling_price: '',
        reorder_level: '5',
        notes: '',
        image_url: '',
        pricing_method: 'per_piece' as 'per_piece' | 'per_carat',
        type: 'single' as 'single' | 'lot'
    });

    // Form state for Gemstone Details
    const [gemData, setGemData] = useState({
        gem_carat_weight: '',
        gem_dimensions: '',
        gem_shape: '',
        gem_color: '',
        gem_clarity: '',
        gem_cut_grade: '',
        gem_origin: '',
        gem_treatment: '',
        gem_certificate_provider: '',
        gem_certificate_number: '',
        gem_certificate_url: '',
        price_per_carat: '' // Helper field for calculation
    });

    useEffect(() => {
        getCategories().then(res => setCategories(res.data));
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGemInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setGemData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-calculate Total Price if Pricing Method is Per Carat
            if (formData.pricing_method === 'per_carat') {
                if (name === 'gem_carat_weight' || name === 'price_per_carat') {
                    const weight = parseFloat(name === 'gem_carat_weight' ? value : prev.gem_carat_weight) || 0;
                    const perCarat = parseFloat(name === 'price_per_carat' ? value : prev.price_per_carat) || 0;
                    if (weight > 0 && perCarat > 0) {
                        setFormData(fd => ({ ...fd, selling_price: (weight * perCarat).toFixed(2) }));
                    }
                }
            }
            return newData;
        });
    };

    // Effect to update price when switching pricing method
    useEffect(() => {
        if (formData.pricing_method === 'per_carat') {
            const weight = parseFloat(gemData.gem_carat_weight) || 0;
            const perCarat = parseFloat(gemData.price_per_carat) || 0;
            if (weight > 0 && perCarat > 0) {
                setFormData(prev => ({ ...prev, selling_price: (weight * perCarat).toFixed(2) }));
            }
        }
    }, [formData.pricing_method, gemData.gem_carat_weight, gemData.price_per_carat]);

    async function handleGenerateAIImage() {
        if (!formData.name) return toast.error("Enter product name first");
        const category = categories.find(c => String(c.id) === formData.category_id)?.name || '';

        setGeneratingImage(true);
        const res = await generateProductImage(formData.name, category);
        setGeneratingImage(false);

        if (res.success && res.imageUrl) {
            setFormData(prev => ({ ...prev, image_url: res.imageUrl! }));
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
            setFormData(prev => ({ ...prev, image_url: res.imageUrl! }));
            toast.success("Image uploaded successfully");
        } else {
            toast.error(res.error || "Failed to upload image");
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name) {
            toast.error('Product name is required');
            setActiveTab('general');
            return;
        }

        // Prevent double submission
        if (submittedRef.current || saving) return;
        submittedRef.current = true;

        setSaving(true);
        const submitData = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            submitData.append(key, value);
        });

        // Append Gem Details
        Object.entries(gemData).forEach(([key, value]) => {
            submitData.append(key, value);
        });

        const result = await createProduct(submitData);
        setSaving(false);

        if (result.success) {
            toast.success('Product created successfully');
            router.replace('/inventory-management?tab=products');
        } else {
            submittedRef.current = false; // allow retry on error
            toast.error(result.error || 'Failed to create product');
        }
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/inventory-management" className="btn btn-outline" style={{ padding: '0.5rem' }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Add Product</h1>
                        <p style={{ color: 'var(--muted)' }}>Create a new product in inventory</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link href="/inventory-management" className="btn btn-outline">Cancel</Link>
                    <button onClick={handleSubmit} disabled={saving} className="btn btn-primary" style={{ padding: '0 2rem', height: '3rem' }}>
                        <Save size={20} /> {saving ? 'Saving...' : 'Save Product'}
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => setActiveTab('general')}
                    className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1, display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                >
                    <Info size={18} /> General Info
                </button>
                <button
                    onClick={() => setActiveTab('gem_details')}
                    className={`btn ${activeTab === 'gem_details' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1, display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                >
                    <Diamond size={18} /> Gemstone Details
                </button>
            </div>

            <div className="card" style={{ padding: '2rem' }}>
                {activeTab === 'general' && (
                    <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label">Product Name</label>
                                <input
                                    name="name"
                                    type="text"
                                    className="input"
                                    required
                                    placeholder="e.g. 2.5ct Royal Blue Sapphire"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label">Barcode (SKU)</label>
                                <input
                                    name="barcode"
                                    type="text"
                                    className="input"
                                    placeholder="Scan or enter barcode"
                                    value={formData.barcode}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label">Category</label>
                                <select name="category_id" className="input" value={formData.category_id} onChange={handleInputChange}>
                                    <option value="">Select Category</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label">Pricing Method</label>
                                <select name="pricing_method" className="input" value={formData.pricing_method} onChange={handleInputChange}>
                                    <option value="per_piece">Per Piece / Fixed Price</option>
                                    <option value="per_carat">Per Carat (Weight Based)</option>
                                </select>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label">Product Type</label>
                                <select name="type" className="input" value={formData.type} onChange={handleInputChange}>
                                    <option value="single">Single Item</option>
                                    <option value="lot">Lot / Parcel</option>
                                    <option value="jewelry">Jewelry Piece</option>
                                </select>
                            </div>
                        </div>

                        {formData.pricing_method === 'per_carat' && (
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
                                            value={formData.selling_price}
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
                                <input
                                    name="cost_price"
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    placeholder="0.00"
                                    value={formData.cost_price}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label">Selling Price (Total)</label>
                                <input
                                    name="selling_price"
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    placeholder="0.00"
                                    value={formData.selling_price}
                                    onChange={handleInputChange}
                                    readOnly={formData.pricing_method === 'per_carat'}
                                />
                            </div>
                        </div>

                        <div className="row" style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label">Stock Quantity</label>
                                <input
                                    name="stock"
                                    type="number"
                                    className="input"
                                    value={formData.stock}
                                    onChange={handleInputChange}
                                    min="0"
                                />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label className="label">Reorder Level</label>
                                <input
                                    name="reorder_level"
                                    type="number"
                                    className="input"
                                    value={formData.reorder_level}
                                    onChange={handleInputChange}
                                    min="0"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="label">Notes</label>
                            <textarea
                                name="notes"
                                className="input"
                                rows={3}
                                placeholder="Optional notes..."
                                value={formData.notes}
                                onChange={handleInputChange}
                            ></textarea>
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
                                    {formData.image_url ? (
                                        <>
                                            <img
                                                src={formData.image_url.startsWith('/') ? formData.image_url : `/${formData.image_url}`}
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
                                                onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
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
                                            value={formData.image_url}
                                            onChange={handleInputChange}
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
                    </form>
                )}

                {activeTab === 'gem_details' && (
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
                    </div>
                )}

            </div>
        </div >
    );
}
