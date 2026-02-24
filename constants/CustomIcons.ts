/**
 * Custom icon mapping for the home screen.
 *
 * Place your PNG icons (with @2x / @3x variants) in assets/icons/.
 * Expected files per icon:
 *   assets/icons/active-products.png      (256×256)
 *   assets/icons/active-products@2x.png   (512×512)
 *   assets/icons/active-products@3x.png   (768×768)
 *
 * React Native automatically picks the right resolution.
 * Only the base name (without @2x/@3x) is referenced below.
 *
 * When an icon file is ready, uncomment its `image` line.
 */

import { ImageSourcePropType } from 'react-native';

export interface CustomIcon {
  key: string;
  label: string;
  image?: ImageSourcePropType;
  fallbackIonicon: string;
  color: string;
}

// ── Stat bar icons (top of home screen) ──────────────────────────
export const STAT_ICONS: Record<string, CustomIcon> = {
  activeProducts: {
    key: 'activeProducts',
    label: 'Active Products',
    // image: require('../assets/icons/active-products.png'),
    fallbackIonicon: 'briefcase',
    color: '#0078D4',
  },
  creditScore: {
    key: 'creditScore',
    label: 'Credit Score',
    // image: require('../assets/icons/credit-score.png'),
    fallbackIonicon: 'card',
    color: '#10B981',
  },
  policies: {
    key: 'policies',
    label: 'Policies',
    // image: require('../assets/icons/policies.png'),
    fallbackIonicon: 'shield-checkmark',
    color: '#7C3AED',
  },
};

// ── Quick-action icons (grid below stats) ────────────────────────
export const ACTION_ICONS: Record<string, CustomIcon> = {
  creditRepair: {
    key: 'creditRepair',
    label: 'Credit Repair',
    // image: require('../assets/icons/credit-repair.png'),
    fallbackIonicon: 'card',
    color: '#0891B2',
  },
  getInsurance: {
    key: 'getInsurance',
    label: 'Get Insurance',
    // image: require('../assets/icons/get-insurance.png'),
    fallbackIonicon: 'shield-checkmark',
    color: '#4F46E5',
  },
  applyForLoan: {
    key: 'applyForLoan',
    label: 'Apply for Loan',
    // image: require('../assets/icons/apply-for-loan.png'),
    fallbackIonicon: 'wallet',
    color: '#EA580C',
  },
  myProfile: {
    key: 'myProfile',
    label: 'My Profile',
    // image: require('../assets/icons/my-profile.png'),
    fallbackIonicon: 'person',
    color: '#475569',
  },
};
