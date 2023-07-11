import React, { useEffect, useState, useContext } from 'react';
import {
    NativeEventEmitter, 
    NativeModules,  
    StyleSheet, 
    Text, 
    View,
    StatusBar,
    ScrollView,
    TextInput,
    Image,
    Platform,
    Alert,
    TouchableOpacity
} from 'react-native';
import { useNavigation, useRoute, useTheme, useFocusEffect } from '@react-navigation/native';
import {Icon} from 'react-native-elements';
import Dialog from 'react-native-dialog';
import NfcManager, { NfcTech, Ndef} from 'react-native-nfc-manager';
import Ntag424 from '../../class/Ntag424';

import {
    BlueLoading,
    BlueCard,
    BlueText,
    BlueButton
} from '../../BlueComponents';
import navigationStyle from '../../components/navigationStyle';
import { BlueStorageContext } from '../../blue_modules/storage-context';
import alert from '../../components/Alert';

const defaultKey = "00000000000000000000000000000000";

const BoltCardDisconnect = () => {

    const { walletID } = useRoute().params;
    const { wallets, saveToDisk } = useContext(BlueStorageContext);
    const wallet = wallets.find(w => w.getID() === walletID);
    const { colors } = useTheme();
    const { navigate, goBack, setParams, popToTop } = useNavigation();

    const stylesHook = StyleSheet.create({
        modalContent: {
          backgroundColor: colors.modal,
          borderTopColor: colors.foregroundColor,
          borderWidth: colors.borderWidth,
        },
        customAmount: {
          borderColor: colors.formBorder,
          borderBottomColor: colors.formBorder,
          backgroundColor: colors.inputBackgroundColor,
        },
        customAmountText: {
          color: colors.foregroundColor,
        },
        root: {
          backgroundColor: colors.elevated,
        },
        rootBackgroundColor: {
          backgroundColor: colors.elevated,
        },
        amount: {
          color: colors.foregroundColor,
        },
        label: {
          color: colors.foregroundColor,
        },
        modalButton: {
          backgroundColor: colors.modalButton,
        },
    });

    const [showDetails, setShowDetails] = useState(false);
    const [writeKeysOutput, setWriteKeysOutput] = useState();
    const [wipeCardDetails, setWipeCardDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    //setup
    const [uid, setUid] = useState()
    const [key0, setKey0] = useState()
    const [key1, setKey1] = useState()
    const [key2, setKey2] = useState()
    const [key3, setKey3] = useState()
    const [key4, setKey4] = useState()

    const [pasteWipeKeysJSON, setPasteWipeKeysJSON] = useState()
    const [resetNow, setResetNow] = useState(false);
    const [keyJsonError, setKeyJsonError] = useState(false);

    useEffect(() => {
       if(wipeCardDetails) {
            setUid(wipeCardDetails.uid);
            setKey0(wipeCardDetails.k0 || "00000000000000000000000000000000");
            setKey1(wipeCardDetails.k1 || "00000000000000000000000000000000");
            setKey2(wipeCardDetails.k2 || "00000000000000000000000000000000");
            setKey3(wipeCardDetails.k3 || "00000000000000000000000000000000");
            setKey4(wipeCardDetails.k4 || "00000000000000000000000000000000");
            let error = ''
            if(wipeCardDetails.action != 'wipe') {
                error = 'Wipe action not specified, proceed with caution.\r\n';
            }
            if(wipeCardDetails.version != '1') {
                error = error + ' Expected version 1, found version: '+wipeCardDetails.version+'\r\n';
            }
            if(!wipeCardDetails.k0 || !wipeCardDetails.k1 || !wipeCardDetails.k2 || !wipeCardDetails.k3 || !wipeCardDetails.k4) {
                error = error + ' Some keys missing, proceed with caution';
            }
            setKeyJsonError(error ? error : false)
       }
    }, [wipeCardDetails]);

    const getWipeKeys = async (wallet) => {
        try {
            const data = await wallet.wipecard();
            setWipeCardDetails(data);
            setLoading(false);
        } catch(err) {
            alert(err.message);
        }
    }

    useEffect(() => {
        if(wallet) {
            getWipeKeys(wallet);
        }
    }, [walletID]);

    const setCardWiped = async () => {
        console.log('setCardWiped');
        if(wallet) {
            await wallet.disconnectCard();
            saveToDisk();
        }
    }

    const delay = ms => new Promise(res => setTimeout(res, ms));

    const enableResetMode = async () => {
        setWriteKeysOutput(null)
        setResetNow(true);
        var result = [];
        console.log('key0', key0);
        try {
            // register for the NFC tag with NDEF in it
            await NfcManager.requestTechnology(NfcTech.IsoDep, {
                alertMessage: "Ready to write card. Hold NFC card to phone until all keys are changed."
            });
            
            const defaultKey = '00000000000000000000000000000000';
            
            // //auth first     
            await Ntag424.AuthEv2First(
                '00',
                key0,
            );

            //reset file settings
            await Ntag424.resetFileSettings();
            
            //change keys
            await Ntag424.changeKey(
                '01',
                key1,
                defaultKey,
                '00',
            );
            result.push("Change Key1: Success");
            console.log('changekey 2')
            await Ntag424.changeKey(
                '02',
                key2,
                defaultKey,
                '00',
            );
            result.push("Change Key2: Success");
            console.log('changekey 3')
            await Ntag424.changeKey(
                '03',
                key3,
                defaultKey,
                '00',
            );
            result.push("Change Key3: Success");
            await Ntag424.changeKey(
                '04',
                key4,
                defaultKey,
                '00',
            );
            result.push("Change Key4: Success");
            await Ntag424.changeKey(
                '00',
                key0,
                defaultKey,
                '00',
            );
            result = ["Change Key0: Success", ...result];

            const message = [Ndef.uriRecord('')];
            const bytes = Ndef.encodeMessage(message);
            await Ntag424.setNdefMessage(bytes);

            result.push("NDEF and SUN/SDM cleared");
            setCardWiped();

        } catch (ex) {
            console.error('Oops!', ex, ex.constructor.name);
            var error = ex;
            if(typeof ex === 'object') {
                error = "NFC Error: "+(ex.message? ex.message : ex.constructor.name);
            }
            result.push(error);
            setWriteKeysOutput(error);
        } finally {
            // stop the nfc scanning
            NfcManager.cancelTechnologyRequest();
            delay(1500);
            setWriteKeysOutput(result.join('\r\n'));
            // setResetNow(false);
        }
    }

    const disableResetMode = () => {
        setResetNow(false);
    }
    
    return(
        <View style={[styles.root, stylesHook.root]}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={[styles.root, stylesHook.root]} keyboardShouldPersistTaps="always">
                <View style={styles.scrollBody}>
                    <Dialog.Container visible={resetNow}>
                        <View style={{flexDirection: "row", marginHorizontal: 20, marginBottom: 20, alignItems: 'center'}}>
                            <Icon name="creditcard" size={30} color="#000" type="antdesign" style={{marginRight: 10}}/> 
                            <Dialog.Title style={styles.textBlack}>
                            Tap NFC Card 
                            </Dialog.Title>

                        </View>
                        {!writeKeysOutput && <Text style={{fontSize:20, textAlign: 'center', borderColor:'black'}}>
                        Hold NFC card to reader when ready 
                        </Text>}
                        {writeKeysOutput ? 
                        <Text style={{fontSize:19, textAlign: 'center', borderColor:'black', marginBottom: 20, lineHeight: 25}}>
                            {writeKeysOutput}
                        </Text>
                        :   
                            <View style={{height: 40}}>
                                <BlueLoading />
                            </View>
                        }
                        
                        <Dialog.Button label="Close"
                        onPress={() => {
                            console.log('wallet', wallet.cardWritten);
                            if(!wallet.cardWritten) {
                                popToTop();
                                goBack();
                            } else {
                                disableResetMode();
                            }
                        }} />
                    </Dialog.Container>
                    <Dialog.Container visible={keyJsonError}>
                        <Dialog.Title style={styles.textBlack}>
                        Wipe Keys Issue
                        </Dialog.Title>
                        <Text>{keyJsonError}</Text>
                        <Dialog.Button label="I understand"
                        onPress={() => {
                            setKeyJsonError(false);
                        }} />
                    </Dialog.Container>
                    <BlueCard>
                        <BlueText style={styles.label}>
                            {/* <Image 
                                source={(() => {
                                return require('../../img/bolt-card-unlink.png');
                                })()} style={{width: 60, height: 40, marginTop:20}}
                            /> */}
                        </BlueText>
                        <BlueText style={styles.label}>Disconnect my bolt card</BlueText>
                        {loading ? 
                            <BlueLoading />
                        : 
                            <>
                                <BlueButton 
                                    style={styles.link}
                                    title={!showDetails ? "Show Key Details ▼" : "Hide Key Details ▴"}
                                    onPress={() => setShowDetails(!showDetails)}
                                />
                                {showDetails && 
                                <>
                                    <View style={styles.titlecontainer}>
                                        <Text style={styles.title}>Key 0</Text>
                                    </View>
                                    <TextInput 
                                        style={styles.input} 
                                        value={key0} 
                                        maxLength={32}
                                        multiline = {true}
                                        numberOfLines = {1}
                                        autoCapitalize='none'
                                        onChangeText={(text) => setKey0(text)}
                                        placeholder={defaultKey}
                                    />
                                    <View style={styles.titlecontainer}>
                                        <Text style={styles.title}>Key 1</Text>
                                    </View>
                                    <TextInput 
                                        style={styles.input} 
                                        value={key1} 
                                        maxLength={32}
                                        multiline = {true}
                                        numberOfLines = {1}
                                        autoCapitalize='none'
                                        onChangeText={(text) => setKey1(text)}
                                        placeholder={defaultKey}
                                    />
                                    <View style={styles.titlecontainer}>
                                        <Text style={styles.title}>Key 2</Text>
                                    </View>
                                    <TextInput 
                                        style={styles.input} 
                                        value={key2} 
                                        maxLength={32}
                                        multiline = {true}
                                        numberOfLines = {1}
                                        autoCapitalize='none'
                                        onChangeText={(text) => setKey2(text)}
                                        placeholder={defaultKey}
                                    />
                                    <View style={styles.titlecontainer}>
                                        <Text style={styles.title}>Key 3</Text>
                                    </View>
                                    <TextInput 
                                        style={styles.input} 
                                        value={key3} 
                                        maxLength={32}
                                        multiline = {true}
                                        numberOfLines = {1}
                                        autoCapitalize='none'
                                        onChangeText={(text) => setKey3(text)}
                                        placeholder={defaultKey}
                                    />
                                    <View style={styles.titlecontainer}>
                                        <Text style={styles.title}>Key 4</Text>
                                    </View>
                                    <TextInput 
                                        style={styles.input} 
                                        value={key4} 
                                        maxLength={32}
                                        multiline = {true}
                                        numberOfLines = {1}
                                        autoCapitalize='none'
                                        onChangeText={(text) => setKey4(text)}
                                        placeholder={defaultKey}
                                    />
                                </>
                                }
                                <BlueButton 
                                    title="Reset card"
                                    backgroundColor={colors.redBG}
                                    onPress={enableResetMode}
                                />
                            </>
                        }
                    </BlueCard>
                </View>
            </ScrollView>
            
        </View>
    );
}

const styles = StyleSheet.create({
    monospace: {
      fontFamily: "monospace"
    },
    modalContent: {
        padding: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        minHeight: 350,
        height: 350,
    },
    customAmount: {
        flexDirection: 'row',
        borderWidth: 1.0,
        borderBottomWidth: 0.5,
        minHeight: 44,
        height: 44,
        marginHorizontal: 20,
        alignItems: 'center',
        marginVertical: 8,
        borderRadius: 4,
    },
    root: {
        flexGrow: 1,
        justifyContent: 'space-between',
    },
    scrollBody: {
        marginTop: 32,
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    share: {
        justifyContent: 'flex-end',
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 8,
    },
    link: {
        marginVertical: 16,
        paddingHorizontal: 10,

    },
    button: {
        marginVertical: 16,
        paddingHorizontal: 10,
        paddingVertical: 16,
        borderWidth:1,
        borderColor: '#fff',

    },
    amount: {
        fontWeight: '600',
        fontSize: 36,
        textAlign: 'center',
    },
    label: {
        fontWeight: '600',
        textAlign: 'center',
        paddingBottom: 24,
    },
    modalButton: {
        paddingVertical: 14,
        paddingHorizontal: 70,
        maxWidth: '80%',
        borderRadius: 50,
        fontWeight: '700',
    },
    customAmountText: {
        flex: 1,
        marginHorizontal: 8,
        minHeight: 33,
    },
    title: {
        fontSize:16
    },
    titlecontainer: {
        flexDirection: 'row', 
        justifyContent: 'space-between'
    },
    input: {
        height: 30,
        width: '100%',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#fff',
        flexWrap: 'wrap',
        padding: 5,
        fontFamily: 'monospace',
        textAlignVertical: 'top',
        color:'#000'
    },
});

BoltCardDisconnect.navigationOptions = navigationStyle(
{
    closeButton: true,
    headerHideBackButton: true,
},
(options, { theme, navigation, route }) => (
    {
         ...options, 
         title: "Disconnect bolt card", 
        //  headerLeft: () => Platform.OS == 'ios' ? (
        //     <TouchableOpacity
        //     accessibilityRole="button"
        //     disabled={route.params.isLoading === true}
        //     onPress={() =>
        //         navigation.navigate('BoltCardDisconnectHelp')
        //     }
        //     >
        //         <Icon name="help-outline" type="material" size={22} color="#000" />
        //     </TouchableOpacity>
        // ) : null
    }
),
);

export default BoltCardDisconnect;