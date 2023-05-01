
import React, { FunctionComponent, useState } from 'react';
import {
    Text,
    StyleSheet,
    Button,
} from 'react-native';
import { StatusBar } from "expo-status-bar";
import { useForm } from 'react-hook-form';
import { LogoutProps } from './types';

const Logout: FunctionComponent<LogoutProps> = (props) => {
    const { handleSubmit } = useForm();
    const onSubmit = () => {
        props.onSubmit();
    };
    return (
        <>
            <StatusBar style="auto" />
            <Text style={styles.identifier}>@{props.identifier}</Text>
            <Button title="Log Out" onPress={handleSubmit(onSubmit)} />
        </>
    );
}

const styles = StyleSheet.create({
    identifier: {
        paddingVertical: 12,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
});

export default Logout;
