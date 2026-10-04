import { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, Platform, ScrollViewProps } from 'react-native';

interface Props extends ScrollViewProps {
  children: ReactNode;
}

export default function KeyboardAwareScrollView({ children, contentContainerStyle, ...props }: Props) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        {...props}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
