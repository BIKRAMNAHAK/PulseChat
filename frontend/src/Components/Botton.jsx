import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { bgColor, textColor, fontSize, fontVariant } from '../Services/helper';

// ===== Variants =====
const VARIANTS = {
    primary:   { bg: bgColor.primary,   text: textColor.light,   border: bgColor.primary },
    secondary: { bg: bgColor.secondary, text: bgColor.primary,   border: bgColor.secondary },
    success:   { bg: bgColor.success,   text: textColor.light,   border: bgColor.success },
    danger:    { bg: bgColor.error,     text: textColor.light,   border: bgColor.error },
    outline:   { bg: 'transparent',     text: bgColor.primary,   border: bgColor.primary },
    ghost:     { bg: 'transparent',     text: bgColor.primary,   border: 'transparent' },
};

// ===== Sizes =====
const SIZES = {
    small:  { paddingVertical: 6,  paddingHorizontal: 12, fontSize: fontSize.small,  icon: 16 },
    medium: { paddingVertical: 10, paddingHorizontal: 18, fontSize: fontSize.medium, icon: 20 },
    large:  { paddingVertical: 14, paddingHorizontal: 24, fontSize: fontSize.large,  icon: 24 },
};

const Button = ({
    title,
    onPress,
    variant = 'primary',     // primary | secondary | success | danger | outline | ghost
    size = 'medium',         // small | medium | large
    icon,                    // Ionicons ka naam, jaise "save-outline"
    iconPosition = 'left',   // left | right
    loading = false,
    disabled = false,
    fullWidth = false,
    rounded = 8,             // borderRadius, pill ke liye 30
    color,                   // custom background color
    textStyle,               // custom text style
    style,                   // custom button style
    children,                // title ki jagah kuch bhi (optional)
}) => {
    const v = VARIANTS[variant] || VARIANTS.primary;
    const s = SIZES[size] || SIZES.medium;
    const isDisabled = disabled || loading;

    const content = children ?? (
        <Text style={[styles.text, { color: v.text, fontSize: s.fontSize }, textStyle]} numberOfLines={1}>
            {title}
        </Text>
    );

    const iconEl = icon ? (
        <Ionicons
            name={icon}
            size={s.icon}
            color={v.text}
            style={iconPosition === 'left' ? styles.iconLeft : styles.iconRight}
        />
    ) : null;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.8}
            style={[
                styles.base,
                {
                    backgroundColor: color || v.bg,
                    borderColor: color || v.border,
                    borderRadius: rounded,
                    paddingVertical: s.paddingVertical,
                    paddingHorizontal: s.paddingHorizontal,
                },
                fullWidth && styles.fullWidth,
                isDisabled && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={v.text} />
            ) : (
                <View style={styles.row}>
                    {iconPosition === 'left' && iconEl}
                    {content}
                    {iconPosition === 'right' && iconEl}
                </View>
            )}
        </TouchableOpacity>
    );
};

export default Button;

const styles = StyleSheet.create({
    base: {
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
    },
    fullWidth: { alignSelf: 'stretch' },
    disabled: { opacity: 0.5 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    text: { ...fontVariant.bold },
    iconLeft: { marginRight: 8 },
    iconRight: { marginLeft: 8 },
});