'use client';
import { useNativeParity } from '@/hooks/use-native-parity';

export function NativeParityProvider() {
  useNativeParity();
  return null;
}
