import { useFocusEffect, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Image,
    NativeEventEmitter,
    NativeModules,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import {Icon, ListItem, CheckBox} from 'react-native-elements';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NfcManager, { NfcTech, Ndef} from 'react-native-nfc-manager';
import LottieView from 'lottie-react-native';
import Dialog from 'react-native-dialog';
import Ntag424 from '../../class/Ntag424';

import {
    BlueButton,
    BlueCard,
    BlueLoading,
    BlueText
} from '../../BlueComponents';
import { BlueStorageContext } from '../../blue_modules/storage-context';
import alert from '../../components/Alert';
import navigationStyle from '../../components/navigationStyle';
var RNFS = require('react-native-fs');

const BoltCardCreate = ({navigation}) => {

    const { walletID } = useRoute().params;
    const { wallets, saveToDisk } = useContext(BlueStorageContext);
    const wallet = wallets.find(w => w.getID() === walletID);
    const { colors } = useTheme();
    const { navigate, goBack, setParams } = useNavigation();

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

    const [cardDetails, setCardDetails] = useState({});
    const [createUrl, setCreateUrl] = useState('');
    const [loading, setLoading] = useState(true);
    //setup
    const [keys, setKeys] = useState([]);
    const [lnurlw_base, setlnurlw_base] = useState();
    const [cardName, setCardName] = useState();
    const [writeMode, setWriteMode] = useState(false);

    //output
    const [cardUID, setCardUID] = useState();
    const [tagname, setTagname] = useState();
    const [tagTypeError, setTagTypeError] = useState();
    
    const [key0Changed, setKey0Changed] = useState();
    const [key1Changed, setKey1Changed] = useState();
    const [key2Changed, setKey2Changed] = useState();
    const [key3Changed, setKey3Changed] = useState();
    const [key4Changed, setKey4Changed] = useState();

    const [ndefWritten, setNdefWritten] = useState();
    const [writekeys, setWriteKeys] = useState();
    const [ndefRead, setNdefRead] = useState();
    const [testp, setTestp] = useState();
    const [testc, setTestc] = useState();
    const [testBolt, setTestBolt] = useState();

    const [showBackupDialog, setShowBackupDialog] = useState(false);

    const [writingCard, setWritingCard] = useState(false);

    const [enhancedPrivacy, setEnhancedPrivacy] = useState(false);

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
        if(cardDetails && (cardDetails.lnurlw_base && cardDetails.k0 && cardDetails.k1 && cardDetails.k2 && cardDetails.k3 && cardDetails.k4)) {
            setKeys([cardDetails.k0,cardDetails.k1,cardDetails.k2,cardDetails.k3,cardDetails.k4])
            setlnurlw_base(cardDetails.lnurlw_base)
            setCardName(cardDetails.card_name)
            resetOutput();

            // backupCardKeys();
        }
    }, [cardDetails]);

    useEffect(() => {
        if(keys && lnurlw_base && Platform.OS == 'android') {
            writeAgain();
        }
    }, [keys, lnurlw_base]);

    const getCardKeys = (wallet) => {
        setLoading(true)
        wallet
            .getcardkeys()
            .then(keys => {
                console.log('KEYS', keys);
                setCardDetails(keys);
                wallet.setWipeData(null);
                saveToDisk();
                setShowBackupDialog(true);
                setTimeout(() => {
                    setLoading(false);
                }, 1000);
            })
            .catch(err => {
                setLoading(false);
                console.log('ERROR', err.message);
                alert(err.message);
                goBack();
            });
    }
 
    const setCardWritten = async (status) => {
        if(wallet) {
            await wallet.setCardWritten(status);
            // wallet.setCardKeys(null);
            saveToDisk();
        }
    }

    useEffect(() => {
        if(wallet) {
            getCardKeys(wallet);
        }
    }, [walletID]);

    const updateNodeUrl = text => {
        setNodeURL(text);
    }

    const handleBackButton = () => {
        goBack(null);
        return true;
    };

    const delay = ms => new Promise(res => setTimeout(res, ms));

    const resetOutput = () => {
        setTagTypeError(null);
        setTagname(null);
        setCardUID(null);
        setKey0Changed(null);
        setKey1Changed(null);
        setKey2Changed(null);
        setKey3Changed(null);
        setKey4Changed(null);
        setNdefWritten(null);
        setWriteKeys(null);
    }

    const writeAgain = async () => {
        resetOutput();
        setWriteMode(true);
        console.log('writeAgain');
        try {
            // register for the NFC tag with NDEF in it
            await NfcManager.requestTechnology(NfcTech.IsoDep, {
              alertMessage: "Ready to write card. Hold NFC card to phone until all keys are changed."
            });
            setWritingCard(true);
      
            //set ndef
            const ndefMessage = lnurlw_base.includes('?')
              ? lnurlw_base + '&p=00000000000000000000000000000000&c=0000000000000000'
              : lnurlw_base +
                '?p=00000000000000000000000000000000&c=0000000000000000';
      
      
            const message = [Ndef.uriRecord(ndefMessage)];
            const bytes = Ndef.encodeMessage(message);
      
            await Ntag424.setNdefMessage(bytes);
            setNdefWritten('success');
      
            const key0 = '00000000000000000000000000000000';
            // //auth first     
            await Ntag424.AuthEv2First(
              '00',
              key0,
            );

            if(enhancedPrivacy) {
                await Ntag424.setPrivateUid();
            }
            
            const piccOffset = ndefMessage.indexOf('p=') + 9;
            const macOffset = ndefMessage.indexOf('c=') + 9;
            //change file settings
            await Ntag424.setBoltCardFileSettings(
              piccOffset,
              macOffset,
            );
            //get uid
            const uid = await Ntag424.getCardUid();
            setCardUID(uid);
            
            //change keys
            console.log('key1', keys[1]);
            await Ntag424.changeKey(
              '01',
              key0,
              keys[1],
              '01',
            );
            setKey1Changed('yes');
            console.log('key2', keys[2]);
            await Ntag424.changeKey(
              '02',
              key0,
              keys[2],
              '01',
            );
            setKey2Changed('yes');
            console.log('key3', keys[3]);
            await Ntag424.changeKey(
              '03',
              key0,
              keys[3],
              '01',
            );
            setKey3Changed('yes');
            console.log('key4', keys[4]);
            await Ntag424.changeKey(
              '04',
              key0,
              keys[4],
              '01',
            );
            setKey4Changed('yes');
            console.log('key0', keys[0]);
            await Ntag424.changeKey(
              '00',
              key0,
              keys[0],
              '01',
            );
            setKey0Changed('yes');
            setWriteKeys('success');
      
            //set offset for ndef header
            const ndef = await Ntag424.readData("060000");
            const setNdefMessage = Ndef.uri.decodePayload(ndef);
            setNdefRead(setNdefMessage);
      
            //we have the latest read from the card fire it off to the server.
            const httpsLNURL = setNdefMessage.replace('lnurlw://', 'https://');
            fetch(httpsLNURL)
              .then(response => response.json())
              .then(json => {
                setTestBolt('success');
              })
              .catch(error => {
                setTestBolt('Error: ' + error.message);
              });
      
            await Ntag424.AuthEv2First(
              '00',
              keys[0],
            );
      
            const params = {};
            setNdefMessage.replace(/[?&]+([^=&]+)=([^&]*)/gi,    
              function(m,key,value) {
                params[key] = value;
              }
            );
            if(!"p" in params) {
              setTestp("no p value to test")
              return;
            }
            if(!"c" in params) {
              setTestc("no c value to test")
              return;
            }
      
            const pVal = params['p'];
            const cVal = params['c'].slice(0,16);
      
            const testResult = await Ntag424.testPAndC(pVal, cVal, uid, keys[1], keys[2]);
            setTestp(testResult.pTest ? 'ok' : 'decrypt with key failed');
            setTestc(testResult.cTest ? 'ok' : 'decrypt with key failed');
            setCardWritten('success');
      
      
        } catch (ex) {
            console.error('Oops!', ex, ex.message);
            var error = ex;
            if(typeof ex === 'object') {
                error = "NFC Error: "+(ex.message? ex.message : ex.constructor.name);
            }
            setTagTypeError(error);
            setWritingCard(false);
        } finally {
            // stop the nfc scanning
            await NfcManager.cancelTechnologyRequest();
            setWritingCard(false);
            //delay 1.5 sec after canceling to prevent users calling the requestTechnology function right away.
            //if the request function gets called right after the cancel call, it returns duplicate registration error later
            await delay(500);
            setWriteMode(false);
        }
    }

    const showTickOrError = (good) => {
        return good ? " ✓" : " ×"
    }

    const togglePrivacy = () => {
        setEnhancedPrivacy(!enhancedPrivacy)
    }

    const backupCardKeys = () => {
        let filename = `bolt_card_${(new Date().toJSON().slice(0,19).replaceAll(':','-'))}.json.txt`
        let filename2 = `bolt_card_${(new Date().toJSON().slice(0,19).replaceAll(':','-'))}-wipe.json.txt`
        var baseDirectoryPath = Platform.OS == "ios" ? RNFS.LibraryDirectoryPath : RNFS.DownloadDirectoryPath;
        var path = baseDirectoryPath + '/'+filename;
        var path2 = baseDirectoryPath + '/'+filename2;
        console.log('path', path);
        // write the create card key file
        RNFS.writeFile(path, JSON.stringify(wallet.cardKeys), 'utf8')
          .then((success) => {
              // write the wipe card key file
              RNFS.writeFile(path2, JSON.stringify({
                version: 1,
                action: "wipe",
                k0: wallet.cardKeys.k0,
                k1: wallet.cardKeys.k1,
                k2: wallet.cardKeys.k2,
                k3: wallet.cardKeys.k3,
                k4: wallet.cardKeys.k4
              }), 'utf8')
              .then((success) => {
                alert(`Card keys saved to ${Platform.OS == 'android' ? 'downloads' : 'library'} folder with filenames: \r\n\r\n`+filename+'\r\n'+filename2);
              })
              .catch((err) => {
                console.log(err.message);
                alert('Error downloading keys: '+err.message);
              });
          })
          .catch((err) => {
            console.log(err.message);
            alert('Error downloading keys: '+err.message);
          });
      }

    const key0display = keys[0] ? keys[0].substring(0, 4)+"............"+ keys[0].substring(28) : "pending...";
    const key1display = keys[1] ? keys[1].substring(0, 4)+"............"+ keys[1].substring(28) : "pending...";
    const key2display = keys[2] ? keys[2].substring(0, 4)+"............"+ keys[2].substring(28) : "pending...";
    const key3display = keys[3] ? keys[3].substring(0, 4)+"............"+ keys[3].substring(28) : "pending...";
    const key4display = keys[4] ? keys[4].substring(0, 4)+"............"+ keys[4].substring(28) : "pending...";

    const writingCardContent = () => {
        if(writingCard) {
            //card is getting written
            return (
                <View style={{marginVertical: 20}}>
                    <ActivityIndicator style={{marginBottom: 15}}/>
                    <BlueText style={{fontSize: 20, textAlign: 'center', marginBottom: 10}}>Programming your bolt card...</BlueText>
                    <BlueText style={{fontSize: 20, textAlign: 'center'}}>Do not remove your card until writing is complete.</BlueText>
                </View>
            );
        }  else {
            if(tagTypeError || cardUID) {
                // result of card being written
                return (
                    <>  
                        <>
                            {testc && testc == "ok" ?
                                <>
                                    <Icon name="check" color="#0f5cc0" size={80} />
                                    <BlueText style={{fontSize:30, textAlign: 'center', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center'}}>
                                        Card Connected
                                    </BlueText>
                                </>
                            :
                                <>

                                    <Icon name="warning" color="#0f5cc0" size={80} />
                                    <BlueText style={{fontSize:30, textAlign: 'center', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center'}}>
                                        Card Write Failed
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
                                    <Text>Output:</Text>
                                    {tagTypeError && <Text>Tag Type Error: {tagTypeError}<Ionicons name="alert-circle"  size={20} color="red" /></Text>}
                                    {cardUID && <Text>Card UID: {cardUID} {showTickOrError(true)}</Text>}
                                    {tagname && <Text style={{lineHeight:30, textAlignVertical:"center"}}>Tag: {tagname}{showTickOrError(true)}</Text>}
                                    {key0Changed && <Text>Keys ready to change: {key0Changed == "no" ? "yes" : "no"}{showTickOrError(key0Changed == "no")}</Text>}                       
                                    {ndefWritten && <Text>NDEF written: {ndefWritten}{showTickOrError(ndefWritten == "success")}</Text>}
                                    {writekeys && <Text>Keys Changed: {writekeys}{showTickOrError(writekeys == "success")}</Text>}
                                    {ndefRead && <Text>Read NDEF: {ndefRead}</Text>}
                                    {testp && <Text>Test PICC: {
                                        cardUID.length == 8 ? 
                                        <>test skipped {showTickOrError(true)}</>
                                        : 
                                        <>{testp}{showTickOrError(testp == "ok")}</>
                                    }</Text>}
                                    {testc && <Text>Test CMAC: {testc}{showTickOrError(testc == "ok")}</Text>}
                                    {testBolt && <Text>Bolt call test: {testBolt}{showTickOrError(testBolt == "success")}</Text>}

                                    
                                </View>
                            }
                        </>
                        <>
                            {writekeys == "success" ? 
                                <BlueButton 
                                    title="Go back"
                                    onPress={goBack}
                                />
                            :
                                <BlueButton 
                                    title="Retry"
                                    onPress={writeAgain}
                                />
                            }
                        </>
                    </>

                );
            }
        }
        return null;
    }

    const writeCardContent = () => {
        if(writingCard || tagTypeError || cardUID) {
            //card is being written or need to show write card result
            return (
                <>
                    {writingCardContent()}
                </>
            );
        } else {
            var content = () => null;
            if(writeMode) {
                //ready to write card
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
                                Do not remove your card until writing is complete. 
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
                //show write card button
                content = () => (
                    <React.Fragment>
                        <View>
                            <Text style={{fontSize: 25, fontWeight: 600, textAlign: 'center'}}>Connect your Boltcard</Text>
                            <View style={{alignItems: 'center'}}>
                                <Image 
                                    source={require('../../img/bolt-card-link_black.png')}
                                    style={{width: 130, height: 100, marginVertical:20}}
                                    resizeMode={'cover'}
                                />
                            </View>
                        </View>
                        <View style={{marginBottom: 15}}>
                            <BlueButton title="Write" onPress={writeAgain}/>
                        </View>
                        <BlueButton title="Download your keys" onPress={backupCardKeys}/>
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
                            <View style={{paddingHorizontal:5, marginVertical: 10}}>
                                <CheckBox 
                                    center 
                                    checkedColor="#0070FF" 
                                    checked={enhancedPrivacy} 
                                    onPress={togglePrivacy} 
                                    disabled={writeMode}
                                    title="Enable Private UID (Hides card UID. One-way operation, can't undo)" 
                                />
                            </View>
                          
                            <View style={{marginBottom: 20}}>
                                <BlueText style={styles.monospace}>lnurl:</BlueText>
                                <BlueText style={styles.monospace}>{lnurlw_base}</BlueText>
                                <BlueText style={styles.monospace}>Private UID: {enhancedPrivacy ? "yes" : "no"}</BlueText>
                                <BlueText style={styles.monospace}>Key 0: {key0display}</BlueText>
                                <BlueText style={styles.monospace}>Key 1: {key1display}</BlueText>
                                <BlueText style={styles.monospace}>Key 2: {key2display}</BlueText>
                                <BlueText style={styles.monospace}>Key 3: {key3display}</BlueText>
                                <BlueText style={styles.monospace}>Key 4: {key4display}</BlueText>
                            </View>
                        </>
                        } 
                </React.Fragment>
            );
        }

    }

    return(
        <View style={[styles.root, stylesHook.root]}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={[styles.root, stylesHook.root]} keyboardShouldPersistTaps="always">
                <Dialog.Container
                    visible={showBackupDialog}
                >
                    <Dialog.Title style={{textAlign: 'center'}}>Do you want to download your card keys?</Dialog.Title>
                    <Dialog.Description style={{textAlign: 'center'}}>
                        Backup is highly recommended in case something goes wrong during the programming process. {"\n"}{"\n"}You can do this later in the card details screen. 
                    </Dialog.Description>
                    <Dialog.Button label="No" onPress={() => setShowBackupDialog(false)}/>
                    <Dialog.Button label="Yes" onPress={() => {
                        backupCardKeys();
                        setShowBackupDialog(false)
                    }}/>
                </Dialog.Container>
                <View style={styles.scrollBody}>
                    <BlueCard>
                        {
                            loading
                        ?
                            <View style={{justifyContent: 'center', alignItems: 'center', flex: 1}}>
                                <ActivityIndicator style={{marginBottom: 15}} size="large"/>
                                <BlueText style={{marginBottom: 15, ...styles.h4}}>Getting card details...</BlueText>
                            </View>
                        :
                            <>
                                {cardDetails ?
                                    <View style={{flex: 1, justifyContent: 'center'}}>
                                        <View>
                                            {writeCardContent()}
                                        </View>
                                    </View>

                                :
                                    <Text>Error getting bolt card details.</Text>
                                }
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
        paddingHorizontal: 32,
      },
      amount: {
        fontWeight: '600',
        fontSize: 36,
        textAlign: 'center',
      },
      label: {
        fontWeight: '600',
        textAlign: 'center',
        paddingBottom: 15,
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
      h4: {
        fontSize: 25
      }
});

BoltCardCreate.navigationOptions = navigationStyle(
{
    closeButton: true,
    headerHideBackButton: true,
},
(options, { theme, navigation, route }) => (
    {
         ...options, 
         title: "Connect bolt card"
    }),
);

export default BoltCardCreate;