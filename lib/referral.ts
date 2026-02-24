import AsyncStorage from '@react-native-async-storage/async-storage';

const REFERRAL_STORAGE_KEY = 'mbz_referral_code';

export async function storeReferralCode(code?: string | null) {
  if (!code) return;
  try {
    await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch (err) {
    console.warn('[Referral] Failed to store referral code', err);
  }
}

export async function consumeReferralCode(): Promise<string> {
  try {
    const code = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
    if (code) {
      await AsyncStorage.removeItem(REFERRAL_STORAGE_KEY);
      return code;
    }
    return '';
  } catch (err) {
    console.warn('[Referral] Failed to read referral code', err);
    return '';
  }
}
