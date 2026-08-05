import React from 'react';
import {
  Pressable as NativePressable,
  type PressableProps,
  type PressableStateCallbackType,
  type View,
} from 'react-native';
import { createNativeWrapper } from 'react-native-gesture-handler';

const GesturePressable = createNativeWrapper(NativePressable);

export { type PressableProps, type PressableStateCallbackType };

export const Pressable = GesturePressable as unknown as React.ForwardRefExoticComponent<
  React.PropsWithoutRef<PressableProps> & React.RefAttributes<View>
>;
