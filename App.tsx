import { BskyAgent } from '@atproto/api';
import React, { useRef, useEffect, useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Button,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as jose from 'jose';
import Constants from 'expo-constants';
import { useForm } from 'react-hook-form';
import { useLocalStorageState } from "./helpers/hooks";
import Login from './components/Login';
import Logout from './components/Logout';
import Alignment from './components/Alignment';
import { Decision, Outcome } from './helpers/decision';
import { LoginProps, LoginData, LoginResponseDataType, AccessJwtType, RefreshJwtType } from './components/types';

export default function App() {
  // From https://github.com/louislva/skyline under MIT license
  // {

  // Bluesky API
  const agent = useRef<BskyAgent>(
    new BskyAgent({
      service: "https://bsky.social",
    })
  ).current;

  // Auth stuff
  const [loginResponseData, setLoginResponseData] =
    useLocalStorageState<LoginResponseDataType | null>(
      "@loginResponseData",
      null
    );
  const identifier = loginResponseData?.handle;
  const accessJwt = !!loginResponseData?.accessJwt
    ? (jose.decodeJwt(loginResponseData.accessJwt) as AccessJwtType)
    : null;
  const loginExpiration = accessJwt?.exp;
  const timeUntilLoginExpire = loginExpiration
    ? loginExpiration * 1000 - Date.now()
    : null;
  useEffect(() => {
    if (timeUntilLoginExpire) {
      const timeout = setTimeout(() => {
        setLoginResponseData(null);
      }, Math.max(timeUntilLoginExpire, 0));

      return () => clearTimeout(timeout);
    }
  }, [timeUntilLoginExpire]);
  useEffect(() => {
    if (loginResponseData && !agent.session) {
      console.log('resuming session');
      agent.resumeSession(loginResponseData);
    }
  }, [loginResponseData]);

  // }

  const [hideLogin, setHideLogin] = useState(!!identifier);
  const { handleSubmit, register, setValue } = useForm<FormData>();
  const onLoginSubmit = async (data: LoginData) => {
    agent
      .login({ identifier: data.identifier, password: data.password })
      .then(async (response) => {
        if (response.success) {
          setLoginResponseData({
            ...response.data,
          });
        } else {
          // Error
          setLoginResponseData(null);
          // setError("Error");
        }
      })
      .catch((err) => {
        // Error
        setLoginResponseData(null);
        console.log(err.message);
      });
  };
  const onLogoutSubmit = async () => {
    setLoginResponseData(null);
  };
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView contentContainerStyle={styles.innerContainer}>
          {identifier ? (
            <>
              <Logout onSubmit={onLogoutSubmit} identifier={identifier} />
              <Alignment agent={agent} identifier={identifier} />
            </>
          ) : (
            <Login onSubmit={onLoginSubmit} />
          )}
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  innerContainer: {
    padding: 8,
    flex: 1,
  },
});
