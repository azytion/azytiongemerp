'use server';

import { requireSession } from './authz';
import { nowLocalISO } from '@/lib/datetime';

import { logDaybookEntry } from './daybook';
import { logActivity } from './activity-logger';
import { postComplexSaleToJournal } from './ledger';
import { getSession } from './auth';
import { getDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { recordCreditNoteSync } from './credit-notes-logic';

export async function processRefund(originalSaleId: number, itemsToReturn: { productId: number, quantity: number }[]) {
    await requireSession();
    const db = await getDb();
    const session = await getSession();
    const userId = session?.sub ? Number(session.sub) : 1;

    if (!itemsToReturn.length) {
        return { success: false, error: 'No items to return' };
    }

    try {
        let resultData: any = {};

        const transaction = db.transaction(async () => {
            const originalSale = await db.prepare('SELECT * FROM sales WHERE id = ?').get(originalSaleId) as any;
            if (!originalSale) throw new Error('Sale not found');

            let refundTotal = 0;
            const refundItemsData = [];

            for (const item of itemsToReturn) {
                const originalItem = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND product_id = ? AND variant_id IS NULL').get(originalSaleId, item.productId) as any;

                if (!originalItem) throw new Error(`Product ${item.productId} not found in original sale`);

                const itemTotal = originalItem.price * item.quantity;
                refundTotal += itemTotal;

                refundItemsData.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: originalItem.price
                });
            }

            const invoiceNumber = `RET-${Date.now()}`;
            const refundRes = await db.prepare(`
                INSERT INTO sales (invoice_number, customer_id, total_amount, received_cash, balance_to_return, payment_method, type, status, date, user_id)
                VALUES (@invoice, @customerId, @total, @received, 0, 'Cash', 'return', 'completed', @date, @userId)
            `).run({
                invoice: invoiceNumber,
                customerId: originalSale.customer_id,
                total: -refundTotal,
                received: -refundTotal,
                date: nowLocalISO(),
                userId: userId
            });

            const refundId = refundRes.lastInsertRowid;
            resultData = { refundId, invoiceNumber, refundTotal };

            const insertItem = await db.prepare(`
                INSERT INTO sale_items (sale_id, product_id, variant_id, quantity, price)
                VALUES (@saleId, @productId, NULL, @quantity, @price)
            `);

            const updateProductStock = await db.prepare(`UPDATE products SET stock = stock + @quantity WHERE id = @id`);

            for (const item of refundItemsData) {
                await insertItem.run({
                    saleId: refundId,
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price
                });

                await updateProductStock.run({
                    quantity: item.quantity,
                    id: item.productId
                });
            }

            const creditNoteNumber = `CN-SR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            await recordCreditNoteSync(db, {
                number: creditNoteNumber,
                type: 'sales_return',
                refId: originalSaleId,
                refType: 'sale',
                amount: refundTotal,
                reason: 'Customer Return',
                userId: userId
            });
        });

        await transaction();

        // 7. Log to Daybook (recorded as a negative sale movement)
        await logDaybookEntry('refund', -resultData.refundTotal, 'sale', Number(resultData.refundId), `Refund for ${resultData.invoiceNumber}`, userId);

        // 8. Post to Journal
        await postComplexSaleToJournal(Number(resultData.refundId), -resultData.refundTotal, -resultData.refundTotal, 'Cash');

        // 9. Log Activity
        await logActivity(userId, 'CREATE', 'refund', Number(resultData.refundId), null, { invoice: resultData.invoiceNumber, amount: resultData.refundTotal });

        revalidatePath('/sales');
        revalidatePath('/dashboard');
        revalidatePath('/finance');
        revalidatePath('/reports');
        return { success: true };
    } catch (error: any) {
        console.error('Refund failed:', error);
        return { success: false, error: error.message || 'Refund failed' };
    }
}

