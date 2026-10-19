import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// ⚠️ File ke asli naam ke hisab se path rakho (Button / Botton, Dropdown / Dropdwon)
import Button from '../Components/Botton';
import Alert from '../Components/Alert';
import Loader from '../Components/Loader';
import Dropdown from '../Components/Dropdwon';

// ===== Ready features (jo abhi project me set hain) =====
const FEATURES = [
    {
        icon: 'git-network-outline',
        title: 'Redux + Thunk',
        desc: 'Global state management with async API calls handled through thunk actions.',
    },
    {
        icon: 'save-outline',
        title: 'Persistent Storage',
        desc: 'Redux Persist saves selected data in AsyncStorage, so it survives an app restart.',
    },
    {
        icon: 'navigate-outline',
        title: 'Stack Navigation',
        desc: 'Native stack navigator for screens that open on top of each other, with a back button.',
    },
    {
        icon: 'apps-outline',
        title: 'Custom Bottom Tabs',
        desc: 'A custom-designed tab bar with an active pill highlight and safe-area support.',
    },
    {
        icon: 'flash-outline',
        title: 'Lazy Screen Loading',
        desc: 'Screens load only when first opened, which keeps app startup fast.',
    },
    {
        icon: 'phone-portrait-outline',
        title: 'Safe Area Support',
        desc: 'Content stays clear of the notch, status bar and gesture bar on every device.',
    },
    {
        icon: 'images-outline',
        title: 'Vector Icons',
        desc: 'Ionicons are available everywhere in the app.',
    },
    {
        icon: 'book-outline',
        title: 'Built-in Docs',
        desc: 'The Learn page lists the libraries used and the folder structure of the project.',
    },
];

// ===== Planned features (abhi bane nahi) =====
const COMING_SOON = [
    'Login and session handling',
    'Company settings (name, logo)',
    'App settings (theme, color palette, font)',
    'Push notifications with on/off control',
];

// ===== Dropdown demo data =====
const CITIES = [
    { label: 'Raipur', value: 1 },
    { label: 'Bhopal', value: 2 },
    { label: 'Nagpur', value: 3 },
    { label: 'Bhubaneswar', value: 4 },
    { label: 'Berhampur', value: 5 },
    { label: 'Chatrapur', value: 6 },
];

const REPO_URL = 'https://github.com/BIKRAMNAHAK/my_mobile_app';
const ZIP_URL = 'https://github.com/BIKRAMNAHAK/my_mobile_app/archive/refs/heads/main.zip';

const SHARE_MESSAGE =
    `Check out this React Native starter app source code:\n${REPO_URL}\n\n` +
    'Please open and unzip it on your computer. Do not try to open it on mobile.';

const DemoCard = ({ title, children }) => (
    <View style={styles.demoCard}>
        <Text style={styles.demoTitle}>{title}</Text>
        {children}
    </View>
);

