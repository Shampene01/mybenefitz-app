import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Animated auth background — React Native port of the webapp's
 * .auth-bg CSS (Stripe-inspired gradient + drifting wave overlay).
 */
export default function AnimatedAuthBackground() {
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const shimmerX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // auth-wave-drift: 16s ease-in-out infinite alternate
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(driftX, { toValue: -SCREEN_W * 0.06, duration: 8000, useNativeDriver: true }),
          Animated.timing(driftY, { toValue: -SCREEN_H * 0.04, duration: 8000, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.08, duration: 8000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue: 0, duration: 8000, useNativeDriver: true }),
          Animated.timing(driftY, { toValue: 0, duration: 8000, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 8000, useNativeDriver: true }),
        ]),
      ]),
    ).start();

    // auth-wave-shimmer: 12s ease-in-out infinite alternate
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: SCREEN_W * 0.15, duration: 6000, useNativeDriver: true }),
        Animated.timing(shimmerX, { toValue: 0, duration: 6000, useNativeDriver: true }),
      ]),
    ).start();
  }, [driftX, driftY, scale, shimmerX]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base gradient — matches webapp .auth-bg */}
      <LinearGradient
        colors={['#0a1628', '#001f4d', '#002e6d', '#003d8f', '#1a5ab8', '#ff8f33', '#ff6f00', '#ffb347']}
        locations={[0, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Radial-ish overlays (::before equivalent) */}
      <LinearGradient
        colors={['rgba(255,143,51,0.35)', 'transparent']}
        start={{ x: 0.7, y: 0 }}
        end={{ x: 0.3, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,61,143,0.4)', 'transparent']}
        start={{ x: 0.3, y: 0.8 }}
        end={{ x: 0.7, y: 0.2 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated wave overlay (::after equivalent) */}
      <Animated.View
        style={[
          styles.waveOverlay,
          {
            transform: [
              { translateX: driftX },
              { translateY: driftY },
              { scale },
              { rotate: '-15deg' },
            ],
          },
        ]}
      >
        <Animated.View style={{ flex: 1, transform: [{ translateX: shimmerX }] }}>
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255,143,51,0.25)',
              'rgba(255,111,0,0.4)',
              'rgba(255,179,71,0.3)',
              'transparent',
            ]}
            locations={[0, 0.25, 0.5, 0.7, 1]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  waveOverlay: {
    position: 'absolute',
    top: -SCREEN_H * 0.3,
    right: -SCREEN_W * 0.1,
    width: SCREEN_W * 0.7,
    height: SCREEN_H * 1.3,
    borderRadius: SCREEN_W * 0.35,
    overflow: 'hidden',
    opacity: 0.9,
  },
});
