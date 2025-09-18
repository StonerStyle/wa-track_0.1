import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { logger } from '../log';
import { updateWaSession } from '../supa';

export class WhatsAppClient {
  private socket: any = null;
  private qrCode: string | null = null;
  private isConnected: boolean = false;

  async start(): Promise<void> {
    try {
      logger.info('Starting WhatsApp client...');

      const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger as any,
      });

      this.socket.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCode = qr;
          logger.info('QR Code generated');
          // Update QR in database
          updateWaSession({ 
            status: 'connecting',
            detail: { qr: qr }
          });
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          
          if (shouldReconnect) {
            logger.info('Connection closed, reconnecting...');
            this.start();
          } else {
            logger.info('Connection closed, not reconnecting');
          }
        } else if (connection === 'open') {
          logger.info('WhatsApp connected successfully');
          this.isConnected = true;
          this.qrCode = null;
          updateWaSession({ 
            status: 'connected',
            detail: null
          });
        }
      });

      this.socket.ev.on('creds.update', saveCreds);

      // Handle messages
      this.socket.ev.on('messages.upsert', async (m: any) => {
        logger.info('New message received:', m);
        // TODO: Process messages and save to database
      });

    } catch (error) {
      logger.error('Error starting WhatsApp client:', error);
      throw error;
    }
  }

  getQRCode(): string | null {
    return this.qrCode;
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  async stop(): Promise<void> {
    if (this.socket) {
      await this.socket.logout();
      this.socket = null;
    }
  }
}