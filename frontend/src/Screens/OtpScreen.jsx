import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useDispatch } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { verifyOtpAction, sendOtpAction } from '../Services/Actions/authActions';
import { theme } from '../Services/helper';

const OtpScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const { email, devOtp } = route.params || {};

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [timer, setTimer] = useState(60);

  const inputRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOtpChange = (val, idx) => {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (error) setError('');

    // Auto-focus next box
    if (val && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the full 6-digit OTP code.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await dispatch(verifyOtpAction(email, otpCode));
      // App navigates automatically into Main via persisted Redux state!
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    try {
      setResending(true);
      setError('');
      setInfo('');
      await dispatch(sendOtpAction(email));
      setTimer(60);
      setInfo('A new OTP code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  const fillDevOtp = () => {
    if (devOtp && devOtp.length === 6) {
      setOtp(devOtp.split(''));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar backgroundColor={theme.primaryDark} barStyle="light-content" />
      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Icon & Heading */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-open-outline" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Email Verification</Text>
          <Text style={styles.subtitle}>
            We have sent a 6-digit verification code to
          </Text>
          <Text style={styles.emailHighlight}>{email || 'your email'}</Text>
        </View>

        {/* Dev helper pill */}
        {devOtp ? (
          <TouchableOpacity style={styles.devBanner} onPress={fillDevOtp} activeOpacity={0.8}>
            <Ionicons name="key-outline" size={16} color="#00C49F" />
            <Text style={styles.devBannerText}>
              DEV OTP: <Text style={styles.devCode}>{devOtp}</Text> (Tap to auto-fill)
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Card with OTP boxes */}
        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {info ? (
            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
              <Text style={styles.infoText}>{info}</Text>
            </View>
          ) : null}

          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(val) => handleOtpChange(val, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                textAlign="center"
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.disabledBtn]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Verify & Proceed</Text>
            )}
          </TouchableOpacity>

          {/* Resend Section */}
          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't receive code? </Text>
            {timer > 0 ? (
              <Text style={styles.timerText}>Resend in {timer}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResendOtp} disabled={resending}>
                <Text style={styles.resendBtn}>
                  {resending ? 'Sending...' : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F2D37',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 40,
    left: 20,
    padding: 8,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  emailHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00C49F',
    marginTop: 4,
  },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071F24',
    borderWidth: 1,
    borderColor: '#00C49F',
    borderRadius: 10,
    padding: 8,
    marginBottom: 14,
  },
  devBannerText: {
    color: '#E2E8F0',
    fontSize: 12,
    marginLeft: 6,
  },
  devCode: {
    color: '#00C49F',
    fontWeight: '800',
    letterSpacing: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    elevation: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12.5,
    marginLeft: 6,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 8,
    marginBottom: 14,
  },
  infoText: {
    color: '#10B981',
    fontSize: 12.5,
    marginLeft: 6,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    color: '#0F2D37',
  },
  otpBoxFilled: {
    borderColor: theme.accent,
    backgroundColor: '#F0FDF4',
  },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  resendText: {
    fontSize: 13,
    color: '#64748B',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  resendBtn: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00A8E8',
  },
});

export default OtpScreen;
