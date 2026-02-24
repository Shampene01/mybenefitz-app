import { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

SplashScreen.preventAutoHideAsync();

function BackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.primary.blue,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen
          name="edit-profile"
          options={{
            title: 'Edit Profile',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="improve-score"
          options={{
            title: 'Financial Health Score',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="increase-earnings"
          options={{
            title: 'Increase Earnings',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="how-it-works"
          options={{
            title: 'How It Works',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="credit-apply"
          options={{
            title: 'Credit Clinic Application',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="fica-upload"
          options={{
            title: 'FICA Documents',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="affiliate-apply"
          options={{
            title: 'Affiliate Application',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="loan-apply"
          options={{
            title: 'Loan Application',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="life-insurance-apply"
          options={{
            title: 'Life Insurance Application',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="retirement-apply"
          options={{
            title: 'Retirement Annuity',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="tax-free-savings-apply"
          options={{
            title: 'Tax Free Savings',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="wills-estates-apply"
          options={{
            title: 'Wills & Estates',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
        <Stack.Screen
          name="funeral-cover-apply"
          options={{
            title: 'Funeral Cover',
            presentation: 'modal',
            headerLeft: () => <BackButton />,
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
