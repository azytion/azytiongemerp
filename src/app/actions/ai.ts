'use server';


import { requireSession } from './authz';
import { getDb } from '@/lib/db';
import { geminiModel } from '@/lib/gemini';
import { startOfDay, endOfDay, format } from 'date-fns';
import { saveAIImageLocally } from './upload';

export async function askZationAI(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) {
    await requireSession();
    const db = await getDb();
    const now = new Date();
    const todayStart = format(startOfDay(now), 'yyyy-MM-dd HH:mm:ss');
    const todayEnd = format(endOfDay(now), 'yyyy-MM-dd HH:mm:ss');

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: "Gemini API Key is missing. Please add GOOGLE_GENERATIVE_AI_API_KEY to your .env file and restart the server."
        };
    }

    // --- DATA RETRIEVAL (CONTEXT) ---
    // We fetch key business metrics to provide as context to the AI
    let context = "";

    try {
        // 1. Today's Summary
        const todaySales = await db.prepare(`SELECT SUM(total_amount) as total FROM sales WHERE date BETWEEN ? AND ? AND status = 'completed'`).get(todayStart, todayEnd) as { total: number };
        const todayCount = await db.prepare(`SELECT COUNT(*) as count FROM sales WHERE date BETWEEN ? AND ? AND status = 'completed'`).get(todayStart, todayEnd) as { count: number };

        context += `\n[TODAY'S PERF]: Total Revenue: ${todaySales.total || 0}, Total Sales: ${todayCount.count || 0}.`;

        // 2. Low Stock Alert
        const lowStock = await db.prepare(`SELECT name, stock, reorder_level FROM products WHERE stock <= reorder_level LIMIT 5`).all() as any[];
        if (lowStock.length > 0) {
            context += `\n[LOW STOCK]: ${lowStock.map(p => `${p.name} (${p.stock} left)`).join(', ')}.`;
        }

        // 3. Top Selling Products (Last 30 Days)
        const topSelling = await db.prepare(`
            SELECT p.name, SUM(si.quantity) as qty
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY p.id
            ORDER BY qty DESC
            LIMIT 3
        `).all() as any[];
        if (topSelling.length > 0) {
            context += `\n[TRENDING]: ${topSelling.map(p => `${p.name} (${p.qty} sold)`).join(', ')}.`;
        }

        // 4. Financial Health (General)
        const totalCash = await db.prepare(`SELECT SUM(balance) as total FROM payment_accounts`).get() as { total: number };
        context += `\n[FINANCE]: Total Cash in Accounts: ${totalCash.total || 0}.`;

    } catch (e) {
        console.error("AI Context Fetch Error:", e);
    }

    // --- AI PROCESSING ---
    try {
        const sysInstructions = `You are ZATION GemERP, the integrated smart assistant for ZATION GemERP. 
            You have access to the store's database via natural language queries. 
            Use the provided context to answer specifically. Be professional and concise.`;

        // Prepare the history: if empty, start with system instructions as a model message (or user, but let's try prepending instructions to the prompt)
        const validatedHistory = history.length > 0 && history[0].role === 'model'
            ? history.slice(1)
            : history;

        const chat = geminiModel.startChat({
            history: validatedHistory,
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        const prompt = `SYSTEM INSTRUCTIONS: ${sysInstructions}\n\nCURRENT BUSINESS CONTEXT:${context}\n\nUSER MESSAGE: ${message}`;
        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        const text = response.text();

        return { success: true, text: text };
    } catch (error: any) {
        console.error('ZATION AI Error:', error);
        // Never expose API keys or internal details in error responses
        return {
            success: false,
            error: 'AI service unavailable. Please check your API key configuration.',
        };
    }
}

export async function getDetailedBusinessReport() {
    await requireSession();
    const db = await getDb();

    // Aggregated data for the last 90 days for trend analysis
    const salesHistory = await db.prepare(`
        SELECT 
            DATE_FORMAT(date, '%Y-%u') as week,
            SUM(total_amount) as revenue,
            COUNT(*) as orders
        FROM sales
        WHERE date >= DATE_SUB(NOW(), INTERVAL 90 DAY) AND status = 'completed'
        GROUP BY week
        ORDER BY week ASC
    `).all();

    const topProducts = await db.prepare(`
        SELECT p.name, SUM(si.quantity) as total_qty, CAST(SUM(si.quantity) AS DECIMAL(10,2)) / 30.0 as daily_velocity
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY p.id
        ORDER BY total_qty DESC
        LIMIT 10
    `).all();

    const inventoryStatus = await db.prepare(`
        SELECT 
            p.id, p.name, p.stock, p.reorder_level, p.selling_price, p.cost_price,
            (SELECT CAST(SUM(si.quantity) AS DECIMAL(10,2)) / 30.0 FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.product_id = p.id AND s.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as velocity
        FROM products p
        ORDER BY p.stock ASC
        LIMIT 20
    `).all();

    return {
        salesHistory,
        topProducts,
        inventoryStatus,
        generatedAt: new Date().toISOString()
    };
}

export async function getSmartReorderSuggestions() {
    await requireSession();
    const report = await getDetailedBusinessReport();
    const suggestions = report.inventoryStatus
        .filter((p: any) => p.stock <= p.reorder_level || (p.velocity > 0 && p.stock < p.velocity * 14)) // Low stock or less than 14 days of runway
        .map((p: any) => {
            const dailyVelocity = p.velocity || 0;
            const runwayDays = dailyVelocity > 0 ? p.stock / dailyVelocity : Infinity;

            // Suggest ordering enough for 30 days of sales, plus reorder level buffer
            const suggestedQty = Math.ceil((dailyVelocity * 30) + p.reorder_level - p.stock);

            return {
                id: p.id,
                name: p.name,
                stock: p.stock,
                velocity: dailyVelocity.toFixed(2),
                runway: runwayDays === Infinity ? 'N/A' : Math.floor(runwayDays),
                suggestion: Math.max(suggestedQty, 10) // Minimum 10 units
            };
        });

    return suggestions;
}

export async function getDailyPulse() {
    await requireSession();
    if (!((process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) || process.env.GEMINI_API_KEY)) {
        return { success: false, error: "AI API Key missing" };
    }

    const db = await getDb();
    const today = format(new Date(), 'yyyy-MM-dd');

    const stats = await db.prepare(`
        SELECT 
            (SELECT SUM(total_amount) FROM sales WHERE date(date) = ? AND status = 'completed') as revenue,
            (SELECT COUNT(*) FROM sales WHERE date(date) = ? AND status = 'completed') as count,
            (SELECT p.name FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id WHERE date(s.date) = ? GROUP BY si.product_id ORDER BY SUM(si.quantity) DESC LIMIT 1) as top_product
    `).get(today, today, today) as any;

    const prompt = `
        Summarize today's business performance in exactly 3 short, professional sentences.
        Total Revenue: ${stats.revenue || 0}, Total Sales: ${stats.count || 0}, Top Product: ${stats.top_product || 'None'}.
        Mention if the revenue is healthy (average is usually 500) and if the top product is a recurring trend.
    `;

    try {
        const result = await geminiModel.generateContent(prompt);
        return { success: true, text: result.response.text() };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getForecastingInsights(userInput: string) {
    await requireSession();
    if (!((process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) || process.env.GEMINI_API_KEY)) {
        return { success: false, error: "AI API Key missing" };
    }

    const report = await getDetailedBusinessReport();

    const prompt = `
        You are ZATION GemERP Analyst. Analyze the following 90-day business data and answer the user's specific forecasting or reordering question.
        
        DATA:
        - Weekly Sales (Last 90 days): ${JSON.stringify(report.salesHistory)}
        - Top 10 Products (Last 30 days): ${JSON.stringify(report.topProducts)}
        - Inventory Status (Lowest 20 items): ${JSON.stringify(report.inventoryStatus)}
        
        USER QUESTION: ${userInput}
        
        Provide:
        1. **Direct Answer** to the question.
        2. **Forecasting Logic**: Brief explanation based on moving averages or trends in the data.
        3. **Actionable Suggestions**: Specific quantities or dates if applicable.
        
        Format in clean Markdown.
    `;

    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text();
        return { success: true, text };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function detectAnomalies() {
    await requireSession();
    const db = await getDb();

    // Fetch suspicious activities: 
    // 1. Unusually high discounts (e.g. > 50%)
    // 2. Voids/Refunds in high frequency
    // 3. Price overrides (if we had them tracked specifically, for now let's check high discounts)

    const highDiscounts = await db.prepare(`
        SELECT s.invoice_number, s.total_amount, p.name, si.discount, s.date
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE si.discount > (si.price * 0.5)
        ORDER BY s.date DESC
        LIMIT 10
    `).all();

    const prompt = `
        Analyze these potential anomalies in POS data:
        ${JSON.stringify(highDiscounts)}
        
        Tell me if any of these look suspicious or are likely data entry errors. Be critical and protective of business revenue.
    `;

    try {
        const result = await geminiModel.generateContent(prompt);
        return { success: true, text: result.response.text() };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function generateProductImage(name: string, category: string) {
    await requireSession();
    if (!name) return { success: false, error: 'Product name required' };

    try {
        let imagePrompt = `${name} gemstone, professional studio photography, soft gray background, sharp detail, commercial product photo`;

        // Try to enhance the prompt with Gemini if API key is available
        if (((process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) || process.env.GEMINI_API_KEY)) {
            try {
                const promptGen = `Generate a 1-sentence hyper-realistic professional studio product photography prompt for: ${name} (${category}). Use a soft gray or neutral studio backdrop. Focus on sharp detail and commercial appeal. No extra text.`;
                const result = await geminiModel.generateContent(promptGen);
                const aiPrompt = result.response.text().trim();
                if (aiPrompt) imagePrompt = aiPrompt;
            } catch (e) {
                // Gemini prompt enhancement failed ? use fallback prompt
                console.warn('Gemini prompt enhancement failed, using fallback:', e);
            }
        }

        const encodedPrompt = encodeURIComponent(imagePrompt);
        const seed = Math.floor(Math.random() * 100000);
        const externalUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${seed}`;

        const localSave = await saveAIImageLocally(externalUrl);
        if (localSave.success) {
            return { success: true, imageUrl: localSave.imageUrl };
        }
        return { success: true, imageUrl: externalUrl };
    } catch (error: any) {
        console.error('Image Gen Error:', error);
        return { success: false, error: 'Failed to generate image: ' + (error.message || 'Unknown error') };
    }
}





