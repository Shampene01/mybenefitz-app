import { collection, doc, setDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

const campaigns = [
  {
    id: 'credit-clinic',
    title: 'Credit Clinic – Just R99/month',
    subtitle: 'Guided credit rehabilitation to improve your credit health. Assess, determine, implement, and track your progress.',
    imageUrl: '',
    accentColor: '#10b981',
    ctaLabel: 'Start Now',
    ctaLink: '',
    ctaRoute: '/(tabs)/credit',
    isActive: true,
    priority: 1,
    createdAt: Timestamp.now(),
    updatedAt: '',
  },
  {
    id: 'funeral-cover',
    title: 'Funeral Cover from R10/month',
    subtitle: 'Protect your family with affordable funeral cover. Simple application, instant approval.',
    imageUrl: '',
    accentColor: '#8b5cf6',
    ctaLabel: 'Get Covered',
    ctaLink: '',
    ctaRoute: '/(tabs)/insurance',
    isActive: true,
    priority: 2,
    createdAt: Timestamp.now(),
    updatedAt: '',
  },
  {
    id: 'personal-loan',
    title: 'Need a Personal Loan?',
    subtitle: 'Apply for a personal loan with competitive rates. Quick approval, flexible repayment terms.',
    imageUrl: '',
    accentColor: '#3b82f6',
    ctaLabel: 'Apply Now',
    ctaLink: '',
    ctaRoute: '/(tabs)/loans',
    isActive: true,
    priority: 3,
    createdAt: Timestamp.now(),
    updatedAt: '',
  },
];

export async function seedMediaCampaigns() {
  try {
    const existing = await getDocs(query(collection(db, 'mediaCampaigns'), where('isActive', '==', true)));
    if (!existing.empty) {
      console.log('Campaigns already exist, skipping seed.');
      return false;
    }

    for (const campaign of campaigns) {
      const { id, ...data } = campaign;
      await setDoc(doc(db, 'mediaCampaigns', id), data);
    }
    console.log('Seeded', campaigns.length, 'campaigns successfully.');
    return true;
  } catch (error) {
    console.log('Error seeding campaigns:', error);
    return false;
  }
}
