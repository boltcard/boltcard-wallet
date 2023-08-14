import { useFocusEffect, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
    ActivityIndicator,
    Alert,
    NativeEventEmitter,
    NativeModules,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
    Image,
    useColorScheme
} from 'react-native';
import Dialog from 'react-native-dialog';
import NfcManager, { NfcTech, Ndef} from 'react-native-nfc-manager';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LottieView from 'lottie-react-native';
import Ntag424 from '../../class/Ntag424';
import { Icon } from 'react-native-elements';

import {
    BlueButton,
    BlueCard,
    BlueLoading,
    BlueText
} from '../../BlueComponents';
import { BlueStorageContext } from '../../blue_modules/storage-context';
import alert from '../../components/Alert';
import navigationStyle from '../../components/navigationStyle';

const defaultKey = "00000000000000000000000000000000";

const BoltCardDisconnect = ({navigation}) => {
    const theme = useColorScheme();
    const isDarkTheme = theme === 'dark'; 

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
    const [writeError, setWriteError] = useState(false);
    const [writingCard, setWritingCard] = useState(false);

    const animationRef = useCallback((ref) => {
        if(ref) {
            ref.play();
            // Or set a specific startFrame and endFrame with:
            ref.play(30, 120);
        }
    }, []);

    useEffect(() => {
        navigation.addListener('beforeRemove', (e) => {
            NfcManager.cancelTechnologyRequest();
        })
    }, [navigation])

    useEffect(() => {
       if(wipeCardDetails) {
            console.log('wipeCardDetails', wipeCardDetails);
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
        setLoading(true);
        try {
            const data = await wallet.wipecard();
            setWipeCardDetails(data);
            setTimeout(() => {
                setLoading(false);
            }, 1000);
        } catch(err) {
            alert(err.message);
            setLoading(false);
        }
    }

    useEffect(() => {
        if(wallet) {
            getWipeKeys(wallet);
        }
    }, [walletID]);

    useEffect(() => {
        if(key0 && key1 && key2 && key3 && key4 && Platform.OS == 'android') {
            enableResetMode()
        }
    }, [key0, key1, key2, key3, key4]);

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
        setWriteError(null);
        var result = [];
        console.log('key0', key0);
        try {
            // register for the NFC tag with NDEF in it
            await NfcManager.requestTechnology(NfcTech.IsoDep, {
                alertMessage: "Ready to write card. Hold NFC card to phone until all keys are changed."
            });
            setWritingCard(true);
            
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
            setWriteError(error);
        } finally {
            // stop the nfc scanning
            NfcManager.cancelTechnologyRequest();
            setWriteKeysOutput(result.join('\r\n'));
            setWritingCard(false);
            await delay(500);
            setResetNow(false);
        }
    }

    const disableResetMode = () => {
        NfcManager.cancelTechnologyRequest();
        setResetNow(false);
    }

    const writeCardContent = () => {
        if(writingCard || writeKeysOutput || writeError) {
            //write card result or writing card
            if(writingCard) {
               return (
                    <View style={{marginVertical: 20}}>
                        <ActivityIndicator style={{marginBottom: 15}}/>
                        <BlueText style={{fontSize: 20, textAlign: 'center', marginBottom: 10}}>Resetting your bolt card...</BlueText>
                        <BlueText style={{fontSize: 20, textAlign: 'center'}}>Do not remove your card{"\n"}until resetting is complete.</BlueText>
                    </View>
                ); 
            } else {
                if(writeKeysOutput || writeError) {
                    // result of card being written
                    return (
                        <>  
                            <>
                                {!writeError ?
                                    <>
                                        <Icon name="check" color="#0f5cc0" size={80} />
                                        <BlueText style={{fontSize:30, textAlign: 'center', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center'}}>
                                            Card Reset Complete
                                        </BlueText>
                                    </>
                                :
                                    <>

                                        <Icon name="warning" color="#0f5cc0" size={80} />
                                        <BlueText style={{fontSize:30, textAlign: 'center', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center'}}>
                                            Card Reset Failed
                                        </BlueText>
                                    </>
                                }
                                <BlueButton 
                                    style={styles.link}
                                    title={!showDetails ? "Show Write Details ▼" : "Hide Write Details ▴"}
                                    onPress={() => setShowDetails(!showDetails)}
                                />
                                {showDetails && 
                                    <View style={{paddingBottom: 20}}>
                                        <BlueText>Output:</BlueText>
                                        {writeError && <BlueText>Tag Type Error: {writeError}<Ionicons name="alert-circle"  size={20} color="red" /></BlueText>}
                                        {writeKeysOutput && <BlueText>{writeKeysOutput}</BlueText>}                                        
                                    </View>
                                }
                            </>
                            <>
                                {!wallet.cardWritten ? 
                                    <BlueButton 
                                        title="Go back"
                                        onPress={() => {
                                            popToTop();
                                            goBack();
                                        }}
                                    />
                                :
                                    <BlueButton 
                                        title="Retry"
                                        onPress={enableResetMode}
                                    />
                                }
                            </>
                        </>

                    );
                }
            }
        } else {
            var content = () => null;
            if(resetNow) {
                //ready to reset card
                content = () => (
                    <React.Fragment>
                        <BlueText style={{...styles.label, fontSize: 25, lineHeight: 35, marginBottom: 10}}>Hold your nfc card{"\n"}to the reader.</BlueText>
                        <View style={{justifyContent: 'center', flexDirection: 'row'}}>
                            <Icon name="warning" color="orange" size={20} />
                            <BlueText style={{...styles.label, fontSize:20, marginLeft: 10}}>
                                Hold card steady.
                            </BlueText>
                        </View>
                        <View style={{justifyContent: 'center', flexDirection: 'row'}}>
                            <Icon name="warning" color="orange" size={20} />
                            <BlueText style={{...styles.label, fontSize:20, marginLeft: 10}}>
                                Do not remove your card{"\n"}until resetting is complete. 
                            </BlueText>
                        </View>
                        <View style={{alignItems: 'center'}}>
                            <LottieView 
                                source={require("../../img/nfc-tap-animation.json")} 
                                autoplay={true} 
                                loop={true} 
                                style={{height: 200}}
                                ref={animationRef}
                            />
                        </View>
                    </React.Fragment>
                );
            } else {
                content = () => (
                    <React.Fragment>
                        <View>
                            <BlueText style={{fontSize: 25, fontWeight: 600, textAlign: 'center'}}>Reset your Boltcard</BlueText>
                            <View style={{alignItems: 'center'}}>
                                <Image 
                                    source={isDarkTheme ? require('../../img/bolt-card-unlink.png') : require('../../img/bolt-card-unlink_black.png')}
                                    style={{width: 130, height: 100, marginVertical:20}}
                                    resizeMode={'cover'}
                                />
                            </View>
                        </View>
                        <View style={{marginBottom: 15}}>
                            <BlueButton title="Reset" onPress={enableResetMode}/>
                        </View>
                    </React.Fragment>
                );
            }
            return (
                <React.Fragment>
                    {content()}
                    <BlueButton 
                        style={styles.link}
                        title={!showDetails ? "Advanced ▼" : "Hide Advanced ▴"}
                        onPress={() => setShowDetails(!showDetails)}
                    />
                        {showDetails && <>                          
                            <View style={{marginBottom: 20}}>
                                <View style={styles.titlecontainer}>
                                    <BlueText style={styles.title}>Key 0</BlueText>
                                </View>
                                <BlueText>{key0}</BlueText>
                                <View style={styles.titlecontainer}>
                                    <BlueText style={styles.title}>Key 1</BlueText>
                                </View>
                                <BlueText>{key1}</BlueText>
                                <View style={styles.titlecontainer}>
                                    <BlueText style={styles.title}>Key 2</BlueText>
                                </View>
                                <BlueText>{key2}</BlueText>
                                <View style={styles.titlecontainer}>
                                    <BlueText style={styles.title}>Key 3</BlueText>
                                </View>
                                <BlueText>{key3}</BlueText>
                                <View style={styles.titlecontainer}>
                                    <BlueText style={styles.title}>Key 4</BlueText>
                                </View>
                                <BlueText>{key4}</BlueText>
                            </View>
                        </>
                        } 
                </React.Fragment>
            );
        }

        return null;
    }
    
    return(
        <View style={[styles.root, stylesHook.root]}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={[styles.root, stylesHook.root]} keyboardShouldPersistTaps="always">
                <View style={styles.scrollBody}>
                    <Dialog.Container visible={keyJsonError}>
                        <Dialog.Title style={styles.textBlack}>
                        Wipe Keys Issue
                        </Dialog.Title>
                        <BlueText>{keyJsonError}</BlueText>
                        <Dialog.Button label="I understand"
                        onPress={() => {
                            setKeyJsonError(false);
                        }} />
                    </Dialog.Container>
                    {
                        loading
                    ?
                        <View style={{justifyContent: 'center', alignItems: 'center', flex: 1}}>
                            <ActivityIndicator style={{marginBottom: 15}} size="large"/>
                            <BlueText style={{marginBottom: 15, ...styles.h4}}>Getting card details...</BlueText>
                        </View>
                    :
                        <>
                            {wipeCardDetails ?
                                <View style={{flex: 1, justifyContent: 'center'}}>
                                    <View>
                                        {writeCardContent()}
                                    </View>
                                </View>

                            :
                                <BlueText>Error getting bolt card details.</BlueText>
                            }
                        </>
                    }
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
    dialogTitle: Platform.select({
        ios: {
            color: "#333",
            textAlign: "center",
            fontSize: 18,
            fontWeight: "600",
        },
        android: {
            color: "#333",
            fontWeight: "500",
            fontSize: 18,
        },
        web: {
            fontWeight: "500",
            fontSize: 18,
        },
        default: {},
    })
});

BoltCardDisconnect.navigationOptions = navigationStyle(
{
    closeButton: true,
    headerHideBackButton: true,
},
(options, { theme, navigation, route }) => (
    {
         ...options, 
         title: "Disconnect bolt card"
    }
),
);

export default BoltCardDisconnect;