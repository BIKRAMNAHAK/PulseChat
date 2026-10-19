import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { bgColor, textColor, fontSize, fontVariant } from '../Services/helper';

const Loader = ({
    visible = false,
    text,                      // spinner ke neeche message (optional)
    size = 48,                 // ring ka size
    color = bgColor.primary,   // ring ka color
    overlay = true,            // true: poori screen par, false: jahan rakho wahin
}) => {
    const spin = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) return;

        fade.setValue(0);
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();

        spin.setValue(0);
        const loop = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 900,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        loop.start();

        return () => loop.stop();
    }, [visible, spin, fade]);

    if (!visible) return null;

    const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    const spinner = (
        <Animated.View style={[styles.box, { opacity: fade }]}>
            <Animated.View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: Math.max(3, size / 12),
                    borderColor: color + '33',   // halka ring
                    borderTopColor: color,       // ghoomne wala hissa
                    transform: [{ rotate }],
                }}
            />
            {!!text && <Text style={styles.text}>{text}</Text>}
        </Animated.View>
    );

    if (!overlay) return <View style={styles.inline}>{spinner}</View>;

    return (
        <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={() => {}}>
            <View style={styles.overlay}>{spinner}</View>
        </Modal>
    );
};

export default Loader;

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    inline: { alignItems: 'center', justifyContent: 'center', padding: 16 },
    box: {
        backgroundColor: bgColor.card,
        paddingVertical: 22,
        paddingHorizontal: 28,
        borderRadius: 16,
        alignItems: 'center',
        elevation: 8,
    },
    text: { marginTop: 14, color: textColor.secondary, fontSize: fontSize.medium, ...fontVariant.bold },
});