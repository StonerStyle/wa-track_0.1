import { AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { supabase, updateWaSession, logAudit } from '../supa.js';
import { logger } from '../log.js';

export class SupabaseAuthState {
  private creds: SignalDataTypeMap['creds'] | undefined;
  private keys: SignalDataTypeMap['keys'] | undefined;

  constructor() {
    this.creds = undefined;
    this.keys = undefined;
  }

  async load(): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    try {
      // Load from Supabase
      const { data: session, error } = await supabase
        .from('wa_sessions')
        .select('creds_json, keys_json')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to load auth state: ${error.message}`);
      }

      if (session) {
        this.creds = session.creds_json;
        this.keys = session.keys_json;
      }

      logger.info('Loaded auth state from Supabase');

      return {
        state: {
          creds: this.creds,
          keys: this.keys
        },
        saveCreds: this.saveCreds.bind(this)
      };
    } catch (error) {
      logger.error('Failed to load auth state:', error);
      throw error;
    }
  }

  private async saveCreds(): Promise<void> {
    try {
      await updateWaSession({
        creds_json: this.creds,
        keys_json: this.keys
      });

      logger.debug('Saved auth state to Supabase');
    } catch (error) {
      logger.error('Failed to save auth state:', error);
      throw error;
    }
  }

  async saveCreds(creds: SignalDataTypeMap['creds']): Promise<void> {
    this.creds = creds;
    await this.saveCreds();
  }

  async saveKeys(keys: SignalDataTypeMap['keys']): Promise<void> {
    this.keys = keys;
    await this.saveCreds();
  }

  async clear(): Promise<void> {
    this.creds = undefined;
    this.keys = undefined;
    
    await updateWaSession({
      creds_json: null,
      keys_json: null
    });

    await logAudit('auth_cleared', {});
    logger.info('Cleared auth state');
  }
}
