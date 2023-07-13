import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, View, TouchableOpacity, Image } from 'react-native';
import { Badge } from 'react-native-elements';

import { useFocusEffect } from '@react-navigation/native';
import { BlueHeaderDefaultSub, BlueListItem, BlueText } from '../../BlueComponents';
import { BlueStorageContext } from '../../blue_modules/storage-context';
import { AppStorage } from '../../class';
import navigationStyle from '../../components/navigationStyle';
import loc from '../../loc';

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

const Settings = () => {
  const { navigate } = useNavigation();
  // By simply having it here, it'll re-render the UI if language is changed
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { language } = useContext(BlueStorageContext);

  const [isLoading, setIsLoading] = useState(true);
  const [URI, setURI] = useState();

  useEffect(() => {
    AsyncStorage.getItem(AppStorage.LNDHUB)
      .then(value => setURI(value ?? undefined))
      .then(() => setIsLoading(false))
      .catch(() => setIsLoading(false));

  },[URI]);

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem(AppStorage.LNDHUB)
        .then(value => setURI(value ?? undefined))
        .then(() => setIsLoading(false))
        .catch(() => setIsLoading(false));
    }, [URI])
  );

  return (
    <>
      <View />
      <ScrollView style={styles.root}>
        {Platform.OS === 'android' ? <BlueHeaderDefaultSub leftText={loc.settings.header} /> : <></>}
        <BlueListItem title={loc.settings.general} onPress={() => navigate('GeneralSettings')} testID="GeneralSettings" chevron />
        <BlueListItem title={loc.settings.currency} onPress={() => navigate('Currency')} testID="Currency" chevron />
        <BlueListItem title={loc.settings.language} onPress={() => navigate('Language')} testID="Language" chevron />
        <BlueListItem title={loc.settings.encrypt_title} onPress={() => navigate('EncryptStorage')} testID="SecurityButton" chevron />
        <BlueListItem title="Bolt Hub Settings" rightTitle={isLoading ? <ActivityIndicator /> : (URI && URI !== "" ? <Badge status="success" value="connected" /> : <Badge status="error" value="set hub" />)} onPress={() => navigate('BolthubSettings')} testID="BoltHubSettings" chevron />
        <BlueListItem title={loc.settings.tools} onPress={() => navigate('Tools')} testID="Tools" chevron />
        <BlueListItem title="Buy Bolt Cards" subtitle="Opens in browser" rightTitle={<Badge value="shop" />} onPress={() => Linking.openURL('https://boltcardwallet.com/buy-bolt-cards')} testID="BuyBoltCards" chevron />
        <BlueListItem title={loc.settings.about} onPress={() => navigate('About')} testID="AboutButton" chevron />
        
      </ScrollView>
    </>
  );
};

export default Settings;
Settings.navigationOptions = navigationStyle({
  headerTitle: Platform.select({ ios: loc.settings.header, default: '' }),
  headerLargeTitle: true,
});
