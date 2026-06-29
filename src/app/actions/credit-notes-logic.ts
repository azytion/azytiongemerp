
export type CreditNoteData = {
    number: string;
    type: 'sales_return' | 'purchase_return';
    refId: number;
    refType: 'sale' | 'purchase_order' | 'purchase';
    amount: number;
    reason: string;
    userId: number;
    returnItems?: Array<{ product_id: number; quantity: number; price: number; product_name?: string }>;
};

export async function recordCreditNoteSync(db: any, data: CreditNoteData) {
    return await db.prepare(`
        INSERT INTO credit_notes 
        (credit_note_number, type, reference_invoice_id, reference_type, amount, reason, status, user_id, return_items)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(data.number, data.type, data.refId, data.refType, data.amount, data.reason, data.userId,
        data.returnItems ? JSON.stringify(data.returnItems) : null);
}
