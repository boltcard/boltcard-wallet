import { useNavigation, useRoute, useTheme } from '@react-navigation/native';
import React, { useContext, useEffect, useState } from 'react';
import {
  I18nManager,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Button
} from 'react-native';

import {
  BlueListItem,
  BlueButton,
  BlueFormTextInput,
  BlueText
} from '../../BlueComponents';
import { BlueStorageContext } from '../../blue_modules/storage-context';
import alert from '../../components/Alert';
import navigationStyle from '../../components/navigationStyle';
import { ListItem } from 'react-native-elements';
import Toast from 'react-native-toast-message';



const BoltCardDetails = () => {

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
        textLabel1: {
          color: colors.feeText,
        },
        manageFundsButton: {
          backgroundColor: 'tomato'
        }
    });

    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState({});
    const [editMode, setEditMode] = useState(false);
    const [cardKeys, setCardKeys] = useState();
    const [usePin, setUsePin] = useState();
    const [pinNumber, setPinNumber] = useState();

    const [txMax, setTxMax] = useState(0);
    const [pinLimitSats, setPinLimitSats] = useState(0);

    const fetchCardDetails = async (w, reload = false) => {
      setLoading(true);
      w.getCardDetails(reload)
        .then(response => {
            // console.log('details', response);
            setDetails(response);
            saveToDisk();
            setLoading(false);
        })
        .catch(err => {
            console.log('ERROR', err.message);
            alert(err.message);
            goBack();
        });

        // w.getcardkeys().then(response => {
        //   setCardKeys(response);
        // }).catch(err => {
        //     console.log('ERROR', err.message);
        //     alert(err.message);
        //     goBack();
        // });
    }
    useEffect(() => {
        if(wallet) {
            fetchCardDetails(wallet);
        }
    }, [walletID]);

    useEffect(() => {
      if(details && details.tx_limit_sats) {
        setTxMax(details.tx_limit_sats);
      }
      if(details && details.pin_enable) {
        setUsePin(details.pin_enable == 'Y' ? true : false);
      }
      if(details && details.pin_limit_sats) {
        setPinLimitSats(details.pin_limit_sats);
      }
    }, [details]);

    const updateCard = () => {
      console.log('**** updateCard', txMax);
      wallet.updateCard(txMax).then(response => {
        console.log('UPDATE CARD RESPONSE ', response);
        fetchCardDetails(wallet, true);
        setEditMode(false);
        Toast.show({
          type: 'success',
          text1: 'Card updated'
        });
      }).catch(err => {
        console.log('ERROR', err.message);
        alert(err.message);
      });
    }
    
    const cancelUpdate = () => {
      setTxMax(details.tx_limit_sats);
      setEditMode(false);
    }

    const enableCard = (enable) => {
      console.log('ENABLECARD', enable);
      wallet.enableCard(enable).then(response => {
        console.log('UPDATE CARD RESPONSE ', response);
        fetchCardDetails(wallet, true);
      }).catch(err => {
        console.log('ERROR', err.message);
        alert(err.message);
      });
    }
    
    const saveCardPinNumber = () => {
      if(pinNumber && !((/^\d+$/.test(pinNumber) && pinNumber.length == 4))) {
        Toast.show({
          type: 'error',
          text1: 'PIN must be 4 digit number'
        });
        return;
      }
      wallet.savePinNumber(pinNumber, pinLimitSats).then(response => {
        console.log('saveCardPinNumber RESPONSE ', response);
        fetchCardDetails(wallet, true);
        Toast.show({
          type: 'success',
          text1: 'PIN details saved'
        });
        setPinNumber(null);
      }).catch(err => {
        console.log('ERROR', err.message);
        alert(err.message);
      });
    }

    const togglePin = (enabled) => {
      setUsePin(enabled);
      wallet.togglePin(enabled).then(response => {
        console.log('togglePin RESPONSE ', response);
        fetchCardDetails(wallet, true);
      }).catch(err => {
        console.log('ERROR', err.message);
        alert(err.message);
      });

      setUsePin(false);
    }

    const onNumberFieldChange = (val, setValue, maxLength = null) => {
      var newVal = val.replace(/[^0-9]/, '');
      if(maxLength) {
        newVal = newVal.slice(0, maxLength);
      }
      setValue(newVal);
    }

    return(
        <View style={[styles.root, stylesHook.root]}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={[styles.root, stylesHook.root]} keyboardShouldPersistTaps="always">
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              >
                <View style={styles.scrollBody}>
                    {loading ?
                        <BlueText>Loading....</BlueText> 
                    :
                        <>
                          <View style={{marginBottom: 15}}>
                            {details && details.uid && !editMode &&
                              <>
                                <Text style={[styles.textLabel1, stylesHook.textLabel1]}>Card UID</Text>
                                <BlueText>{details.uid}</BlueText>
                              </>
                            }
                            
                              
                            {details && details.tx_limit_sats &&
                              <>
                                <Text style={[styles.textLabel1, stylesHook.textLabel1]}>Transaction limit</Text>
                                {editMode
                                  ?
                                    <BlueFormTextInput 

                                      keyboardType = 'numeric' 
                                      value={txMax.toString()} 
                                      onChangeText={(value) => {
                                        onNumberFieldChange(value, setTxMax);
                                      }}
                                    />
                                    
                                  :
                                  <View style={{marginTop: 5, flexDirection:"row"}}>
                                    <BlueText style={{lineHeight:30, fontSize:25}}>{details.tx_limit_sats} sats</BlueText>
                                    {!wallet.getWipeData() &&
                                      <View style={{marginLeft: 20}}>
                                        <Button
                                          title="Edit"
                                          style={{height:10}}
                                          onPress={() => setEditMode(true)}
                                        />
                                      </View>
                                    }
                                  </View>
                                }
                              </>
                            }
                            {!editMode && details && details.lnurlw_enable &&
                                <>
                                  { !wallet.getWipeData()
                                    && 
                                    <View style={{marginTop: 10}}>
                                      
                                      <BlueListItem
                                        hideChevron
                                        title="Enable or disable this Bolt Card"
                                        Component={TouchableWithoutFeedback}
                                        switch={{ onValueChange: () => enableCard(details.lnurlw_enable != 'Y'), value: details.lnurlw_enable == 'Y' }}
                                      />
                                    </View>
                                  }
                                </>
                              }

                          </View>
                            {
                              wallet.getWipeData()
                              ?
                              <BlueText style={{fontWeight: '700', marginTop: 30}}>THE CARD IS WIPED. Disconnect the card by clicking "Disconnect bolt card" button below</BlueText>
                              :
                                <>
                                  {editMode
                                    &&
                                    <View style={{flexDirection: "row", alignContent:'space-between'}}>
                                      <View style={{marginTop: 10, flex: 1}}>
                                        <BlueButton
                                          title="Cancel"
                                          onPress={cancelUpdate}
                                          backgroundColor={colors.redBG}
                                        />
                                      </View>
                                      <View style={{marginTop: 10, flex: 1}}>
                                        <BlueButton
                                          title="Save"
                                          onPress={updateCard}
                                        />
                                      </View>
                                    </View>
                                  }
                                </>

                            }
                            
                            
                            {!wallet.getWipeData() && !editMode && details && details.lnurlw_enable &&
                              <>
                                <View style={{margin: 0, borderWidth:1, padding:10, borderColor:'#777'}}>
                                  <BlueListItem
                                    hideChevron
                                    title="Enable Card PIN"
                                    Component={TouchableWithoutFeedback}
                                    switch={{ onValueChange: togglePin, value: usePin }}
                                  />
                                  {usePin && <>
                                    <View style={{marginBottom: 15}}>
                                      <Text style={[styles.textLabel1, stylesHook.textLabel1]}>Bolt Card PIN number (hidden)</Text>
                                      <BlueFormTextInput 
                                        placeholder="****"
                                        keyboardType = 'numeric' 
                                        value={pinNumber} 
                                        onChangeText={(value) => {
                                          onNumberFieldChange(value, setPinNumber, 4);
                                        }}
                                      />
                                      {details && details.pin_limit_sats &&
                                      <>
                                        <Text style={[styles.textLabel1, stylesHook.textLabel1]}>Limit to trigger PIN in Satoshis, 0 = every time</Text>
                                        
                                        <BlueFormTextInput 
                                          keyboardType = 'numeric' 
                                          value={pinLimitSats.toString()} 
                                          onChangeText={(value) => {
                                            onNumberFieldChange(value, setPinLimitSats);
                                          }}
                                        />
                                        <Text style={[styles.textLabel1, stylesHook.textLabel1, {fontStyle: 'italic', marginTop:0}]}>Payments above this require PIN</Text>
                                        
                                      </>
                                      }
                                    </View>
                                    
                                    <BlueButton
                                      title="Save Pin Settings"
                                      onPress={saveCardPinNumber}
                                    />
                                  </>}
                                </View>
                              </>
                            }
                            
                            
                            {!editMode &&
                              <View style={{alignItems: 'center', marginTop: 30}}>
                                <TouchableOpacity accessibilityRole="button" onPress={() => {
                                  navigate('BoltCardCreateRoot', {
                                    screen: 'BoltCardDisconnect',
                                    params: {
                                      walletID: walletID,
                                    },
                                  });
                                }}
                                >
                                  <View style={[styles.manageFundsButton, stylesHook.manageFundsButton]}>
                                  <Image 
                                    source={(() => {
                                      return require('../../img/bolt-card-unlink_black.png');
                                    })()} style={{width: 40, height: 30, marginTop:20, marginLeft: 'auto', marginRight: 'auto'}}
                                  />
                                    <Text style={styles.manageFundsButtonText}>Disconnect Bolt Card</Text>
                                  </View>
                                </TouchableOpacity>
                              </View>
                            }
                        </>
                    }
                </View>
              </KeyboardAvoidingView>
                
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
      textLabel1: {
        fontWeight: '500',
        fontSize: 14,
        marginTop: 12,
        marginBottom: 3,
        writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
      },
      manageFundsButton: {
        marginTop: 14,
        marginBottom: 10,
        borderRadius: 9,
        minHeight: 39,
        alignSelf: 'flex-start',
        justifyContent: 'center',
        alignItems: 'center',
      },
      manageFundsButtonText: {
        color:'#000',
        fontWeight: '500',
        fontSize: 14,
        padding: 12,
      },
});

BoltCardDetails.navigationOptions = navigationStyle(
{
    closeButton: true,
    headerHideBackButton: true,
},
opts => ({ ...opts, title: "Bolt Card Details" }),
);

export default BoltCardDetails;