const HomeScreen = ({ navigation }) => {
    // ----- Alert -----
    const [alert, setAlert] = useState({ visible: false });
    const closeAlert = () => setAlert((p) => ({ ...p, visible: false }));

    // ----- Loader -----
    const [loading, setLoading] = useState(false);
    const [btnLoading, setBtnLoading] = useState(false);

    const showLoader = () => {
        setLoading(true);
        setTimeout(() => setLoading(false), 2000);
    };

    const submitDemo = () => {
        setBtnLoading(true);
        setTimeout(() => {
            setBtnLoading(false);
            setAlert({ visible: true, type: 'success', title: 'Submitted', message: 'Button loading demo finished.', autoClose: 2000 });
        }, 1500);
    };

    // ----- Dropdown -----
    const [city, setCity] = useState(null);

    const shareOnWhatsApp = async () => {
        const text = encodeURIComponent(SHARE_MESSAGE);
        try {
            await Linking.openURL(`whatsapp://send?text=${text}`);
        } catch (e) {
            // WhatsApp install nahi hai to browser wala link khulega
            Linking.openURL(`https://wa.me/?text=${text}`).catch(() =>
                setAlert({ visible: true, type: 'error', title: 'Failed', message: 'Could not open WhatsApp.' })
            );
        }
    };

    return (
        <>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Intro */}
                <View style={styles.hero}>
                    <Text style={styles.heroTitle}>React Native Starter</Text>
                    <Text style={styles.heroText}>
                        This app is built with React Native and uses Redux with Thunk for state
                        management and API calls. It is set up as a clean base, so new screens and
                        features can be added without changing the core structure.
                    </Text>
                </View>

                {/* Features */}
                <Text style={styles.sectionTitle}>What's included</Text>
                {FEATURES.map((f) => (
                    <View key={f.title} style={styles.featureCard}>
                        <View style={styles.iconWrap}>
                            <Ionicons name={f.icon} size={22} color="#14367E" />
                        </View>
                        <View style={styles.featureBody}>
                            <Text style={styles.featureTitle}>{f.title}</Text>
                            <Text style={styles.featureDesc}>{f.desc}</Text>
                        </View>
                    </View>
                ))}

                {/* ===== Live demo ===== */}
                <Text style={styles.sectionTitle}>Live demo</Text>

                <DemoCard title="Button">
                    <View style={styles.row}>
                        <Button title="Primary" />
                        <Button title="Success" variant="success" />
                        <Button title="Danger" variant="danger" />
                    </View>
                    <View style={styles.row}>
                        <Button title="Outline" variant="outline" />
                        <Button title="Icon" icon="heart-outline" variant="secondary" />
                        <Button title="Disabled" disabled />
                    </View>
                    <Button
                        title="Submit (loading demo)"
                        icon="send-outline"
                        loading={btnLoading}
                        onPress={submitDemo}
                        fullWidth
                        style={{ marginTop: 6 }}
                    />
                </DemoCard>

                <DemoCard title="Alert">
                    <View style={styles.row}>
                        <Button
                            title="Success"
                            variant="success"
                            size="small"
                            onPress={() =>
                                setAlert({ visible: true, type: 'success', title: 'Saved', message: 'Data saved successfully.', autoClose: 2000 })
                            }
                        />
                        <Button
                            title="Error"
                            variant="danger"
                            size="small"
                            onPress={() =>
                                setAlert({ visible: true, type: 'error', title: 'Failed', message: 'Something went wrong. Please try again.' })
                            }
                        />
                        <Button
                            title="Confirm"
                            size="small"
                            onPress={() =>
                                setAlert({
                                    visible: true,
                                    type: 'warning',
                                    title: 'Delete item?',
                                    message: 'This cannot be undone.',
                                    confirmText: 'Delete',
                                    cancelText: 'Cancel',
                                    onConfirm: () =>
                                        setTimeout(
                                            () => setAlert({ visible: true, type: 'success', title: 'Deleted', autoClose: 1500 }),
                                            300
                                        ),
                                })
                            }
                        />
                    </View>
                </DemoCard>

                <DemoCard title="Loader">
                    <Button title="Show loader (2 sec)" icon="refresh-outline" onPress={showLoader} />
                </DemoCard>

                <DemoCard title="Dropdown">
                    <Dropdown
                        label="City"
                        data={CITIES}
                        value={city}
                        placeholder="Select city"
                        clearable
                        onSelect={(item) => setCity(item.value)}
                    />
                    <Text style={styles.selectedText}>
                        Selected value: {city === null ? 'none' : String(city)}
                    </Text>
                </DemoCard>

                {/* Coming soon */}
                <Text style={styles.sectionTitle}>Coming soon</Text>
                <View style={styles.soonBox}>
                    {COMING_SOON.map((item) => (
                        <View key={item} style={styles.soonRow}>
                            <Ionicons name="time-outline" size={16} color="#8e8e93" />
                            <Text style={styles.soonText}>{item}</Text>
                        </View>
                    ))}
                </View>

                {/* Learn button */}
                <TouchableOpacity
                    style={styles.learnBtn}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Docs')}
                >
                    <Ionicons name="book-outline" size={20} color="#fff" />
                    <Text style={styles.learnText}>Learn how this app is built</Text>
                </TouchableOpacity>

                {/* Download (alert ke saath) */}
                <TouchableOpacity
                    style={styles.githubBtn}
                    activeOpacity={0.85}
                    onPress={() =>
                        setAlert({
                            visible: true,
                            type: 'info',
                            title: 'Download Source Code',
                            message:
                                'This will download a ZIP file to your phone. Please unzip it and open it on your computer. Do not try to open or run the project on your mobile.',
                            confirmText: 'Download',
                            cancelText: 'Cancel',
                            onConfirm: () => Linking.openURL(ZIP_URL),
                        })
                    }
                >
                    <Ionicons name="logo-github" size={22} color="#fff" />
                    <Text style={styles.learnText}>Download Source Code</Text>
                </TouchableOpacity>

                {/* WhatsApp share */}
                <TouchableOpacity
                    style={styles.whatsappBtn}
                    activeOpacity={0.85}
                    onPress={shareOnWhatsApp}
                >
                    <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                    <Text style={styles.learnText}>Share on WhatsApp</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Alert aur Loader screen ke root par, ek baar render hote hain */}
            <Alert {...alert} onClose={closeAlert} />
            <Loader visible={loading} text="Loading..." />
        </>
    );
};

export default HomeScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f7fa' },
    content: { padding: 16, paddingBottom: 40 },

    hero: { backgroundColor: '#14367E', borderRadius: 16, padding: 18, marginBottom: 20 },
    heroTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
    heroText: { color: '#E8EEFC', fontSize: 14, lineHeight: 21 },

    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#14367E', marginBottom: 10, marginTop: 4 },

    featureCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        elevation: 2,
    },
    githubBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#24292e',
        paddingVertical: 14,
        borderRadius: 24,
        marginTop: 10,
    },
    whatsappBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#25D366',
        paddingVertical: 14,
        borderRadius: 24,
        marginTop: 10,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#E8EEFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    featureBody: { flex: 1 },
    featureTitle: { fontSize: 15, fontWeight: '700', color: '#222' },
    featureDesc: { fontSize: 13, color: '#555', marginTop: 3, lineHeight: 19 },

    demoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        elevation: 2,
    },
    demoTitle: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 10 },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
    selectedText: { fontSize: 12, color: '#777', marginTop: 8 },

    soonBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 20 },
    soonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    soonText: { fontSize: 13, color: '#555', marginLeft: 8 },

    learnBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#14367E',
        paddingVertical: 14,
        borderRadius: 24,
    },
    learnText: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },
});