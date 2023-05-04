
import React, { FunctionComponent, useState } from 'react';
import {
    Text,
    TextInput,
    View,
    StyleSheet,
    Button,
    Alert,
    ScrollView,
} from 'react-native';
import { StatusBar } from "expo-status-bar";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Constants from 'expo-constants';
import { useForm } from 'react-hook-form';

import { LoginProps } from './types';

const Login: FunctionComponent<LoginProps> = (props) => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const { handleSubmit } = useForm();
    const onSubmit = () => {
        props.onSubmit({ identifier: identifier, password: password });
    };
    return (
        <>
            <StatusBar style="auto" />
            <Text>Don't enter your primary BlueSky credentials. Under Settings &gt; Advanced &gt; App Passwords, Add App Password and use that credential to log in instead. This may be safely revoked later.</Text>
            <Text style={styles.label}>BlueSky ID</Text>
            <TextInput autoCapitalize="none" style={styles.input} value={identifier} onChangeText={(identifier) => setIdentifier(identifier)} />
            <Text style={styles.label}>BlueSky App Password</Text>
            <TextInput autoCapitalize="none" style={[styles.input, { marginBottom: 8 }]} secureTextEntry={true} value={password} onChangeText={(password) => setPassword(password)} />
            <Button title="Submit" onPress={handleSubmit(onSubmit)} />
        </>
    );
}

const styles = StyleSheet.create({
    label: {
        paddingVertical: 5,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    input: {
        borderStyle: 'solid',
        borderWidth: 1,
        borderRadius: 5,
        paddingVertical: 5,
        paddingLeft: 5,
        fontSize: 16,
        height: 40,
        color: '#000',
    },
});

export default Login;
