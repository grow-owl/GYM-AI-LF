import PDFDocument from 'pdfkit';
import { cloudinaryUpload } from '../../config/cloudinary';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class PdfRendererService {
  /**
   * Render report data into a PDF Buffer
   */
  public static async renderReportToBuffer(
    title: string,
    period: { start: Date; end: Date },
    data: any
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        // Header
        doc.fontSize(20).text('Antigravity Gym SaaS Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).text(title, { align: 'center' });
        doc.moveDown(0.5);

        const startStr = period.start ? period.start.toISOString().split('T')[0] : 'N/A';
        const endStr = period.end ? period.end.toISOString().split('T')[0] : 'N/A';
        doc.fontSize(10).text(`Period: ${startStr} to ${endStr}`, { align: 'center' });
        doc.moveDown(1.5);

        // Body Content
        doc.fontSize(12).text('Report Details & Data Summary:', { underline: true });
        doc.moveDown(0.5);

        const jsonString = JSON.stringify(data, null, 2);
        // Print lines safely
        const lines = jsonString.split('\n');
        lines.slice(0, 100).forEach((line) => {
          doc.fontSize(9).text(line);
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Upload PDF Buffer to Cloudinary (or mock fallback) and return secure URL
   */
  public static async uploadPdfToCloudinary(
    pdfBuffer: Buffer,
    reportId: string
  ): Promise<string> {
    if (
      env.NODE_ENV !== 'test' &&
      env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_KEY !== 'dev_key' &&
      env.CLOUDINARY_API_SECRET
    ) {
      return new Promise((resolve) => {
        const uploadStream = cloudinaryUpload.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'gym_saas/reports',
            public_id: `report_${reportId}.pdf`,
          },
          (error: any, result: any) => {
            if (error || !result) {
              logger.warn(`Failed to upload PDF to Cloudinary (${error?.message}) — returning fallback URL`);
              return resolve(`https://res.cloudinary.com/mock-gym-saas/raw/upload/v1700000000/reports/report_${reportId}.pdf`);
            }
            resolve(result.secure_url);
          }
        );
        uploadStream.end(pdfBuffer);
      });
    } else {
      logger.info('☁️ Cloudinary test/mock mode — returning mock PDF URL');
      return `https://res.cloudinary.com/mock-gym-saas/raw/upload/v1700000000/reports/report_${reportId}.pdf`;
    }
  }

}
