import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface QRPayload {
  memberId: string;
  gymId: string;
  branchId?: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  nonce?: string;
  iat?: number;
}

/**
 * Generate signed JWT token and Base64 Data URL for a member's check-in QR code
 */
export const generateQRPayload = async (
  payload: QRPayload
): Promise<{ token: string; dataUrl: string }> => {
  try {
    const signedPayload = {
      ...payload,
      nonce: uuidv4(), // Ensures cryptographic uniqueness on every generation
    };

    const token = jwt.sign(signedPayload, env.JWT_QR_SECRET, {
      expiresIn: '5m', // Short TTL for dynamic security QR codes
    });

    const dataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 300,
    });

    return { token, dataUrl };
  } catch (error) {
    logger.error(`Failed to generate QR Code Payload: ${error}`);
    throw error;
  }
};

/**
 * Verify and decode member QR token
 */
export const verifyQRPayload = (qrToken: string): QRPayload => {
  return jwt.verify(qrToken, env.JWT_QR_SECRET) as QRPayload;
};
