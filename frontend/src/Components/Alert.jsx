import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Button from './Botton';
import { bgColor, textColor, fontSize, fontVariant } from '../Services/helper';

const TYPES = {
    success: { icon: 'checkmark-circle', color: bgColor.success },
    error:   { icon: 'close-circle',     color: bgColor.error },
    warning: { icon: 'warning',          color: textColor.warning },
    info:    { icon: 'information-circle', color: bgColor.primary },
};

const Alert = ({
    visible = false,
    type = 'info',          // success | error | warning | info
    title,
    message,
    confirmText = 'OK',
    cancelText,             // dene par 2 button dikhte hain (Cancel + Confirm)
    onConfirm,
    onCancel,
    onClose,                // band karne ka function (zaruri)
    autoClose,              // milliseconds, jaise 2000
    closeOnBackdrop = true,
}) => {
    const t = TYPES[type] || TYPES.info;

    const anim = useRef(new Animated.Value(0)).current;       // card
    const iconAnim = useRef(new Animated.Value(0)).current;   // icon bounce
    const [mounted, setMounted] = useState(visible);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            iconAnim.setValue(0);
            Animated.spring(anim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
            Animated.sequence([
                Animated.delay(150),
                Animated.spring(iconAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
            ]).start();
        } else if (mounted) {
            Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setMounted(false));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, mounted]);

    // Auto close
    useEffect(() => {
        if (!visible || !autoClose) return;
        const id = setTimeout(() => onClose && onClose(), autoClose);
        return () => clearTimeout(id);
    }, [visible, autoClose, onClose]);

    if (!mounted) return null;

    const cardStyle = {
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
    };
    const iconStyle = { transform: [{ scale: iconAnim }] };
    const backdropStyle = {
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    };

    const handleConfirm = () => {
        onConfirm && onConfirm();
        onClose && onClose();
    };
    const handleCancel = () => {
        onCancel && onCancel();
        onClose && onClose();
    };

    return (
        <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
            <View style={styles.center}>
                <TouchableWithoutFeedback onPress={closeOnBackdrop ? onClose : undefined}>
                    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
                </TouchableWithoutFeedback>

                <Animated.View style={[styles.card, cardStyle]}>
                    <Animated.View style={[styles.iconWrap, { backgroundColor: t.color + '1F' }, iconStyle]}>
                        <Ionicons name={t.icon} size={44} color={t.color} />
                    </Animated.View>

                    {!!title && <Text style={styles.title}>{title}</Text>}
                    {!!message && <Text style={styles.message}>{message}</Text>}

                    <View style={styles.btnRow}>
                        {!!cancelText && (
                            <Button
                                title={cancelText}
                                variant="outline"
                                onPress={handleCancel}
                                style={styles.btn}
                            />
                        )}
                        <Button
                            title={confirmText}
                            variant={type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'}
                            onPress={handleConfirm}
                            style={styles.btn}
                        />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

export default Alert;

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
    card: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: bgColor.card,
        borderRadius: 20,
        padding: 22,
        alignItems: 'center',
        elevation: 10,
    },
    iconWrap: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: { fontSize: fontSize.large, color: textColor.primary, textAlign: 'center', ...fontVariant.bold },
    message: {
        fontSize: fontSize.medium,
        color: textColor.secondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 21,
    },
    btnRow: { flexDirection: 'row', marginTop: 20, alignSelf: 'stretch' },
    btn: { flex: 1, marginHorizontal: 5, alignSelf: 'stretch' },
});