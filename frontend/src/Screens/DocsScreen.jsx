import React, { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Button from '../Components/Botton';

// ===== 1. LIBRARIES =====
const LIBRARIES = [
    { name: 'react-native', use: 'Base framework for building the mobile app.' },
    { name: '@react-navigation/native', use: 'Core of navigation between screens.' },
    { name: '@react-navigation/native-stack', use: 'Stack navigation (one screen opens on top of another).' },
    { name: '@react-navigation/bottom-tabs', use: 'Bottom tab bar.' },
    { name: 'react-native-screens', use: 'Makes navigation faster by using native screen containers.' },
    { name: 'react-native-safe-area-context', use: 'Keeps content clear of the notch and system bars.' },
    { name: 'react-native-vector-icons', use: 'Icon sets such as Ionicons.' },
    { name: 'redux', use: 'Global state store.' },
    { name: 'react-redux', use: 'Connects Redux to React (Provider, useSelector, useDispatch).' },
    { name: 'redux-thunk', use: 'Runs async API calls inside actions.' },
    { name: 'redux-persist', use: 'Saves Redux data in AsyncStorage so it survives an app restart.' },
    { name: '@react-native-async-storage/async-storage', use: 'Local storage on the phone.' },
    { name: 'axios', use: 'HTTP client used by the getApi and postApi helpers.' },
];

// ===== 2. FOLDER STRUCTURE =====
const TREE = `project/
├── App.jsx
├── index.js
└── src/
    ├── Assets/
    │   ├── Images/
    │   └── Fonts/
    ├── NavigationStack/
    │   ├── StackNavigator.jsx
    │   └── BottomTabNavigator.jsx
    ├── Components/
    │   ├── Button.jsx
    │   ├── Loader.jsx
    │   ├── Dropdown.jsx
    │   └── Alert.jsx
    ├── Screens/
    │   ├── HomeScreen.jsx
    │   └── DocScreen.jsx
    └── Services/
        ├── Actions/
        │   ├── postApis.js
        │   └── getApis.js
        ├── Reducers/
        │   ├── actionReducer.js
        │   └── combineReducer.js
        ├── helper.js
        └── store.js`;

// ===== 3. WHAT EACH FOLDER DOES =====
const FOLDERS = [
    { path: 'App.jsx', use: 'Root file. Provider, PersistGate, SafeAreaProvider and NavigationContainer are set up here.' },
    { path: 'src/Assets', use: 'Images/ holds photos and icons, Fonts/ holds custom fonts.' },
    { path: 'src/NavigationStack', use: 'The complete navigation setup lives here.' },
    { path: 'src/Components', use: 'Reusable components shared by many screens.' },
    { path: 'src/Screens', use: 'All pages of the app.' },
    { path: 'src/Services', use: 'All API, Redux and helper logic.' },
];

// ===== 4. WHAT EACH FILE DOES =====
const FILES = [
    { path: 'NavigationStack/StackNavigator.jsx', use: 'Stack navigator. Tabs and screens that open on top (details, docs) are registered here.' },
    { path: 'NavigationStack/BottomTabNavigator.jsx', use: 'Custom-designed bottom tab bar and the tab screens.' },
    { path: 'Components/Button.jsx', use: 'Common button, so every button looks the same across the app.' },
    { path: 'Components/Loader.jsx', use: 'Animated loading spinner, full screen or inline.' },
    { path: 'Components/Dropdown.jsx', use: 'Searchable dropdown / select box.' },
    { path: 'Components/Alert.jsx', use: 'Animated success, error, warning and info popups.' },
    { path: 'Screens/HomeScreen.jsx', use: 'Home page with the app features and the Learn button.' },
    { path: 'Screens/DocScreen.jsx', use: 'This page: libraries, folder structure and component usage.' },
    { path: 'Services/Actions/getApis.js', use: 'GET API calls (thunk actions that fetch data).' },
    { path: 'Services/Actions/postApis.js', use: 'POST API calls (thunk actions for save, update and delete).' },
    { path: 'Services/Reducers/actionReducer.js', use: 'Logic that decides how state changes for each action.' },
    { path: 'Services/Reducers/combineReducer.js', use: 'Combines all reducers into a single rootReducer.' },
    { path: 'Services/helper.js', use: 'Common helpers: axios setup, color palette, font styles, permission checks.' },
    { path: 'Services/store.js', use: 'Redux store with thunk middleware and redux-persist setup.' },
];

// ===== 5. DATA FLOW =====
const FLOW = [
    'A screen calls dispatch(action).',
    'The thunk in Services/Actions calls the API.',
    'The API response is passed to the reducer.',
    'actionReducer updates the state.',
    'The screen reads the new data with useSelector and the UI updates.',
    'redux-persist saves the selected state in AsyncStorage.',
];

// ===== 6. HOW TO USE COMPONENTS =====
// usage: null => shows "Coming soon"
const COMPONENTS = [
    {
        name: 'Button',
        desc: 'Reusable button with variants, sizes, icons and a loading state.',
        usage: `// 1. Import
import Button from '../Components/Button';

// 2. Basic
<Button title="Save" onPress={handleSave} />

// 3. Variants
// primary | secondary | success | danger | outline | ghost
<Button title="Delete" variant="danger" onPress={handleDelete} />
<Button title="Cancel" variant="outline" onPress={close} />

// 4. Sizes: small | medium | large
<Button title="Next" size="large" />

// 5. Icon (Ionicons name) on left or right
<Button title="Login" icon="log-in-outline" />
<Button title="Learn" icon="arrow-forward" iconPosition="right" />

// 6. Full width
<Button title="Submit" fullWidth onPress={submit} />

// 7. Loading (shows a spinner, blocks taps)
<Button title="Submit" loading={loading} onPress={submit} />

// 8. Disabled
<Button title="Next" disabled={!isValid} />

// 9. Custom color, shape and style
<Button title="Approve" color="#4CAF50" rounded={30} style={{ marginTop: 10 }} />

// PROPS
// title         text of the button
// onPress       function called on tap
// variant       primary | secondary | success | danger | outline | ghost
// size          small | medium | large
// icon          Ionicons name
// iconPosition  left | right
// loading       true / false
// disabled      true / false
// fullWidth     true / false
// rounded       border radius (number)
// color         custom background color
// style         extra button style
// textStyle     extra text style`,
    },
    {
        name: 'Alert',
        desc: 'Animated popup for success, error, warning and info, with optional confirm / cancel.',
        usage: `// 1. Import
import Alert from '../Components/Alert';

// 2. State (one alert state per screen)
const [alert, setAlert] = useState({ visible: false });
const closeAlert = () => setAlert((p) => ({ ...p, visible: false }));

// 3. Render once, at the bottom of your screen
<Alert {...alert} onClose={closeAlert} />

// 4. Show success / error
setAlert({ visible: true, type: 'success', title: 'Saved', message: 'Data saved successfully.' });
setAlert({ visible: true, type: 'error', title: 'Failed', message: 'Please try again.' });

// 5. Auto close after 2 seconds
setAlert({ visible: true, type: 'success', title: 'Done', autoClose: 2000 });

// 6. Confirm / Cancel (example: delete)
const handleDeletePress = () => {
  setAlert({
    visible: true,
    type: 'warning',
    title: 'Delete item?',
    message: 'This cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    onConfirm: () => deleteItem(),
  });
};

// FULL EXAMPLE
const Screen = () => {
  const [alert, setAlert] = useState({ visible: false });
  const closeAlert = () => setAlert((p) => ({ ...p, visible: false }));

  const save = () => {
    dispatch(saveData(form))
      .then(() => setAlert({ visible: true, type: 'success', title: 'Saved', autoClose: 2000 }))
      .catch(() => setAlert({ visible: true, type: 'error', title: 'Failed', message: 'Try again.' }));
  };

  return (
    <View>
      <Button title="Save" onPress={save} />
      <Alert {...alert} onClose={closeAlert} />
    </View>
  );
};

// PROPS
// visible          true / false
// type             success | error | warning | info
// title            heading text
// message          description text
// confirmText      confirm button text (default OK)
// cancelText       if given, a Cancel button also shows
// onConfirm        called when confirm is pressed
// onCancel         called when cancel is pressed
// onClose          required, hides the alert
// autoClose        milliseconds, closes automatically
// closeOnBackdrop  true / false (default true)`,
    },
    {
        name: 'Loader',
        desc: 'Animated loading spinner, full screen or inline.',
        usage: `// 1. Import
import Loader from '../Components/Loader';

// 2. State
const [loading, setLoading] = useState(false);

// 3. Full screen overlay
<Loader visible={loading} />

// 4. With a message
<Loader visible={loading} text="Please wait..." />

// 5. Inline (inside a card or list, no overlay)
<Loader visible={loading} overlay={false} size={32} />

// 6. Custom color
<Loader visible={loading} color="#E53935" />

// FULL EXAMPLE
const Screen = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    dispatch(getAmcList(empid))
      .catch((e) => console.log(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <FlatList data={items} renderItem={renderItem} />
      <Loader visible={loading} text="Loading..." />
    </View>
  );
};

// PROPS
// visible   true / false
// text      message below the spinner
// size      ring size (default 48)
// color     ring color
// overlay   true = full screen, false = inline (default true)`,
    },
    {
        name: 'Dropdown',
        desc: 'Searchable dropdown that works with any API data.',
        usage: `// 1. Import
import Dropdown from '../Components/Dropdown';

// 2. Data and state
const [city, setCity] = useState(null);
const cities = [
  { label: 'Raipur', value: 1 },
  { label: 'Bhopal', value: 2 },
];

// 3. Basic
<Dropdown
  label="City"
  data={cities}
  value={city}
  placeholder="Select city"
  onSelect={(item) => setCity(item.value)}
/>

// 4. API data with different field names
<Dropdown
  data={serviceList}
  labelKey="servicename"
  valueKey="serviceid"
  value={serviceid}
  onSelect={(item) => setServiceid(item.serviceid)}
/>

// 5. Without search, with clear (X) button
<Dropdown data={cities} searchable={false} clearable />

// 6. Validation error
<Dropdown data={cities} error="Please select a city" />

// FULL EXAMPLE
const Screen = () => {
  const dispatch = useDispatch();
  const [services, setServices] = useState([]);
  const [serviceid, setServiceid] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dispatch(getServiceMaster('amc')).then((res) => setServices(res?.data || []));
  }, []);

  const submit = () => {
    if (!serviceid) return setError('Please select a service');
    setError('');
    // save here
  };

  return (
    <View>
      <Dropdown
        label="Service Type"
        data={services}
        labelKey="servicename"
        valueKey="serviceid"
        value={serviceid}
        error={error}
        onSelect={(item) => setServiceid(item.serviceid)}
      />
      <Button title="Submit" onPress={submit} />
    </View>
  );
};

// PROPS
// data               array of objects
// value              selected value
// onSelect           called with the whole selected item
// placeholder        text when nothing is selected
// label              title above the field
// searchable         true / false (default true)
// searchPlaceholder  search box hint
// labelKey           field shown to the user (default label)
// valueKey           field used as the value (default value)
// clearable          shows an X to clear the selection
// disabled           true / false
// error              error message text
// emptyText          text when search finds nothing
// style              extra style for the wrapper`,
    },
];

const Section = ({ title, children }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {children}
    </View>
);

const InfoCard = ({ name, use }) => (
    <View style={styles.item}>
        <Text style={styles.itemName}>{name}</Text>
        <Text style={styles.itemUse}>{use}</Text>
    </View>
);

const DocScreen = () => {
    const [selected, setSelected] = useState(null);   // component whose usage is open

    return (
        <>
            <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

                {/* ===== Setup note ===== */}
                <View style={styles.noteBox}>
                    <View style={styles.noteHeader}>
                        <Ionicons name="alert-circle" size={20} color="#B26A00" />
                        <Text style={styles.noteTitle}>Before you run the project</Text>
                    </View>
                    <Text style={styles.noteText}>
                        <Text style={styles.bold}>
                            After downloading the ZIP file from GitHub, unzip it and run the
                            "npm install" command in the project root folder.
                        </Text>
                    </Text>
                    <View style={styles.noteCode}>
                        <Text style={styles.code}>{`cd my_mobile_app\nnpm install`}</Text>
                    </View>
                </View>

                <Section title="Libraries">
                    {LIBRARIES.map((lib) => (
                        <InfoCard key={lib.name} name={lib.name} use={lib.use} />
                    ))}
                </Section>

                <Section title="Folder Structure">
                    <View style={styles.codeBox}>
                        <Text style={styles.code}>{TREE}</Text>
                    </View>
                </Section>

                <Section title="What each folder does">
                    {FOLDERS.map((f) => (
                        <InfoCard key={f.path} name={f.path} use={f.use} />
                    ))}
                </Section>

                <Section title="What each file does (inside src/)">
                    {FILES.map((f) => (
                        <InfoCard key={f.path} name={f.path} use={f.use} />
                    ))}
                </Section>

                <Section title="Redux data flow">
                    <View style={styles.flowBox}>
                        {FLOW.map((step, i) => (
                            <View key={i} style={styles.flowRow}>
                                <View style={styles.flowNum}>
                                    <Text style={styles.flowNumText}>{i + 1}</Text>
                                </View>
                                <Text style={styles.flowText}>{step}</Text>
                            </View>
                        ))}
                    </View>
                </Section>

                <Section title="How to use components">
                    {COMPONENTS.map((c) => (
                        <View key={c.name} style={styles.compCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemName}>{c.name}</Text>
                                <Text style={styles.itemUse}>{c.desc}</Text>
                            </View>

                            {c.usage ? (
                                <Button
                                    title="How to use"
                                    size="small"
                                    icon="code-slash-outline"
                                    onPress={() => setSelected(c)}
                                />
                            ) : (
                                <Text style={styles.soon}>Coming soon</Text>
                            )}
                        </View>
                    ))}
                </Section>
            </ScrollView>

            {/* ===== Usage modal ===== */}
            <Modal
                visible={!!selected}
                transparent
                animationType="slide"
                onRequestClose={() => setSelected(null)}
            >
                <View style={styles.overlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selected?.name} - How to use</Text>
                            <TouchableOpacity onPress={() => setSelected(null)}>
                                <Ionicons name="close" size={24} color="#222" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <ScrollView horizontal showsHorizontalScrollIndicator>
                                <View style={styles.codeBox}>
                                    <Text style={styles.code}>{selected?.usage}</Text>
                                </View>
                            </ScrollView>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
};

export default DocScreen;

const styles = StyleSheet.create({
    noteBox: {
        backgroundColor: '#FFF8E1',
        borderRadius: 10,
        padding: 14,
        marginBottom: 22,
        borderLeftWidth: 4,
        borderLeftColor: '#F9A825',
    },
    noteHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    noteTitle: { fontSize: 15, fontWeight: '700', color: '#B26A00', marginLeft: 6 },
    noteText: { fontSize: 13, color: '#444', lineHeight: 20, marginBottom: 10 },
    bold: { fontWeight: '800', color: '#222' },
    noteCode: { backgroundColor: '#0B1F4B', borderRadius: 8, padding: 12 },
    container: { flex: 1, backgroundColor: '#f5f7fa' },
    section: { marginBottom: 22 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#14367E', marginBottom: 10 },
    item: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#14367E',
        elevation: 2,
    },
    itemName: { fontSize: 14, fontWeight: '700', color: '#222' },
    itemUse: { fontSize: 13, color: '#555', marginTop: 3, lineHeight: 19 },
    codeBox: { backgroundColor: '#0B1F4B', borderRadius: 10, padding: 14 },
    code: {
        color: '#E8EEFC',
        fontSize: 12,
        lineHeight: 18,
        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    },
    flowBox: { backgroundColor: '#fff', borderRadius: 10, padding: 12, elevation: 2 },
    flowRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
    flowNum: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#14367E',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    flowNumText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    flowText: { flex: 1, fontSize: 13, color: '#444', lineHeight: 19 },

    compCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#14367E',
        elevation: 2,
    },
    soon: { fontSize: 12, color: '#8e8e93', fontStyle: 'italic' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalBox: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: '#14367E' },
});