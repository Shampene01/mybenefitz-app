import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

// Avatar images from the webapp public folder
const TSHEPO_IMG = require('../assets/tshepo-avatar.png');
const PALESA_IMG = require('../assets/palesa-avatar.png');

export interface AvatarProfile {
  id: string;
  name: string;
  gender: string;
  personality: string;
}

export const AVATARS: AvatarProfile[] = [
  { id: 'tshepo', name: 'Tshepo', gender: 'Male', personality: 'Warm, confident and straight-talking.' },
  { id: 'palesa', name: 'Palesa', gender: 'Female', personality: 'Caring, detail-oriented and reassuring.' },
];

export function AvatarImage({ avatar, size = 30 }: { avatar: AvatarProfile; size?: number }) {
  const source = avatar.id === 'tshepo' ? TSHEPO_IMG : PALESA_IMG;
  return (
    <Image
      source={source}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
      }}
      resizeMode="cover"
    />
  );
}
