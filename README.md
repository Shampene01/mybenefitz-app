# MyBenefitz Mobile App

A React Native mobile client portal for MyBenefitz - Your Financial Wellness Partner.

## Features

- **Authentication**: Secure login, registration, and password reset
- **Dashboard**: Overview of loans, credit score, insurance, and financial stats
- **Loans**: Apply for loans and track applications
- **Credit Management**: Check credit score and access credit repair services
- **Insurance**: Browse and get quotes for life, funeral, home, and car insurance
- **Profile Management**: View and edit personal information

## Tech Stack

- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **Icons**: Expo Vector Icons (Ionicons)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npx expo start
```

3. Run on your device:
   - Scan the QR code with Expo Go (Android) or Camera (iOS)
   - Press `a` for Android emulator
   - Press `i` for iOS simulator

## Project Structure

```
mybenefitz-app/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Home
│   │   ├── loans.tsx
│   │   ├── credit.tsx
│   │   ├── insurance.tsx
│   │   └── profile.tsx
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry point
├── constants/             # App constants
│   └── Colors.ts          # Color palette
├── contexts/              # React contexts
│   └── AuthContext.tsx    # Authentication context
├── lib/                   # Utilities
│   └── firebase.ts        # Firebase configuration
└── assets/                # Images and fonts
```

## Color Scheme

- Primary Blue: #002e6d
- Primary Orange: #ff6f00
- Background: #f9f9f9

## Firebase Configuration

Firebase is pre-configured. The following services are used:
- Authentication (Email/Password)
- Firestore (User profiles and data)
- Storage (Document uploads)

## Building for Production

```bash
# Build for Android
npx expo build:android

# Build for iOS
npx expo build:ios
```

## License

Proprietary - MyBenefitz (Pty) Ltd
