import { AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { supabase } from '../supa';
import { logger } from '../log';

export class SupabaseStateStore {
  async getState(): Promise<AuthenticationState> {
    try {
      const { data, error } = await supabase
        .from('wa_sessions')
        .select('auth_state')
        .limit(1)
        .single();

      if (error) {
        logger.error('Failed to get auth state:', error);
        return { creds: {} as any, keys: {} as any };
      }

      return data?.auth_state || { creds: {} as any, keys: {} as any };
    } catch (error) {
      logger.error('Error getting auth state:', error);
      return { creds: {} as any, keys: {} as any };
    }
  }

  async saveState(state: AuthenticationState): Promise<void> {
    try {
      const { error } = await supabase
        .from('wa_sessions')
        .upsert({ auth_state: state });

      if (error) {
        logger.error('Failed to save auth state:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error saving auth state:', error);
      throw error;
    }
  }

  async getCreds(): Promise<any> {
    const state = await this.getState();
    return state.creds || {};
  }

  async saveCreds(creds: any): Promise<void> {
    const state = await this.getState();
    state.creds = creds;
    await this.saveState(state);
  }

  async getKeys(): Promise<any> {
    const state = await this.getState();
    return state.keys || {};
  }

  async saveKeys(keys: any): Promise<void> {
    const state = await this.getState();
    state.keys = keys;
    await this.saveState(state);
  }
}