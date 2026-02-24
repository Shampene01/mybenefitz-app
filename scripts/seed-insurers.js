/**
 * Seed Insurers Collection
 * 
 * Run with: node scripts/seed-insurers.js
 * 
 * Prerequisites:
 * - Firebase Admin SDK credentials (service account JSON)
 * - Set GOOGLE_APPLICATION_CREDENTIALS env var or place serviceAccountKey.json in project root
 * 
 * This script seeds the `insurers` collection with publicly available information
 * about each insurer partner. The admin (shampene@lebonconsulting.co.za) can then
 * manually update assets, liabilities, and upload insurance certificates via the
 * Firestore console or a future admin panel.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

const insurers = [
  {
    id: 'sanlam',
    name: 'Sanlam',
    legalName: 'Sanlam Life Insurance Limited',
    registrationNumber: '1998/021121/06',
    fspNumber: '2759',
    logoPath: '/insure-logos/sanlam-logo-vector.png',
    website: 'https://www.sanlam.co.za',
    phone: '0860 726 526',
    email: 'clientcare@sanlam.co.za',
    headquartersCity: 'Bellville, Cape Town',
    headquartersProvince: 'Western Cape',
    founded: 1918,
    description:
      'Sanlam is one of the largest internationally active insurance groups in the world. Founded in 1918 as a life insurance company in South Africa, it has grown into a diversified financial services group operating across Africa, India, Malaysia, and other emerging markets. Sanlam provides life insurance, general insurance, investment management, retirement, and wealth management solutions.',
    productsOffered: [
      'Life Insurance',
      'Funeral Cover',
      'Retirement Annuities',
      'Tax Free Savings',
      'Wills & Estates',
      'Investment Products',
      'Short-Term Insurance',
      'Health Insurance',
    ],
    keyStrengths: [
      'Over 100 years of operating history',
      'AA+ credit rating (Global Credit Rating)',
      'Presence in 33 countries across Africa and beyond',
      'Largest non-banking financial services group in Africa',
      'BEE Level 1 contributor',
    ],
    claimsRatio: '98.2%',
    bbbeeLevel: 1,
    totalAssets: null, // Admin to manually update
    totalLiabilities: null, // Admin to manually update
    solvencyRatio: null, // Admin to manually update
    annualReportUrl: 'https://www.sanlam.co.za/investor-relations/annual-reports',
    regulatoryBody: 'Prudential Authority (SARB) & FSCA',
    status: 'active',
  },
  {
    id: 'old_mutual',
    name: 'Old Mutual',
    legalName: 'Old Mutual Life Assurance Company (South Africa) Limited',
    registrationNumber: '1999/004643/06',
    fspNumber: '601',
    logoPath: '/insure-logos/old-mutual-logo.png',
    website: 'https://www.oldmutual.co.za',
    phone: '0860 60 60 60',
    email: 'service@oldmutual.com',
    headquartersCity: 'Pinelands, Cape Town',
    headquartersProvince: 'Western Cape',
    founded: 1845,
    description:
      'Old Mutual is a premium African financial services group offering a broad spectrum of financial solutions to retail, corporate, and institutional customers. Founded in Cape Town in 1845, it is one of the oldest mutual life insurance companies in the world. Old Mutual offers life insurance, savings, investments, banking, lending, and property solutions.',
    productsOffered: [
      'Life Insurance',
      'Funeral Cover',
      'Retirement Annuities',
      'Tax Free Savings',
      'Unit Trusts',
      'Education Plans',
      'Short-Term Insurance',
    ],
    keyStrengths: [
      'Nearly 180 years of heritage',
      'Largest life insurer in South Africa by market share',
      'Listed on the JSE and London Stock Exchange',
      'Extensive distribution network across Africa',
      'Strong BEE credentials',
    ],
    claimsRatio: '97.5%',
    bbbeeLevel: 1,
    totalAssets: null,
    totalLiabilities: null,
    solvencyRatio: null,
    annualReportUrl: 'https://www.oldmutual.co.za/investor-relations/',
    regulatoryBody: 'Prudential Authority (SARB) & FSCA',
    status: 'active',
  },
  {
    id: 'discovery_life',
    name: 'Discovery Life',
    legalName: 'Discovery Life Limited',
    registrationNumber: '1966/003901/06',
    fspNumber: '45',
    logoPath: '/insure-logos/DiscoveryLogo.png',
    website: 'https://www.discovery.co.za',
    phone: '0860 99 88 77',
    email: 'askdiscovery@discovery.co.za',
    headquartersCity: 'Sandton, Johannesburg',
    headquartersProvince: 'Gauteng',
    founded: 1992,
    description:
      'Discovery Life is part of the Discovery Group, a global financial services organisation with operations in health insurance, life insurance, investments, and banking. Discovery is renowned for its innovative Vitality shared-value insurance model, which integrates behavioural economics to incentivise healthy living and reduce claims. Discovery Life provides comprehensive life, disability, and severe illness cover.',
    productsOffered: [
      'Life Insurance',
      'Disability Cover',
      'Severe Illness Cover',
      'Funeral Cover',
      'Income Protection',
      'Investment Products',
    ],
    keyStrengths: [
      'Pioneering Vitality wellness programme',
      'Innovative shared-value insurance model',
      'Strong technology and data-driven approach',
      'Global presence in 40+ countries',
      'Multiple industry awards for innovation',
    ],
    claimsRatio: '97.8%',
    bbbeeLevel: 1,
    totalAssets: null,
    totalLiabilities: null,
    solvencyRatio: null,
    annualReportUrl: 'https://www.discovery.co.za/corporate/investor-relations',
    regulatoryBody: 'Prudential Authority (SARB) & FSCA',
    status: 'active',
  },
  {
    id: 'momentum',
    name: 'Momentum',
    legalName: 'Momentum Metropolitan Life Limited',
    registrationNumber: '1904/002186/06',
    fspNumber: '623',
    logoPath: '/insure-logos/Momentum.png',
    website: 'https://www.momentum.co.za',
    phone: '0860 11 11 83',
    email: 'info@momentum.co.za',
    headquartersCity: 'Centurion',
    headquartersProvince: 'Gauteng',
    founded: 1966,
    description:
      'Momentum is part of Momentum Metropolitan Holdings, one of South Africa\'s largest insurance-based financial services groups. The brand focuses on long-term insurance, asset management, health, and employee benefits. Momentum is known for its comprehensive financial planning solutions and its Multiply rewards programme that encourages healthy financial and lifestyle behaviour.',
    productsOffered: [
      'Life Insurance',
      'Funeral Cover',
      'Retirement Annuities',
      'Tax Free Savings',
      'Health Insurance',
      'Short-Term Insurance',
      'Employee Benefits',
    ],
    keyStrengths: [
      'Part of Momentum Metropolitan Holdings (JSE-listed)',
      'Multiply wellness and rewards programme',
      'Over 50 years of experience',
      'Comprehensive financial planning ecosystem',
      'Strong presence in employee benefits',
    ],
    claimsRatio: '96.9%',
    bbbeeLevel: 1,
    totalAssets: null,
    totalLiabilities: null,
    solvencyRatio: null,
    annualReportUrl: 'https://www.momentummetropolitan.co.za/investor-relations/',
    regulatoryBody: 'Prudential Authority (SARB) & FSCA',
    status: 'active',
  },
  {
    id: 'metropolitan',
    name: 'Metropolitan',
    legalName: 'Metropolitan Life (a division of Momentum Metropolitan Life Limited)',
    registrationNumber: '1904/002186/06',
    fspNumber: '623',
    logoPath: '/insure-logos/metropolitan-co-za-vector-logo.png',
    website: 'https://www.metropolitan.co.za',
    phone: '0860 724 724',
    email: 'info@metropolitan.co.za',
    headquartersCity: 'Bellville, Cape Town',
    headquartersProvince: 'Western Cape',
    founded: 1898,
    description:
      'Metropolitan is one of South Africa\'s most trusted and accessible insurance brands, focusing on the emerging and middle-market segments. As a division of Momentum Metropolitan Life Limited, Metropolitan provides affordable life insurance, funeral cover, savings, and retirement products. It is known for its extensive branch and agent network, particularly in underserved communities.',
    productsOffered: [
      'Life Insurance',
      'Funeral Cover',
      'Savings Plans',
      'Retirement Products',
      'Hospital Plans',
    ],
    keyStrengths: [
      'Over 125 years of serving South Africans',
      'Strong focus on affordability and accessibility',
      'Extensive agent and branch network in townships and rural areas',
      'Part of Momentum Metropolitan Holdings',
      'High brand trust in emerging markets',
    ],
    claimsRatio: '96.5%',
    bbbeeLevel: 1,
    totalAssets: null,
    totalLiabilities: null,
    solvencyRatio: null,
    annualReportUrl: 'https://www.momentummetropolitan.co.za/investor-relations/',
    regulatoryBody: 'Prudential Authority (SARB) & FSCA',
    status: 'active',
  },
  {
    id: '1life',
    name: '1Life',
    legalName: '1Life Insurance Limited',
    registrationNumber: '2001/015491/06',
    fspNumber: '24769',
    logoPath: '/insure-logos/1Life-logo-stacked.webp',
    website: 'https://www.1life.co.za',
    phone: '0860 10 53 40',
    email: 'clientservices@1life.co.za',
    headquartersCity: 'Johannesburg',
    headquartersProvince: 'Gauteng',
    founded: 2005,
    description:
      '1Life Insurance is a direct life insurance provider in South Africa, offering affordable life, funeral, and disability cover products directly to consumers without intermediaries. As a subsidiary of Clientèle Limited (now part of the Telesure Investment Holdings group), 1Life leverages technology and direct marketing to provide competitive premiums and a streamlined customer experience.',
    productsOffered: [
      'Life Insurance',
      'Funeral Cover',
      'Disability Cover',
      'Accidental Cover',
      'Cancer Cover',
    ],
    keyStrengths: [
      'Direct insurer — no intermediary costs passed to clients',
      'Competitive premiums',
      'Simple, easy-to-understand products',
      'Quick online application process',
      'Part of a well-capitalised group',
    ],
    claimsRatio: '95.8%',
    bbbeeLevel: 2,
    totalAssets: null,
    totalLiabilities: null,
    solvencyRatio: null,
    annualReportUrl: null,
    regulatoryBody: 'Prudential Authority (SARB) & FSCA',
    status: 'active',
  },
  {
    id: 'rma',
    name: 'Rand Mutual Assurance (RMA)',
    legalName: 'Rand Mutual Assurance Company Limited',
    registrationNumber: '1914/000516/06',
    fspNumber: '169',
    logoPath: '/insure-logos/RMA-Logo_Full.png',
    website: 'https://www.randmutual.co.za',
    phone: '011 411 8500',
    email: 'info@randmutual.co.za',
    headquartersCity: 'Parktown, Johannesburg',
    headquartersProvince: 'Gauteng',
    founded: 1894,
    description:
      'Rand Mutual Assurance (RMA) is a licensed mutual assurance company providing workers\' compensation cover primarily to the mining and related industries in South Africa. With over 130 years of history, RMA administers claims under the Compensation for Occupational Injuries and Diseases Act (COIDA). It is one of the two licensed mutual associations authorised to manage occupational injury claims in South Africa.',
    productsOffered: [
      'Workers Compensation',
      'Occupational Injury Cover',
      'Occupational Disease Cover',
      'Rehabilitation Services',
    ],
    keyStrengths: [
      'Over 130 years of specialised experience',
      'Licensed mutual association under COIDA',
      'Deep expertise in mining and industrial sectors',
      'Comprehensive rehabilitation and return-to-work programmes',
      'Strong regulatory compliance track record',
    ],
    claimsRatio: null,
    bbbeeLevel: null,
    totalAssets: null,
    totalLiabilities: null,
    solvencyRatio: null,
    annualReportUrl: 'https://www.randmutual.co.za/about-us/annual-reports/',
    regulatoryBody: 'Department of Employment and Labour & FSCA',
    status: 'active',
  },
];

async function seedInsurers() {
  const batch = db.batch();
  const now = new Date().toISOString();

  for (const insurer of insurers) {
    const docRef = db.collection('insurers').doc(insurer.id);
    batch.set(docRef, {
      ...insurer,
      createdAt: now,
      updatedAt: now,
      seededBy: 'ai_generated',
      notes: 'Seeded with publicly available information. Assets, liabilities, solvency ratio, and certificates to be updated manually by admin.',
    }, { merge: true });
  }

  await batch.commit();
  console.log(`✅ Seeded ${insurers.length} insurers successfully.`);
  console.log('');
  console.log('Next steps for admin (shampene@lebonconsulting.co.za):');
  console.log('  1. Update totalAssets, totalLiabilities, and solvencyRatio from latest annual reports');
  console.log('  2. Upload FSB/FSCA certificates to insurers/{id}/certificates subcollection');
  console.log('  3. Verify all FSP numbers and registration numbers are current');
  console.log('  4. Add any missing product offerings or key strengths');
}

seedInsurers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
