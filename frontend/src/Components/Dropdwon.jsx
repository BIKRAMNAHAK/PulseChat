import React, { useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { bgColor, textColor, fontSize, fontVariant } from '../Services/helper';

const Dropdown = ({
    data = [],                       // [{ label, value }, ...]
    value,                           // selected value
    onSelect,                        // (item) => {}
    placeholder = 'Select',
    label,                           // field ke upar ka title (optional)
    searchable = true,
    searchPlaceholder = 'Search...',
    labelKey = 'label',              // API ka field naam, jaise 'servicename'
    valueKey = 'value',              // API ka field naam, jaise 'serviceid'
    disabled = false,
    clearable = false,               // selected hata sakne ke liye X
    error,                           // error message (red border + text)
    emptyText = 'No results found',
    maxHeight = 220,                 // options list ki max height
    style,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const selected = useMemo(() => {
        if (value === null || value === undefined) return undefined;
        return data.find((i) => String(i[valueKey]) === String(value));
    }, [data, value, valueKey]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return data;
        return data.filter((i) => String(i[labelKey] ?? '').toLowerCase().includes(q));
    }, [data, query, labelKey]);

    const close = () => {
        setOpen(false);
        setQuery('');
    };

    const toggle = () => {
        if (disabled) return;
        open ? close() : setOpen(true);
    };

    const handleSelect = (item) => {
        onSelect && onSelect(item);
        close();
    };

    const handleClear = () => {
        onSelect && onSelect({ [labelKey]: '', [valueKey]: null });
        close();
    };

    const showClear = clearable && !!selected && !disabled;

    return (
        <View style={style}>
            {!!label && <Text style={styles.label}>{label}</Text>}

            {/* ===== Input field ===== */}
            <TouchableOpacity
                activeOpacity={0.8}
                disabled={disabled}
                onPress={toggle}
                style={[
                    styles.field,
                    open && styles.fieldOpen,
                    !!error && styles.fieldError,
                    disabled && styles.fieldDisabled,
                ]}
            >
                {open && searchable ? (
                    <TextInput
                        autoFocus
                        value={query}
                        onChangeText={setQuery}
                        placeholder={selected ? String(selected[labelKey]) : searchPlaceholder}
                        placeholderTextColor={textColor.muted}
                        style={styles.searchInput}
                        autoCorrect={false}
                    />
                ) : (
                    <Text
                        style={[styles.fieldText, !selected && styles.placeholder]}
                        numberOfLines={1}
                    >
                        {selected ? String(selected[labelKey]) : placeholder}
                    </Text>
                )}

                {showClear ? (
                    <TouchableOpacity
                        onPress={handleClear}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close-circle" size={20} color={textColor.muted} />
                    </TouchableOpacity>
                ) : (
                    <Ionicons
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={textColor.muted}
                    />
                )}
            </TouchableOpacity>

            {!!error && !open && <Text style={styles.errorText}>{error}</Text>}

            {/* ===== Options: input ke theek neeche ===== */}
            {open && (
                <View style={[styles.list, { maxHeight }]}>
                    <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                    >
                        {filtered.length === 0 ? (
                            <Text style={styles.empty}>{emptyText}</Text>
                        ) : (
                            filtered.map((item, index) => {
                                const isSelected =
                                    !!selected &&
                                    String(item[valueKey]) === String(selected[valueKey]);
                                return (
                                    <TouchableOpacity
                                        key={String(item[valueKey] ?? index)}
                                        style={[styles.option, isSelected && styles.optionActive]}
                                        onPress={() => handleSelect(item)}
                                    >
                                        <Text
                                            style={[styles.optionText, isSelected && styles.optionTextActive]}
                                        >
                                            {String(item[labelKey])}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark" size={20} color={bgColor.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

export default Dropdown;

const styles = StyleSheet.create({
    label: { fontSize: fontSize.small, color: textColor.primary, marginBottom: 5, ...fontVariant.bold },

    field: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        minHeight: 46,
    },
    fieldOpen: { borderColor: bgColor.primary },
    fieldError: { borderColor: bgColor.error },
    fieldDisabled: { opacity: 0.5 },
    fieldText: { flex: 1, fontSize: fontSize.medium, color: textColor.primary, marginRight: 8 },
    placeholder: { color: textColor.muted },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        marginRight: 8,
        fontSize: fontSize.medium,
        color: textColor.primary,
    },
    errorText: { color: textColor.error, fontSize: fontSize.small, marginTop: 4 },

    list: {
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        backgroundColor: '#fff',
        overflow: 'hidden',
        elevation: 3,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e4e4e4',
    },
    optionActive: { backgroundColor: bgColor.secondary },
    optionText: { flex: 1, fontSize: fontSize.medium, color: textColor.primary },
    optionTextActive: { color: bgColor.primary, ...fontVariant.bold },
    empty: { textAlign: 'center', color: textColor.muted, paddingVertical: 18, fontSize: fontSize.medium },
});