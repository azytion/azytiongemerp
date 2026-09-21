
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { sendEmail } from '@/app/actions/email';

export async function sendPDFEmail(
    doc: jsPDF,
    recipientEmail: string,
    subject: string,
    message: string,
    filename: string,
    companyName?: string
) {
    try {
        // Convert to base64
        // Convert to base64 directly
        // doc.output('datauristring') returns "data:application/pdf;filename=generated.pdf;base64,JVBERi0..."
        const dataUri = doc.output('datauristring');
        const base64 = dataUri.split(',')[1];

        // Use server action to send
        const result = await sendEmail(
            recipientEmail,
            subject,
            `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Document Attached</h2>
                <p>${message}</p>
                <hr />
                <p style="font-size: 12px; color: #666;">
                    Sent from <strong>${companyName || 'Azytion GemERP'}</strong>
                </p>
            </div>
            `,
            [{ filename, content: base64, encoding: 'base64' }]
        );

        if (result.success) {
            toast.success('Email sent successfully');
            return true;
        } else {
            toast.error(result.error || 'Failed to send email');
            return false;
        }
    } catch (error) {
        console.error('Email PDF error:', error);
        toast.error('Error preparing email: ' + (error instanceof Error ? error.message : String(error)));
        return false;
    }
}
